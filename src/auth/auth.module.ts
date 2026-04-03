import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from 'src/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    //- Configure le module JWT avec la clé secrète et la durée de validité des tokens
    //- La clé secrète est stockée dans .env pour ne jamais être exposée dans le code
    //- expiresIn: '7d' = le token expire après 7 jours, l'utilisateur devra se reconnecter
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  //- PrismaService est nécessaire pour accéder à la table User
  //- AuthService contient la logique d'inscription et de connexion
  providers: [AuthService, PrismaService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
