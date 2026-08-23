import {
  BadRequestException,
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
import { Role } from 'src/generated/enums';

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

    //- CGU obligatoires — vérifié côté serveur, pas seulement dans l'app
    //- (le front peut être contourné, donc c'est ici que ça compte vraiment)
    if (!dto.acceptedCGU) {
      throw new BadRequestException(
        "Vous devez accepter les CGU et la politique de confidentialité pour créer un compte.",
      );
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
        ...(dto.role ? { role: dto.role } : {}),
        cguAcceptedAt: new Date(),
      },
    });

    //- Auto-link : si un record Creatrice avec cet email existe sans userId, lier au nouveau compte
    //- Cas typique : gérante a créé la fiche avant que la créatrice s'inscrive
    await this.prismaService.creatrice.updateMany({
      where: { email: dto.email, userId: null },
      data: { userId: user.id },
    });

    //- GERANTE_CREATRICE : auto-créer une fiche Creatrice liée à elle-même (taux 0% par défaut)
    if (user.role === 'GERANTE_CREATRICE') {
      const nom = [dto.prenom, dto.nom].filter(Boolean).join(' ') || dto.email;
      await this.prismaService.creatrice.create({
        data: {
          nom,
          email: user.email,
          tauxDeCommission: 0,
          userId: user.id,
          geranteId: user.id,
        },
      });
    }

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

  async googleLogin(
    googleUser: {
      email: string;
      firstName: string;
      lastName: string;
      picture?: string;
    },
    //- Fournis uniquement quand le front finalise une INSCRIPTION (formulaire
    //- pré-rempli complété). Absents pour un simple login.
    role?: Role,
    acceptedCGU?: boolean,
  ) {
    //- 1. Cherche l'utilisateur en base par email
    let user = await this.prismaService.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      //- Pas de compte existant et pas de CGU acceptées → on ne crée rien.
      //- Couvre le cas "login" (aucun compte associé, l'app doit rediriger
      //- vers l'inscription) ET empêche toute création de compte sans
      //- consentement, quel que soit le point d'entrée.
      if (!acceptedCGU) {
        throw new UnauthorizedException(
          "Aucun compte associé à ce compte Google. Inscrivez-vous d'abord.",
        );
      }

      const nom = [googleUser.firstName, googleUser.lastName].filter(Boolean).join(' ') || googleUser.email;

      user = await this.prismaService.user.create({
        data: {
          email: googleUser.email,
          password: '',
          nom: googleUser.lastName,
          prenom: googleUser.firstName,
          avatar: googleUser.picture,
          ...(role ? { role } : {}),
          cguAcceptedAt: new Date(),
        },
      });

      //- Auto-link : si un record Creatrice avec cet email existe sans userId, lier au nouveau compte Google
      await this.prismaService.creatrice.updateMany({
        where: { email: googleUser.email, userId: null },
        data: { userId: user.id },
      });

      //- GERANTE_CREATRICE : auto-créer une fiche Creatrice liée à elle-même (taux 0% par défaut)
      //- Même logique que register() — sinon un compte Google DUO n'a pas sa fiche créatrice
      if (user.role === 'GERANTE_CREATRICE') {
        await this.prismaService.creatrice.create({
          data: {
            nom,
            email: user.email,
            tauxDeCommission: 0,
            userId: user.id,
            geranteId: user.id,
          },
        });
      }
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

  async googleLoginMobile(
    googleIdToken: string,
    role?: Role,
    acceptedCGU?: boolean,
  ) {
    //- @react-native-google-signin/google-signin (natif, Credential Manager) fournit
    //- un idToken (JWT) directement — remplace l'ancien flow accessToken+userinfo
    //- (basé sur expo-auth-session, navigateur + redirection, que Google a rendu
    //- instable au fil du temps). verifyIdToken vérifie signature + audience en un
    //- seul appel, et le payload contient déjà toutes les infos de profil.
    const allowedAudiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean) as string[];

    let payload;
    try {
      const ticket = await this.googleOAuthClient.verifyIdToken({
        idToken: googleIdToken,
        audience: allowedAudiences,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token Google invalide');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Token Google invalide');
    }

    //- Réutilise la logique existante
    return this.googleLogin(
      {
        email: payload.email,
        firstName: payload.given_name ?? '',
        lastName: payload.family_name ?? '',
        picture: payload.picture,
      },
      role,
      acceptedCGU,
    );
  }
}
