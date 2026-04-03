import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';
import { PrismaService } from 'src/prisma.service';
import { QueryCreatrice } from './dto/query-creatrice.dto';

@Injectable()
export class CreatriceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCreatriceDto: CreateCreatriceDto) {
    //- Crée une nouvelle créatrice en base avec les données du DTO
    const newCreateur = await this.prisma.creatrice.create({
      data: createCreatriceDto,
    });
    return newCreateur;
  }

  async findAll(filters: QueryCreatrice) {
    //- Récupère toutes les créatrices avec des filtres optionnels
    //- Si les filtres sont undefined, Prisma les ignore automatiquement
    const allData = await this.prisma.creatrice.findMany({
      where: {
        nom: filters.nom,
        tauxDeCommission: {
          gte: filters.minCommision, //- gte = greater than or equal (supérieur ou égal)
          lte: filters.maxCommision, //- lte = less than or equal (inférieur ou égal)
        },
      },
    });
    return allData;
  }

  async findOne(id: string) {
    //- Cherche une créatrice par son id unique
    //- where attend un objet — on ne passe jamais l'id directement
    const findData = await this.prisma.creatrice.findUnique({
      where: { id },
    });

    //- Si la créatrice n'existe pas → erreur 404 Not Found
    if (!findData) {
      throw new NotFoundException(`Createur ${id} introuvable`);
    }
    return findData;
  }

  async update(id: string, updateCreatriceDto: UpdateCreatriceDto) {
    //- Vérifie que la créatrice existe avant de tenter la mise à jour
    const isCreateurExist = await this.prisma.creatrice.findUnique({
      where: { id },
    });

    //- Si elle n'existe pas → erreur 404 Not Found
    if (!isCreateurExist) {
      throw new NotFoundException(`Createur ${id} introuvable`);
    }

    //- Met à jour uniquement les champs fournis dans le DTO (grâce à PartialType)
    const updateCreateur = await this.prisma.creatrice.update({
      where: { id },
      data: updateCreatriceDto,
    });
    return updateCreateur;
  }

  async remove(id: string) {
    //- Vérifie que la créatrice existe avant de tenter la suppression
    const isCreateurExist = await this.prisma.creatrice.findUnique({
      where: { id },
    });

    //- Si elle n'existe pas → erreur 404 Not Found
    if (!isCreateurExist) {
      throw new NotFoundException(`Createur ${id} introuvable`);
    }

    //- Supprime définitivement la créatrice de la base
    const removeCreateur = await this.prisma.creatrice.delete({
      where: { id },
    });
    return removeCreateur;
  }
}
