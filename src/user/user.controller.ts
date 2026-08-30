import {
  Controller,
  Get,
  UseGuards,
  Req,
  Patch,
  Post,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { UserService } from './user.service';

@UseGuards(JwtGuard)
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

  //- PATCH /user/plan supprimé — le plan est géré exclusivement par le webhook Stripe
  //- Laisser cet endpoint ouvert était une faille billing (n'importe quel user pouvait upgrader sans payer)

  @Patch('upgrade-duo')
  upgradeDuo(@Req() req) {
    return this.userService.upgradeDuo(req.user.id);
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

  //- Droit à l'effacement RGPD (art. 17) — supprime le compte et tout ce
  //- qu'il possède/gère. Voir UserService.deleteAccount pour le détail.
  @Delete('account')
  deleteAccount(@Req() req) {
    return this.userService.deleteAccount(req.user.id);
  }
}
