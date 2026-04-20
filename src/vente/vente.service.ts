import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVenteDto } from './dto/create-vente.dto';
import { UpdateVenteDto } from './dto/update-vente.dto';
import { PrismaService } from 'src/prisma.service';
import { QueryVente } from './dto/query-vente.dto';

@Injectable()
export class VenteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createVenteDto: CreateVenteDto, photoUrl?: string) {
    //- Vérifie que la créatrice liée à cette vente existe bien en base
    //- Évite de créer une vente orpheline avec un creatriceId invalide
    const isCreatriceExist = await this.prisma.creatrice.findUnique({
      where: { id: createVenteDto.creatriceId },
    });

    //- Si la créatrice n'existe pas → erreur 404 Not Found
    if (!isCreatriceExist) {
      throw new NotFoundException("La créatrice avec cet id n'existe pas");
    }

    //- Crée la vente en base et inclut les données de la créatrice
    //- include: { creatrice: true } permet d'accéder au taux de commission
    const createVente = await this.prisma.vente.create({
      data: { ...createVenteDto, photo: photoUrl },
      include: { creatrice: true },
    });

    //- Calcule la commission et le net à reverser à la créatrice
    const prixVente = createVente.prixVente;
    const txCommission = createVente.creatrice.tauxDeCommission;

    const montantCommission = (prixVente * txCommission) / 100;
    const netCreatrice = prixVente - montantCommission;

    //- Retourne la vente enrichie avec les calculs de commission
    return { ...createVente, montantCommission, netCreatrice };
  }

  async findAll(filters: QueryVente) {
    //- Récupère toutes les ventes avec filtres optionnels
    //- include: { creatrice: true } nécessaire pour calculer les commissions
    const allDataVente = await this.prisma.vente.findMany({
      where: {
        nomArticle: filters.nomArticle,
        prixVente: { gte: filters.minPrixVente, lte: filters.maxPrixVente },
        modePaiement: filters.modePaiement,
      },
      include: { creatrice: true },
    });

    //- map() parcourt chaque vente pour y ajouter les calculs de commission
    return allDataVente.map((vente) => {
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;
      return { ...vente, montantCommission, netCreatrice };
    });
  }

  async findOne(id: string) {
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

    const montantCommission = (prixVente * txCommission) / 100;
    const netCreatrice = prixVente - montantCommission;

    return { ...oneVente, montantCommission, netCreatrice };
  }

  async update(id: string, updateVenteDto: UpdateVenteDto) {
    //- Vérifie que la vente existe avant de tenter la mise à jour
    const isUpdateVenteExist = await this.prisma.vente.findUnique({
      where: { id },
    });

    //- Si la vente n'existe pas → erreur 404 Not Found
    if (!isUpdateVenteExist) {
      throw new NotFoundException(`Vente #${id} introuvable`);
    }

    //- Met à jour uniquement les champs fournis dans le DTO (grâce à PartialType)
    const updateVente = await this.prisma.vente.update({
      where: { id },
      data: updateVenteDto,
    });

    return updateVente;
  }

  async remove(id: string) {
    //- Vérifie que la vente existe avant de tenter la suppression
    const isDeleteVenteExist = await this.prisma.vente.findUnique({
      where: { id },
    });

    //- Si la vente n'existe pas → erreur 404 Not Found
    if (!isDeleteVenteExist) {
      throw new NotFoundException(`Vente #${id} introuvable`);
    }

    //- Supprime définitivement la vente de la base
    const deleteVente = await this.prisma.vente.delete({
      where: { id },
    });

    return deleteVente;
  }
}
