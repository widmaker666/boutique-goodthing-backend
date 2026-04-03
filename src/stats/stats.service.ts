import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalStats() {
    //- Agrège les données de toutes les ventes :
    //- CA total, nombre de ventes, vente la moins chère et la plus chère
    const stats = await this.prisma.vente.aggregate({
      _sum: { prixVente: true },
      _count: true,
      _min: { prixVente: true },
      _max: { prixVente: true },
    });

    //- Groupe les ventes par mode de paiement (ESPECES / CARTE)
    //- pour connaître le CA et le nombre de ventes par type
    const paiement = await this.prisma.vente.groupBy({
      by: ['modePaiement'],
      _count: true,
      _sum: { prixVente: true },
    });

    //- Récupère toutes les ventes avec leur créatrice
    //- nécessaire pour accéder au taux de commission de chaque créatrice
    const ventes = await this.prisma.vente.findMany({
      include: { creatrice: true },
    });

    //- Calcule le total des commissions reversées à toutes les créatrices
    //- reduce() accumule les commissions vente par vente jusqu'à la dernière
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
