import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

//- Stratégie Google OAuth2 pour Passport
//- Elle gère le flux d'authentification avec Google
//- Le 'google' est le nom de la stratégie — utilisé dans AuthGuard('google')
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    //- Configuration de la stratégie avec les infos du projet Google Cloud
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '', //- ID du client OAuth Google
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '', //- Secret du client OAuth Google
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '', //- URL de redirection après auth Google
      scope: ['email', 'profile'], //- On demande l'email et le profil à Google
    });
  }

  //- Méthode appelée automatiquement par Passport après que Google a authentifié l'utilisateur
  //- accessToken : token Google pour accéder aux APIs Google (non utilisé ici)
  //- refreshToken : token Google pour renouveler l'accessToken (non utilisé ici)
  //- profile : profil complet retourné par Google (email, nom, photo, etc.)
  //- done : callback Passport pour signaler la fin de la validation
  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
