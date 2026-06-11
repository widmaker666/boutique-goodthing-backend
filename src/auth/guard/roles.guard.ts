import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Role } from 'src/generated/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    //- Fail-open assumé : si aucune métadonnée @Roles n'est définie, la route n'est pas restreinte par rôle
    const roles = this.reflector.get<Role[]>('roles', context.getHandler());
    if (!roles || roles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    //- Si pas d'utilisateur authentifié (ne devrait pas arriver après JwtGuard), on bloque
    if (!user) return false;
    const isRoleArray = roles.includes(user.role);
    if (!isRoleArray) return false;
    return true;
  }
}
