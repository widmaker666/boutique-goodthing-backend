import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from 'src/generated/enums';
import { PrismaService } from 'src/prisma.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import Stripe from 'stripe';

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
  //- Règle : on supprime tout ce que CE compte possède/gère (boutiques,
  //- créatrices qu'il gère, ventes, événements, articles) — mais on ne
  //- touche JAMAIS au compte (User) d'une AUTRE personne. Une créatrice
  //- employée par une gérante supprimée perd sa fiche/historique chez cette
  //- gérante, mais garde son propre login intact (juste délié).
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    //- Résilie l'abonnement Stripe actif avant suppression — sinon le
    //- compte disparaît mais Stripe continue de facturer un customer fantôme.
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
      //- 1. Boutiques qu'elle possède (GERANTE) → suppression totale de tout
      //-    ce qui en dépend (ventes de la boutique, appartenances membres)
      const boutiques = await tx.boutique.findMany({
        where: { geranteId: userId },
        select: { id: true },
      });
      const boutiqueIds = boutiques.map((b) => b.id);
      if (boutiqueIds.length) {
        await tx.vente.deleteMany({ where: { boutiqueId: { in: boutiqueIds } } });
        await tx.boutiqueMember.deleteMany({
          where: { boutiqueMemberId: { in: boutiqueIds } },
        });
        await tx.boutique.deleteMany({ where: { id: { in: boutiqueIds } } });
      }

      //- 2. Ses propres appartenances (créatrice invitée dans D'AUTRES boutiques)
      await tx.boutiqueMember.deleteMany({ where: { memberId: userId } });

      //- 3. Créatrices qu'elle gère (geranteId = elle) → fiches + historique
      //-    supprimés intégralement (inclut sa propre fiche auto-gérée si
      //-    GERANTE_CREATRICE, puisque geranteId = userId dans ce cas aussi)
      const creatricesGerees = await tx.creatrice.findMany({
        where: { geranteId: userId },
        select: { id: true },
      });
      const creatriceIds = creatricesGerees.map((c) => c.id);
      if (creatriceIds.length) {
        const evenements = await tx.evenement.findMany({
          where: { creatriceId: { in: creatriceIds } },
          select: { id: true },
        });
        const evenementIds = evenements.map((e) => e.id);
        if (evenementIds.length) {
          await tx.vente.deleteMany({ where: { evenementId: { in: evenementIds } } });
          //- Les articles liés à l'événement sont en cascade DB (schema.prisma)
          await tx.evenement.deleteMany({ where: { id: { in: evenementIds } } });
        }
        //- Ventes restantes de ces créatrices (sans boutique ni événement)
        await tx.vente.deleteMany({ where: { creatriceId: { in: creatriceIds } } });
        //- Articles liés directement à la créatrice : cascade DB également
        await tx.creatrice.deleteMany({ where: { id: { in: creatriceIds } } });
      }

      //- 4. Si elle est elle-même la fiche créatrice d'une AUTRE gérante,
      //-    on détache seulement — son compte disparaît, la fiche/l'historique
      //-    reste pour la comptabilité de cette gérante (comme à l'auto-link
      //-    à l'inscription). Les fiches où geranteId = userId ont déjà été
      //-    supprimées à l'étape 3, donc ce updateMany ne touche que les
      //-    fiches gérées par quelqu'un d'autre.
      await tx.creatrice.updateMany({
        where: { userId },
        data: { userId: null },
      });

      //- 5. Le compte lui-même — les Notification liées sont en cascade DB
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'Compte supprimé avec succès' };
  }
}
