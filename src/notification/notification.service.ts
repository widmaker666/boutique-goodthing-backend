import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(userId: string, type: string, message: string) {
    //- Crée une notification en base pour l'utilisateur cible
    return this.prisma.notification.create({
      data: { userId, type, message },
    });
  }

  async findAll(userId: string) {
    //- Retourne les 50 dernières notifications de l'user (plus récentes en premier)
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    //- Compte les notifications non lues pour affichage badge
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markAsRead(id: string, userId: string) {
    //- Marque une notification spécifique comme lue — userId en condition pour sécu ownership
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    //- Marque toutes les notifications non lues de l'user comme lues
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
