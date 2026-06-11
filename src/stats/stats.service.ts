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

  async getGlobalStats(userId: string, role: string, plan: string) {
    let where: any = {};

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

    if (role === 'GERANTE') {
      const boutique = await this.prisma.boutique.findFirst({
        where: { geranteId: userId },
      });
      where = boutique
        ? { boutiqueId: boutique.id, ...dateFilter }
        : { ...dateFilter };
    } else {
      const creatrice = await this.prisma.creatrice.findFirst({
        where: { userId },
      });

      if (!creatrice) {
        return {
          stats: {
            _sum: { prixVente: 0 },
            _count: 0,
            _min: { prixVente: 0 },
            _max: { prixVente: 0 },
          },
          paiement: [],
          totalCommissions: 0,
        };
      }

      where = { creatriceId: creatrice.id, ...dateFilter };
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

    return { stats, paiement, totalCommissions };
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

  async getHistorique(userId: string, role: string) {
    let where: any = {};

    if (role === 'GERANTE') {
      const boutique = await this.prisma.boutique.findFirst({
        where: { geranteId: userId },
      });
      where = boutique ? { boutiqueId: boutique.id } : {};
    } else {
      const creatrice = await this.prisma.creatrice.findFirst({
        where: { userId },
      });
      where = creatrice ? { creatriceId: creatrice.id } : {};
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
