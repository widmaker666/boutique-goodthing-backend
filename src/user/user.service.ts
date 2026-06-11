import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from 'src/generated/enums';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfil(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updatePlan(userId: string, plan: Plan) {
    const userUpdate = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        plan,
      },
    });
    if (!userUpdate) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...userWithoutPassword } = userUpdate;
    return userWithoutPassword;
  }

  async updateNotifications(userId: string, notificationsEmail: boolean) {
    const userUpdate = await this.prisma.user.update({
      where: { id: userId },
      data: { notificationsEmail },
    });

    //- Exclut le mot de passe et le refresh token hashé de la réponse — même pattern que getProfil/updatePlan
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...userWithoutPassword } = userUpdate;
    return userWithoutPassword;
  }
}
