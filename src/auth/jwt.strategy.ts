import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      //- Extrait le token du header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      //- La clé secrète pour vérifier la signature du token
      secretOrKey: process.env.JWT_SECRET ?? 'fallback-secret',
    });
  }

  //- Cette méthode est appelée après validation du token
  //- Le payload contient les données qu'on a mises dans le token (sub, email)
  //- Ce qu'on retourne ici sera accessible via @Req() dans les controllers
  validate(payload: { sub: string; email: string }) {
    return { id: payload.sub, email: payload.email };
  }
}
