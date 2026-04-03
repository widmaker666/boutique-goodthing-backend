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

@Injectable()
export class AuthService {
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
    if (isEmailUserExist) {
      throw new ConflictException(`L'email : ${dto.email} est déjà utilisé.`);
    }

    //- Hash du mot de passe avant stockage — on ne stocke jamais un mdp en clair
    //- Le "10" correspond au nombre de rounds de hashage (bon équilibre sécurité/performance)
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    //- Crée l'utilisateur en base avec le mot de passe hashé
    const user = await this.prismaService.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
      },
    });

    //- Retourne l'utilisateur créé (sans le mot de passe idéalement — on verra ça)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async login(dto: LoginDto) {
    //- Cherche l'utilisateur par email — on ne révèle pas si c'est l'email ou le mdp qui est faux
    const isEmailUserExist = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    //- Si l'utilisateur n'existe pas → erreur 401 Unauthorized
    if (!isEmailUserExist) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    //- Compare le mot de passe reçu avec le hash stocké en base
    //- bcrypt.compare() re-hash le mot de passe reçu et compare les deux hashs
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      isEmailUserExist.password,
    );

    //- Si le mot de passe est incorrect → erreur 401 Unauthorized
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    //- Génère un JWT signé avec l'id et l'email de l'utilisateur
    //- Ce token sera envoyé au client et utilisé pour les requêtes suivantes
    const token = this.jwtService.sign({
      sub: isEmailUserExist.id,
      email: isEmailUserExist.email,
    });

    return { access_token: token };
  }
}
