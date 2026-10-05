import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLES_KEY } from '../common/constants/roles.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CCOC_ONLY_KEY } from '../common/decorators/ccoc-only.decorator';

/**
 * Role guard.  Works in conjunction with @Roles() decorator.
 * If no @Roles() is set on the handler / class the guard simply passes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    const ccocOnly = this.reflector.getAllAndOverride<boolean>(CCOC_ONLY_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (ccocOnly && !(user?.role === Role.ADMIN || (
      user?.role === Role.ANALYSTE &&
      typeof user.desk === 'string' && user.desk.trim().toUpperCase() === 'CCOC'
    ))) {
      throw new ForbiddenException('Accès CCOC réservé aux analystes du desk CCOC et aux administrateurs');
    }

    if (!required || required.length === 0) return true;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Accès refusé : rôle insuffisant');
    }

    return true;
  }
}
