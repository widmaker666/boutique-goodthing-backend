import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from 'src/generated/enums';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import Stripe from 'stripe';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class UserService {
  //- Instance locale plutôt qu'injecter StripeService (qui dépend déjà de
  //- UserService — éviterait une dépendance circulaire) : juste besoin
  //- d'annuler un abonnement actif avant de supprimer le compte.
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  });

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

  async upgradeDuo(userId: string) {
    //- Récupère le user courant pour vérifier son rôle avant toute modif
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    //- Idempotent : si déjà GERANTE_CREATRICE, on retourne sans erreur
    if (user.role === Role.GERANTE_CREATRICE) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, refreshToken, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }

    //- Passe le rôle à GERANTE_CREATRICE
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.GERANTE_CREATRICE },
    });

    //- Crée la fiche Creatrice si elle n'existe pas encore (userId n'est pas @unique → findFirst + create)
    const existing = await this.prisma.creatrice.findFirst({ where: { userId } });
    if (!existing) {
      await this.prisma.creatrice.create({
        data: {
          nom: [user.prenom, user.nom].filter(Boolean).join(' ') || user.email,
          email: user.email,
          tauxDeCommission: 0,
          userId,
          geranteId: userId,
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...userWithoutPassword } = updatedUser;
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

    //- Exclut le mot de passe et le refresh token hashé de la réponse — même pattern que getProfil
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...userWithoutPassword } = userUpdate;
    return userWithoutPassword;
  }

  //- Suppression de compte (droit à l'effacement RGPD, art. 17).
  //- On anonymise le compte plutôt que de supprimer la ligne User ou ses
  //- boutiques/créatrices/ventes : la loi française impose de conserver les
  //- données comptables 10 ans (Code de commerce), donc ces enregistrements
  //- doivent rester intacts et résolubles (FK) — seules les infos
  //- personnelles directement liées au compte (email, mot de passe, nom,
  //- avatar, notifications) sont scrubbed. Une créatrice/fiche gérée par ce
  //- compte n'est jamais supprimée ; seul son propre lien de compte l'est.
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    //- Résilie l'abonnement Stripe actif — sinon le compte est anonymisé
    //- mais Stripe continue de facturer un customer fantôme.
    //- Best-effort : un souci Stripe ne doit pas bloquer la suppression du compte.
    if (user.stripeCustomerId) {
      try {
        const subscriptions = await this.stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
        });
        for (const sub of subscriptions.data) {
          await this.stripe.subscriptions.cancel(sub.id);
        }
      } catch {
        // ignoré volontairement — voir commentaire ci-dessus
      }
    }

    await this.prisma.$transaction(async (tx) => {
      //- Si elle est elle-même une fiche créatrice (chez elle-même en DUO,
      //- ou chez une autre gérante) : on détache le compte, la fiche et son
      //- historique de ventes restent intacts pour la comptabilité.
      await tx.creatrice.updateMany({
        where: { userId },
        data: { userId: null },
      });

      //- Historique de notifications — aucune valeur comptable/légale,
      //- purement lié à l'usage de l'app, supprimé sans anonymisation.
      await tx.notification.deleteMany({ where: { userId } });

      //- Anonymise le compte. La ligne User reste (id, role, plan) pour que
      //- Boutique.geranteId / Creatrice.geranteId restent résolubles sur
      //- les enregistrements conservés — mais tout ce qui identifie la
      //- personne ou permettrait de se reconnecter disparaît.
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@encaissly.invalid`,
          password: await bcrypt.hash(randomUUID(), 12),
          nom: null,
          prenom: null,
          avatar: null,
          refreshToken: null,
          notificationsEmail: false,
          stripeCustomerId: null,
          deletedAt: new Date(),
        },
      });
    });

    return { message: 'Compte supprimé avec succès' };
  }
}
