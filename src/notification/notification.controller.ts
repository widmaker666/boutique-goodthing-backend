import {
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@UseGuards(JwtGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@Req() req) {
    //- Liste les 50 dernières notifications de l'user connecté
    return this.notificationService.findAll(req.user.id);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req) {
    //- Retourne le nombre de notifications non lues (pour badge mobile)
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req) {
    //- Marque toutes les notifs non lues comme lues
    //- IMPORTANT: doit être AVANT /:id/read pour éviter le conflit de routing
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req) {
    //- Marque une notification spécifique comme lue
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @Delete('read')
  clearRead(@Req() req) {
    //- Supprime définitivement les notifications déjà lues de l'user connecté
    //- IMPORTANT: doit être AVANT un éventuel /:id futur pour éviter le conflit de routing
    return this.notificationService.clearRead(req.user.id);
  }
}
