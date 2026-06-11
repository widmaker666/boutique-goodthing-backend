import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  //- Client utilisé pour vérifier les tokens Google (mobile) — getTokenInfo() valide l'aud
  private readonly googleOAuthClient = new OAuth2Client();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    //- Vérifie si un utilisateur avec cet email existe déjà en base
    const isEmailUserExist = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    //- Si l'email est déjà pris, on bloque avec une erreur 409 Conflict
    //- On ne peut pas avoir deux comptes avec le même email
    if (isEmailUserExist) {
      throw new ConflictException(`L'email : ${dto.email} est déjà utilisé.`);
    }

    //- Hash du mot de passe avant stockage — on ne stocke jamais un mdp en clair
    //- Le "12" correspond au nombre de rounds de hashage (bon équilibre sécurité/performance)
    //- Plus le nombre est élevé, plus c'est sécurisé mais lent
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    //- Crée l'utilisateur en base avec le mot de passe hashé
    //- Le refreshToken est null par défaut — il sera généré au premier login
    const user = await this.prismaService.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        nom: dto.nom,
        prenom: dto.prenom,
      },
    });

    //- Exclut le mot de passe de la réponse — on ne retourne jamais un hash au client
    //- Le destructuring extrait password et met le reste dans userWithoutPassword
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(dto: LoginDto) {
    //- Cherche l'utilisateur par email
    //- On ne révèle jamais si c'est l'email ou le mdp qui est faux (sécurité)
    //- Un attaquant ne peut pas savoir si l'email existe ou non
    const isEmailUserExist = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    //- Si l'utilisateur n'existe pas → erreur 401 Unauthorized
    if (!isEmailUserExist) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    //- Compare le mot de passe reçu avec le hash stocké en base
    //- bcrypt.compare() re-hash le mot de passe reçu et compare les deux hashs
    //- Si les hashs correspondent → mot de passe correct
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      isEmailUserExist.password,
    );

    //- Si le mot de passe est incorrect → erreur 401 Unauthorized
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    //- Génère l'access token — courte durée (15 minutes)
    //- Contient l'id et l'email pour identifier l'utilisateur sur les routes protégées
    //- Expire vite pour limiter les dégâts en cas de vol
    const accessToken = this.jwtService.sign(
      {
        sub: isEmailUserExist.id,
        email: isEmailUserExist.email,
        role: isEmailUserExist.role,
        plan: isEmailUserExist.plan,
      },
      { expiresIn: '15m' },
    );

    //- Génère le refresh token — longue durée (7 jours)
    //- Contient uniquement l'id, utilisé uniquement pour renouveler l'access token
    //- Ne doit jamais être utilisé comme access token
    const refreshToken = this.jwtService.sign(
      { sub: isEmailUserExist.id },
      { expiresIn: '7d' },
    );

    //- Hash le refresh token avant stockage — jamais en clair en base
    //- Si la BDD est compromise, les refresh tokens restent inutilisables
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    //- Sauvegarde le hash du refresh token en base
    //- Permet de vérifier et révoquer le token lors du refresh ou du logout
    await this.prismaService.user.update({
      where: { id: isEmailUserExist.id },
      data: { refreshToken: hashedRefreshToken },
    });

    //- Retourne les deux tokens au client
    //- Le client stocke l'accessToken pour les requêtes et le refreshToken pour le renouvellement
    return { accessToken, refreshToken };
  }

  async logout(userId: string) {
    //- Invalide le refresh token en le mettant à null en base
    //- Même si quelqu'un possède l'ancien refresh token, il ne pourra plus l'utiliser
    //- Pour se reconnecter, l'utilisateur devra refaire un login complet
    await this.prismaService.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Déconnexion réussie' };
  }

  async refresh(refreshToken: string) {
    //- Vérifie et décode le refresh token — lance une exception si expiré ou invalide
    //- jwtService.verify() est synchrone — pas besoin d'await
    const payload = this.jwtService.verify(refreshToken);

    //- Cherche l'utilisateur en base grâce à l'id contenu dans le payload
    //- payload.sub contient l'id de l'utilisateur qu'on a mis lors de la génération
    const findUser = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
    });

    //- Si l'utilisateur n'existe pas en base → erreur 401
    if (!findUser) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    //- Vérifie que l'utilisateur a bien un refresh token stocké en base
    //- refreshToken est null après un logout — le refresh est alors impossible
    if (!findUser.refreshToken) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    //- Compare le refresh token reçu avec le hash stocké en base
    //- Même principe que bcrypt.compare() pour les mots de passe
    const compareRefreshToken = await bcrypt.compare(
      refreshToken,
      findUser.refreshToken,
    );

    //- Si les tokens ne correspondent pas → quelqu'un utilise un faux token → erreur 401
    if (!compareRefreshToken) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    //- Génère et retourne un nouvel access token valide 15 minutes
    //- Recharge role et plan depuis la base — comme dans login(), pour que le payload
    //- reste à jour même si le rôle/plan a changé depuis l'émission du refresh token
    //- Le refresh token reste le même — pas besoin d'en générer un nouveau
    return {
      accessToken: this.jwtService.sign(
        {
          sub: findUser.id,
          email: findUser.email,
          role: findUser.role,
          plan: findUser.plan,
        },
        { expiresIn: '15m' },
      ),
    };
  }

  async googleLogin(googleUser: {
    email: string;
    firstName: string;
    lastName: string;
    picture?: string;
  }) {
    //- 1. Cherche l'utilisateur en base par email
    let user = await this.prismaService.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await this.prismaService.user.create({
        data: {
          email: googleUser.email,
          password: '',
          avatar: googleUser.picture,
        },
      });
    } else if (googleUser.picture && !user.avatar) {
      user = await this.prismaService.user.update({
        where: { id: user.id },
        data: { avatar: googleUser.picture },
      });
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user?.email, plan: user.plan, role: user.role },
      { expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: '7d' },
    );

    //- 4. Hash et sauvegarde le refresh token en base
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  async googleLoginMobile(googleAccessToken: string) {
    //- Vérifie l'access token Google et son audience (aud) via getTokenInfo
    //- aud doit correspondre au GOOGLE_CLIENT_ID configuré côté serveur
    //- Empêche un attaquant d'utiliser un access token Google émis pour une AUTRE application
    let tokenInfo;
    try {
      tokenInfo = await this.googleOAuthClient.getTokenInfo(googleAccessToken);
    } catch {
      throw new UnauthorizedException('Token Google invalide');
    }

    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean);

    if (!allowedAudiences.includes(tokenInfo.aud as string)) {
      throw new UnauthorizedException('Token Google invalide (audience incorrecte)');
    }

    //- Récupère les infos du profil utilisateur
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Token Google invalide');
    }

    const googleUser = await response.json();

    //- Réutilise la logique existante
    return this.googleLogin({
      email: googleUser.email,
      firstName: googleUser.given_name,
      lastName: googleUser.family_name,
      picture: googleUser.picture,
    });
  }
}
