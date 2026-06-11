import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Plan } from 'src/generated/enums';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    //- Fail-open assumé : si aucune métadonnée @Plans n'est définie, la route n'est pas restreinte par plan
    const plan = this.reflector.get<Plan[]>('plans', context.getHandler());
    if (!plan) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    //- Si pas d'utilisateur authentifié (ne devrait pas arriver après JwtGuard), on bloque
    if (!user) return false;
    const isPlanArray = plan.includes(user.plan);
    if (!isPlanArray) return false;
    return true;
  }
}
