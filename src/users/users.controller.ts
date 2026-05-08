import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Role } from '../common/constants/roles.constant';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * Gestion des utilisateurs — réservé à l'ADMIN.
 * Le guard JWT global et le RolesGuard global s'appliquent automatiquement.
 */
@Controller('users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  create(
    @Body()
    body: {
      email: string;
      password: string;
      nom?: string;
      prenom?: string;
      role: Role;
      desk?: string;
    },
  ) {
    return this.usersService.createUser(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{ nom: string; prenom: string; role: Role; desk: string; actif: boolean }>,
  ) {
    return this.usersService.updateUser(id, body);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.usersService.changePassword(id, body.password);
  }

  @Patch(':id/desactiver')
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }
}
