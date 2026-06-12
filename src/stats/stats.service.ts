import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  private makeDateFilter(plan: string) {
    return plan === 'FREE'
      ? {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          },
        }
      : {};
  }

  async getGlobalStats(userId: string, role: string, plan: string, boutiqueId?: string, evenementId?: string) {
    let where: any = {};
    const dateFilter = this.makeDateFilter(plan);

    //- Contexte événement — CREATRICE qui veut voir les stats de son événement
    if (evenementId) {
      const evenement = await this.prisma.evenement.findFirst({
        where: { id: evenementId, creatrice: { userId } },
      });
      if (evenement) where = { evenementId: evenement.id, ...dateFilter };
    }

    //- Contexte boutique — GERANTE ou CREATRICE via l'ancienne boutique perso
    if (!Object.keys(where).length && boutiqueId) {
      const boutique = await this.prisma.boutique.findFirst({
        where: { id: boutiqueId, geranteId: userId },
      });
      if (boutique) where = { boutiqueId: boutique.id, ...dateFilter };
    }

    if (!Object.keys(where).length) {
      if (role === 'GERANTE') {
        const boutique = await this.prisma.boutique.findFirst({
          where: { geranteId: userId },
        });
        if (!boutique) {
          return {
            stats: { _sum: { prixVente: 0 }, _count: 0, _min: { prixVente: 0 }, _max: { prixVente: 0 } },
            paiement: [],
            totalCommissions: 0,
            previousPeriodCA: 0,
          };
        }
        where = { boutiqueId: boutique.id, ...dateFilter };
      } else {
        const creatrice = await this.prisma.creatrice.findFirst({
          where: { userId },
        });
        if (!creatrice) {
          return {
            stats: { _sum: { prixVente: 0 }, _count: 0, _min: { prixVente: 0 }, _max: { prixVente: 0 } },
            paiement: [],
            totalCommissions: 0,
            previousPeriodCA: 0,
          };
        }
        where = { creatriceId: creatrice.id, ...dateFilter };
      }
    }

    const stats = await this.prisma.vente.aggregate({
      _sum: { prixVente: true },
      _count: true,
      _min: { prixVente: true },
      _max: { prixVente: true },
      where,
    });

    const paiement = await this.prisma.vente.groupBy({
      by: ['modePaiement'],
      _count: true,
      _sum: { prixVente: true },
      where,
    });

    const ventes = await this.prisma.vente.findMany({
      include: { creatrice: true },
      where,
    });

    const totalCommissions = ventes.reduce((acc, vente) => {
      return acc + (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
    }, 0);

    //- Calcul période précédente pour comparaison CA (FREE = M-1, PRO = M-6 à M-3)
    const { createdAt: _currentDateFilter, ...scope } = where;
    const now = new Date();
    let previousWhere: any;

    if (plan === 'FREE') {
      previousWhere = {
        ...scope,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
        },
      };
    } else {
      previousWhere = {
        ...scope,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 6, 1),
          lte: new Date(now.getFullYear(), now.getMonth() - 3, 0, 23, 59, 59),
        },
      };
    }

    const previousStats = await this.prisma.vente.aggregate({
      _sum: { prixVente: true },
      where: previousWhere,
    });
    const previousPeriodCA: number = previousStats._sum.prixVente ?? 0;

    return { stats, paiement, totalCommissions, previousPeriodCA };
  }

  async getTopArticles(userId: string, role: string, plan: string, boutiqueId?: string, evenementId?: string) {
    let where: any = {};
    const dateFilter = this.makeDateFilter(plan);

    if (evenementId) {
      const evenement = await this.prisma.evenement.findFirst({
        where: { id: evenementId, creatrice: { userId } },
      });
      if (evenement) where = { evenementId: evenement.id, ...dateFilter };
    }

    if (!Object.keys(where).length && boutiqueId) {
      const boutique = await this.prisma.boutique.findFirst({
        where: { id: boutiqueId, geranteId: userId },
      });
      if (boutique) where = { boutiqueId: boutique.id, ...dateFilter };
    }

    if (!Object.keys(where).length) {
      if (role === 'GERANTE') {
        const boutique = await this.prisma.boutique.findFirst({
          where: { geranteId: userId },
        });
        if (!boutique) return [];
        where = { boutiqueId: boutique.id, ...dateFilter };
      } else {
        const creatrice = await this.prisma.creatrice.findFirst({
          where: { userId },
        });
        if (!creatrice) return [];
        where = { creatriceId: creatrice.id, ...dateFilter };
      }
    }

    const grouped = await this.prisma.vente.groupBy({
      by: ['nomArticle'],
      _count: { id: true },
      _sum: { prixVente: true, quantite: true },
      where,
      orderBy: { _sum: { prixVente: 'desc' } },
      take: 5,
    });

    return grouped.map((g) => ({
      nomArticle: g.nomArticle,
      nbVentes: g._count.id,
      quantite: g._sum.quantite ?? 0,
      ca: Math.round((g._sum.prixVente ?? 0) * 100) / 100,
    }));
  }

  async getParCreatrice(userId: string, plan: string) {
    //- Filtre par mois en cours pour les FREE
    const dateFilter =
      plan === 'FREE'
        ? {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              lte: new Date(
                new Date().getFullYear(),
                new Date().getMonth() + 1,
                0,
              ),
            },
          }
        : {};

    const boutique = await this.prisma.boutique.findFirst({
      where: { geranteId: userId },
    });

    if (!boutique) return [];

    const creatrices = await this.prisma.creatrice.findMany({
      where: { geranteId: userId },
      include: {
        vente: {
          where: { boutiqueId: boutique.id, ...dateFilter },
        },
      },
    });

    return creatrices.map((c) => {
      const ca = c.vente.reduce((acc, v) => acc + v.prixVente, 0);
      const commissions = (ca * c.tauxDeCommission) / 100;
      const net = ca - commissions;
      return {
        id: c.id,
        nom: c.nom,
        nbVentes: c.vente.length,
        ca: Math.round(ca * 100) / 100,
        commissions: Math.round(commissions * 100) / 100,
        net: Math.round(net * 100) / 100,
      };
    });
  }

  async getStatsByCreatrice(id: string, user: AuthUser) {
    //- Vérifie l'ownership de la créatrice avant d'exposer ses stats (finding sécu C1)
    await this.ownership.assertCreatriceOwned(user, id);

    const stats = await this.prisma.vente.aggregate({
      _sum: { prixVente: true },
      _count: true,
      _min: { prixVente: true },
      _max: { prixVente: true },
      where: { creatriceId: id },
    });

    const paiement = await this.prisma.vente.groupBy({
      by: ['modePaiement'],
      _count: true,
      _sum: { prixVente: true },
      where: { creatriceId: id },
    });

    const ventesByCreatrice = await this.prisma.vente.findMany({
      include: { creatrice: true },
      where: { creatriceId: id },
    });

    const totalCommissions = ventesByCreatrice.reduce((acc, vente) => {
      return acc + (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
    }, 0);

    const netCreatrice = (stats._sum.prixVente ?? 0) - totalCommissions;

    return { stats, paiement, totalCommissions, netCreatrice };
  }

  async getHistorique(userId: string, role: string, boutiqueId?: string, evenementId?: string) {
    let where: any = {};

    if (evenementId) {
      const evenement = await this.prisma.evenement.findFirst({
        where: { id: evenementId, creatrice: { userId } },
      });
      if (evenement) where = { evenementId: evenement.id };
    }

    if (!Object.keys(where).length && boutiqueId) {
      const boutique = await this.prisma.boutique.findFirst({
        where: { id: boutiqueId, geranteId: userId },
      });
      if (boutique) where = { boutiqueId: boutique.id };
    }

    if (!Object.keys(where).length) {
      if (role === 'GERANTE') {
        const boutique = await this.prisma.boutique.findFirst({
          where: { geranteId: userId },
        });
        if (!boutique) return [];
        where = { boutiqueId: boutique.id };
      } else {
        const creatrice = await this.prisma.creatrice.findFirst({
          where: { userId },
        });
        if (!creatrice) return [];
        where = { creatriceId: creatrice.id };
      }
    }

    //- Génère les 3 derniers mois
    const mois: { mois: string; ca: number; nbVentes: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const date = new Date();
      const debut = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const fin = new Date(date.getFullYear(), date.getMonth() - i + 1, 0);

      const stats = await this.prisma.vente.aggregate({
        _sum: { prixVente: true },
        _count: true,
        where: {
          ...where,
          createdAt: { gte: debut, lte: fin },
        },
      });

      mois.push({
        mois: debut.toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric',
        }),
        ca: stats._sum.prixVente ?? 0,
        nbVentes: stats._count,
      });
    }

    return mois;
  }
}
