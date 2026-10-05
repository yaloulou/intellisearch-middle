import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'changeme_set_JWT_SECRET_in_env',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException('Token invalide');
    }
    const user = await this.users.findById(payload.sub).catch(error => {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) {
        throw new UnauthorizedException('Compte introuvable');
      }
      throw error;
    });
    if (!user?.actif) throw new UnauthorizedException('Compte inactif ou introuvable');
    return { sub: user._id, email: user.email, role: user.role, desk: user.desk ?? '' };
  }
}
