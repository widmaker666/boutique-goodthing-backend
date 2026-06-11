import {
  Controller,
  Get,
  UseGuards,
  Req,
  Patch,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { UserService } from './user.service';
import { Plan } from 'src/generated/enums';
import { RolesGuard } from 'src/auth/guard/roles.guard';

@UseGuards(JwtGuard, RolesGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  getProfile(@Req() req) {
    return this.userService.getProfil(req.user.id);
  }

  @Patch('profile')
  updateProfile(
    @Req() req,
    @Body('nom') nom?: string,
    @Body('prenom') prenom?: string,
  ) {
    return this.userService.updateProfile(req.user.id, { nom, prenom });
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@Req() req, @UploadedFile() file: Express.Multer.File) {
    return this.userService.uploadAvatar(req.user.id, file);
  }

  @Patch('plan')
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
