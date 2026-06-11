import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from 'src/generated/enums';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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

  async updateProfile(userId: string, dto: { nom?: string; prenom?: string }) {
    const userUpdate = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    //- Sync la fiche Creatrice auto-gérée (userId = geranteId) pour que le nom
    //- s'affiche correctement dans les ventes sans re-création de la fiche
    const nomCreatrice = [userUpdate.prenom, userUpdate.nom]
      .filter(Boolean)
      .join(' ');
    if (nomCreatrice) {
      await this.prisma.creatrice.updateMany({
        where: { userId, geranteId: userId },
        data: { nom: nomCreatrice },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...userWithoutPassword } = userUpdate;
    return userWithoutPassword;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const result = await this.cloudinary.uploadImage(file, 'encaissly/avatars');
    const userUpdate = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: result.secure_url },
    });
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
