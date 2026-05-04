import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateEvenementDto } from './dto/create-evenement.dto';
import { UpdateEvenementDto } from './dto/update-evenement.dto';

@Injectable()
export class EvenementService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEvenementDto) {
    return await this.prisma.evenement.create({
      data: dto,
    });
  }

  async findAll(creatriceId?: string) {
    return await this.prisma.evenement.findMany({
      where: creatriceId ? { creatriceId } : {},
      include: { ventes: true },
      orderBy: { dateDebut: 'desc' },
    });
  }

  async findOne(id: string) {
    const evenement = await this.prisma.evenement.findUnique({
      where: { id },
      include: { ventes: { include: { creatrice: true } } },
    });

    if (!evenement) throw new NotFoundException(`Événement ${id} introuvable`);

    //- Calcule le CA total de l'événement
    const ca = evenement.ventes.reduce((acc, v) => acc + v.prixVente, 0);

    return { ...evenement, ca, nbVentes: evenement.ventes.length };
  }

  async update(id: string, dto: UpdateEvenementDto) {
    const isExist = await this.prisma.evenement.findUnique({ where: { id } });
    if (!isExist) throw new NotFoundException(`Événement ${id} introuvable`);

    return this.prisma.evenement.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const isExist = await this.prisma.evenement.findUnique({ where: { id } });
    if (!isExist) throw new NotFoundException(`Événement ${id} introuvable`);

    return this.prisma.evenement.delete({ where: { id } });
  }
}
