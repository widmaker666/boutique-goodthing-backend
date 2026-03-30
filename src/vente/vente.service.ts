import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVenteDto } from './dto/create-vente.dto';
import { UpdateVenteDto } from './dto/update-vente.dto';
import { PrismaService } from 'src/prisma.service';
import { QueryVente } from './dto/query-vente.dto';

@Injectable()
export class VenteService {
  constructor(private prisma: PrismaService) {}

  async create(createVenteDto: CreateVenteDto) {
    const isCreatriceExist = await this.prisma.creatrice.findUnique({
      where: {
        id: createVenteDto.creatriceId,
      },
    });

    if (!isCreatriceExist) {
      throw new NotFoundException("La créatrice avec cet id n'existe pas");
    }
    const createVente = await this.prisma.vente.create({
      data: createVenteDto,
      include: { creatrice: true },
    });

    const prixVente = createVente.prixVente;
    const txCommission = createVente.creatrice.tauxDeCommission;

    const montantCommission = (prixVente * txCommission) / 100;
    const netCreatrice = prixVente - montantCommission;
    return {
      ...createVente,
      montantCommission,
      netCreatrice,
    };
  }

  async findAll(filters: QueryVente) {
    const allDataVente = await this.prisma.vente.findMany({
      where: {
        nomArticle: filters.nomArticle,
        prixVente: { gte: filters.minPrixVente, lte: filters.maxPrixVente },
        modePaiement: filters.modePaiement,
      },
      include: { creatrice: true },
    });

    return allDataVente.map((vente) => {
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;
      return { ...vente, montantCommission, netCreatrice };
    });
  }

  async findOne(id: string) {
    const oneVente = await this.prisma.vente.findUnique({
      where: { id },
      include: { creatrice: true },
    });

    if (!oneVente) {
      throw new NotFoundException(`Vente #${id} introuvable`);
    }
    const prixVente = oneVente.prixVente;
    const txCommission = oneVente.creatrice.tauxDeCommission;

    const montantCommission = (prixVente * txCommission) / 100;
    const netCreatrice = prixVente - montantCommission;

    return { ...oneVente, montantCommission, netCreatrice };
  }

  async update(id: string, updateVenteDto: UpdateVenteDto) {
    const isUpdateVenteExist = await this.prisma.vente.findUnique({
      where: { id },
    });

    if (!isUpdateVenteExist) {
      throw new NotFoundException(`Vente #${id} introuvable`);
    }
    const updateVente = await this.prisma.vente.update({
      where: { id },
      data: updateVenteDto,
    });

    return updateVente;
  }

  async remove(id: string) {
    const isDeleteVenteExist = await this.prisma.vente.findUnique({
      where: { id },
    });

    if (!isDeleteVenteExist) {
      throw new NotFoundException(`Vente #${id} introuvable`);
    }
    const deleteVente = await this.prisma.vente.delete({
      where: { id },
    });

    return deleteVente;
  }
}
