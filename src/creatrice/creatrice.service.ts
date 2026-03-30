import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';
import { PrismaService } from 'src/prisma.service';
import { QueryCreatrice } from './dto/query-creatrice.dto';

@Injectable()
export class CreatriceService {
  constructor(private prisma: PrismaService) {}

  async create(createCreatriceDto: CreateCreatriceDto) {
    const newCreateur = await this.prisma.creatrice.create({
      data: createCreatriceDto,
    });
    return newCreateur;
  }

  async findAll(filters: QueryCreatrice) {
    const allData = await this.prisma.creatrice.findMany({
      where: {
        nom: filters.nom,
        tauxDeCommission: {
          gte: filters.minCommision,
          lte: filters.maxCommision,
        },
      },
    });
    return allData;
  }

  async findOne(id: string) {
    const findData = await this.prisma.creatrice.findUnique({
      //le where attends un objet
      where: { id },
    });

    if (!findData) {
      throw new NotFoundException(`Createur ${id} introuvable`);
    }
    return findData;
  }

  async update(id: string, updateCreatriceDto: UpdateCreatriceDto) {
    const isCreateurExist = await this.prisma.creatrice.findUnique({
      //le where attends un objet
      where: { id },
    });

    if (!isCreateurExist) {
      throw new NotFoundException(`Createur ${id} introuvable`);
    }

    const updateCreateur = await this.prisma.creatrice.update({
      where: { id },
      data: updateCreatriceDto,
    });
    return updateCreateur;
  }

  async remove(id: string) {
    const isCreateurExist = await this.prisma.creatrice.findUnique({
      //le where attends un objet
      where: { id },
    });

    if (!isCreateurExist) {
      throw new NotFoundException(`Createur ${id} introuvable`);
    }

    const removeCreateur = await this.prisma.creatrice.delete({
      where: { id },
    });
    return removeCreateur;
  }
}
