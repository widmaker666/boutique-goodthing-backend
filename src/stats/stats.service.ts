import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalStats(userId: string, role: string) {
    //- Construit le filtre selon le rôle
    //- GERANTE → stats de sa boutique, CREATRICE → ses propres ventes
    let where = {};

    if (role === 'GERANTE') {
      //- Récupère la boutique de la gérante
      const boutique = await this.prisma.boutique.findFirst({
        where: { geranteId: userId },
      });
      where = boutique ? { boutiqueId: boutique.id } : {};
    } else {
      const creatrice = await this.prisma.creatrice.findFirst({
        where: { userId },
      });

      //- Si aucune créatrice liée → retourne des stats vides
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

      where = { creatriceId: creatrice.id };
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
    //- Agrège uniquement les ventes de cette créatrice :
    //- son CA, nombre de ventes, vente min et max
    const stats = await this.prisma.vente.aggregate({
      _sum: { prixVente: true },
      _count: true,
      _min: { prixVente: true },
      _max: { prixVente: true },
      where: { creatriceId: id },
    });

    //- Répartition espèces / carte uniquement pour cette créatrice
    const paiement = await this.prisma.vente.groupBy({
      by: ['modePaiement'],
      _count: true,
      _sum: { prixVente: true },
      where: { creatriceId: id },
    });

    //- Récupère toutes les ventes de cette créatrice avec ses infos
    //- pour calculer ses commissions et son net à reverser
    const ventesByCreatrice = await this.prisma.vente.findMany({
      include: { creatrice: true },
      where: { creatriceId: id },
    });

    //- Calcule le total des commissions à reverser à cette créatrice
    const totalCommissions = ventesByCreatrice.reduce((acc, vente) => {
      return acc + (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
    }, 0);

    //- Net à reverser = CA total - commissions boutique
    const netCreatrice = (stats._sum.prixVente ?? 0) - totalCommissions;

    return { stats, paiement, totalCommissions, netCreatrice };
  }
}
