import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLES_KEY } from '../common/constants/roles.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

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

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Accès refusé : rôle insuffisant');
    }

    return true;
  }
}
