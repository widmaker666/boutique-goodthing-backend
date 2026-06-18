import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVenteDto } from './dto/create-vente.dto';
import { UpdateVenteDto } from './dto/update-vente.dto';
import { PrismaService } from 'src/prisma.service';
import { QueryVente } from './dto/query-vente.dto';
import { EmailService } from 'src/email/email.service';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class VenteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly ownership: OwnershipService,
    private readonly notificationService: NotificationService,
  ) {}
  async create(createVenteDto: CreateVenteDto, user: AuthUser, photoUrl?: string) {
    //- Vérifie que la créatrice liée à cette vente appartient bien au user
    //- (GERANTE: une de ses créatrices ; CREATRICE: sa propre fiche)
    //- 404 si pas possédée → bloque la création de vente sur une créatrice tierce
    await this.ownership.assertCreatriceOwned(user, createVenteDto.creatriceId);

    //- Auto-détecte la boutique si non fournie (GERANTE FREE = 1 boutique)
    //- Pour une CREATRICE, geranteId ne matchera aucune boutique → boutiqueId reste undefined
    let boutiqueId = createVenteDto.boutiqueId;
    if (boutiqueId) {
      //- Si fournie, vérifie que la boutique appartient bien au user gérant
      if (user.role === 'GERANTE' || user.role === 'GERANTE_CREATRICE') {
        await this.ownership.assertBoutiqueOwned(user, boutiqueId);
      }
    } else {
      const boutique = await this.prisma.boutique.findFirst({
        where: { geranteId: user.id },
      });
      boutiqueId = boutique?.id;
    }

    //- Extrait articleId et quantite du DTO — ces champs nécessitent un traitement séparé
    const { articleId, quantite, boutiqueId: _boutiqueId, ...venteData } = createVenteDto;

    //- Crée la vente en base et inclut les données de la créatrice
    //- include: { creatrice: true } permet d'accéder au taux de commission
    const createVente = await this.prisma.vente.create({
      data: { ...venteData, boutiqueId, quantite: quantite ?? 1, photo: photoUrl },
      include: { creatrice: true },
    });

    //- Décrémente le stock de l'article si articleId fourni
    //- updateMany avec quantite >= quantite demandée évite les stocks négatifs
    if (articleId) {
      await this.prisma.article.updateMany({
        where: { id: articleId, quantite: { gte: quantite ?? 1 } },
        data: { quantite: { decrement: quantite ?? 1 } },
      });
    }

    //- Calcule la commission et le net à reverser à la créatrice
    const prixVente = createVente.prixVente;
    const txCommission = createVente.creatrice.tauxDeCommission;

    const montantCommission = Math.round((prixVente * txCommission) / 100 * 100) / 100;
    const netCreatrice = Math.round((prixVente - montantCommission) * 100) / 100;

    //- Envoi email si la créatrice a un compte User avec notifications activées
    if (createVente.creatrice.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: createVente.creatrice.userId },
      });

      if (user && user.notificationsEmail && user.email) {
        await this.emailService.sendVenteNotification(
          user.email,
          createVente.creatrice.nom,
          createVente.nomArticle,
          createVente.prixVente,
          montantCommission,
          netCreatrice,
        );
      }
    }

    //- Envoi email à la gérante de la boutique via boutiqueId auto-détecté
    let boutique: { gerante: { id: string; email: string | null; notificationsEmail: boolean } } & Record<string, unknown> | null = null;
    if (boutiqueId) {
      boutique = await this.prisma.boutique.findUnique({
        where: { id: boutiqueId },
        include: { gerante: true },
      });
      if (boutique?.gerante?.notificationsEmail && boutique.gerante.email) {
        await this.emailService.sendVenteNotification(
          boutique.gerante.email,
          createVente.creatrice.nom,
          createVente.nomArticle,
          createVente.prixVente,
          montantCommission,
          netCreatrice,
        );
      }
    }

    //- Notifications in-app — try/catch pour ne pas faire rater la vente si échec
    try {
      if (createVente.creatrice.userId) {
        await this.notificationService.createForUser(
          createVente.creatrice.userId,
          'VENTE',
          `Vente enregistrée — ${createVente.nomArticle} · ${createVente.prixVente} € (net : ${netCreatrice} €)`,
        );
      }
      if (boutique?.gerante?.id) {
        await this.notificationService.createForUser(
          boutique.gerante.id,
          'VENTE',
          `Nouvelle vente — ${createVente.creatrice.nom} · ${createVente.nomArticle} · ${createVente.prixVente} €`,
        );
      }
    } catch {
      //- Echec notification non bloquant — la vente est déjà créée
    }

    //- Retourne la vente enrichie avec les calculs de commission
    return { ...createVente, montantCommission, netCreatrice };
  }

  async findAll(filters: QueryVente, user: AuthUser) {
    let ownershipWhere: any = await this.ownership.getVenteOwnershipWhere(user);

    //- Contexte événement — filtre les ventes de cet événement si possédé
    if (filters.evenementId) {
      const creatrice = await this.prisma.creatrice.findFirst({
        where: { userId: user.id },
      });
      if (creatrice) {
        const evenement = await this.prisma.evenement.findFirst({
          where: { id: filters.evenementId, creatriceId: creatrice.id },
        });
        if (evenement) ownershipWhere = { evenementId: evenement.id };
      }
    } else if (filters.boutiqueId) {
      const boutique = await this.prisma.boutique.findFirst({
        where: { id: filters.boutiqueId, geranteId: user.id },
      });
      if (boutique) ownershipWhere = { boutiqueId: boutique.id };
    }

    //- Récupère les ventes possédées avec filtres optionnels
    //- include: { creatrice: true } nécessaire pour calculer les commissions
    const allDataVente = await this.prisma.vente.findMany({
      where: {
        ...ownershipWhere,
        nomArticle: filters.nomArticle,
        prixVente: { gte: filters.minPrixVente, lte: filters.maxPrixVente },
        modePaiement: filters.modePaiement,
      },
      include: { creatrice: true, evenement: { select: { nom: true } } },
    });

    //- map() parcourt chaque vente pour y ajouter les calculs de commission
    return allDataVente.map((vente) => {
      const montantCommission = Math.round((vente.prixVente * vente.creatrice.tauxDeCommission) / 100 * 100) / 100;
      const netCreatrice = Math.round((vente.prixVente - montantCommission) * 100) / 100;
      return { ...vente, montantCommission, netCreatrice };
    });
  }

  async findOne(id: string, user: AuthUser) {
    //- Vérifie l'ownership (404 si pas possédée → ne leak pas l'existence)
    await this.ownership.assertVenteOwned(user, id);

    //- Cherche une vente par son id unique avec sa créatrice associée
    const oneVente = await this.prisma.vente.findUnique({
      where: { id },
      include: { creatrice: true },
    });

    //- Si la vente n'existe pas → erreur 404 Not Found
    if (!oneVente) {
      throw new NotFoundException(`Vente #${id} introuvable`);
    }

    //- Calcule la commission et le net pour cette vente
    const prixVente = oneVente.prixVente;
    const txCommission = oneVente.creatrice.tauxDeCommission;

    const montantCommission = Math.round((prixVente * txCommission) / 100 * 100) / 100;
    const netCreatrice = Math.round((prixVente - montantCommission) * 100) / 100;

    return { ...oneVente, montantCommission, netCreatrice };
  }

  async update(id: string, updateVenteDto: UpdateVenteDto, user: AuthUser) {
    //- Vérifie l'ownership de la vente avant la mise à jour
    await this.ownership.assertVenteOwned(user, id);

    //- Si le DTO tente de réassigner la vente à une autre créatrice/boutique,
    //- vérifie que la cible appartient aussi au user (anti-réassignation malveillante)
    if (updateVenteDto.creatriceId) {
      await this.ownership.assertCreatriceOwned(user, updateVenteDto.creatriceId);
    }
    if (updateVenteDto.boutiqueId && (user.role === 'GERANTE' || user.role === 'GERANTE_CREATRICE')) {
      await this.ownership.assertBoutiqueOwned(user, updateVenteDto.boutiqueId);
    }

    //- Exclut les champs non persistés directement sur Vente (articleId, quantite gérés à la création)
    const { articleId, ...venteData } = updateVenteDto;

    //- Met à jour uniquement les champs fournis dans le DTO (grâce à PartialType)
    const updateVente = await this.prisma.vente.update({
      where: { id },
      data: venteData,
    });

    return updateVente;
  }

  async remove(id: string, user: AuthUser) {
    //- Vérifie l'ownership de la vente avant la suppression
    await this.ownership.assertVenteOwned(user, id);

    //- Supprime définitivement la vente de la base
    const deleteVente = await this.prisma.vente.delete({
      where: { id },
    });

    return deleteVente;
  }

  async getRecentVentes(userId: string, role: string, limit = 5, boutiqueId?: string, evenementId?: string) {
    let where: any = {};

    if (evenementId) {
      const creatrice = await this.prisma.creatrice.findFirst({
        where: { userId },
      });
      if (creatrice) {
        const evenement = await this.prisma.evenement.findFirst({
          where: { id: evenementId, creatriceId: creatrice.id },
        });
        if (evenement) where = { evenementId };
      }
    }

    if (!Object.keys(where).length && boutiqueId) {
      const boutique = await this.prisma.boutique.findFirst({
        where: { id: boutiqueId, geranteId: userId },
      });
      if (boutique) where = { boutiqueId: boutique.id };
    }

    if (!Object.keys(where).length) {
      if (role === 'GERANTE' || role === 'GERANTE_CREATRICE') {
        const boutique = await this.prisma.boutique.findFirst({
          where: { geranteId: userId },
        });
        where = boutique ? { boutiqueId: boutique.id } : { id: 'none' };
      } else {
        const creatrice = await this.prisma.creatrice.findFirst({
          where: { userId },
        });
        where = creatrice ? { creatriceId: creatrice.id } : { id: 'none' };
      }
    }

    const ventes = await this.prisma.vente.findMany({
      where,
      include: { creatrice: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return ventes.map((vente) => {
      const montantCommission = Math.round((vente.prixVente * vente.creatrice.tauxDeCommission) / 100 * 100) / 100;
      const netCreatrice = Math.round((vente.prixVente - montantCommission) * 100) / 100;
      return { ...vente, montantCommission, netCreatrice };
    });
  }
}
