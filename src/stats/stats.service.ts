import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getStatsByCreatrice(id: string) {
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
}
