import { Controller, Get, UseGuards, Req, Patch, Body } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { UserService } from './user.service';
import { Plan, Role } from 'src/generated/enums';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Roles } from 'src/auth/guard/role.decorateur';

@UseGuards(JwtGuard, RolesGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get('profile')
  getProfile(@Req() req) {
    return this.userService.getProfil(req.user.id);
  }

  @Patch('plan')
  @Roles(Role.GERANTE)
  updatePlan(@Req() req, @Body('plan') plan: Plan) {
    return this.userService.updatePlan(req.user.id, plan);
  }

  @Patch('notifications')
  updateNotifications(
    @Req() req,
    @Body('notificationsEmail') notificationsEmail: boolean,
  ) {
    return this.userService.updateNotifications(
      req.user.id,
      notificationsEmail,
    );
  }
}
