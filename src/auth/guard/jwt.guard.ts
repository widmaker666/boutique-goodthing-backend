import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

//- Le Guard est le "videur" de la route — il décide si la requête peut entrer
//- AuthGuard('jwt') utilise la stratégie JWT de Passport pour valider le token
//- Il suffit d'étendre AuthGuard pour avoir toute la logique de vérification
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {}
