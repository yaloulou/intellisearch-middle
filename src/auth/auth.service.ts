import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ access_token: string }> {
    if (!email || !password) {
      throw new UnauthorizedException('Email et mot de passe requis');
    }

    const user = await this.usersService.findByEmailWithHash(email);

    if (!user || !user.actif) {
      // Intentionally vague to avoid user enumeration
      throw new UnauthorizedException('Identifiants invalides ou compte désactivé');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Identifiants invalides ou compte désactivé');
    }

    const payload: JwtPayload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      desk: user.desk ?? '',
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  async getProfile(user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }
}
