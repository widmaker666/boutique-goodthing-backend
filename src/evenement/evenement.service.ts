import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateEvenementDto } from './dto/create-evenement.dto';
import { UpdateEvenementDto } from './dto/update-evenement.dto';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';

@Injectable()
export class EvenementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async create(dto: CreateEvenementDto, user: AuthUser) {
    //- Vérifie que la créatrice cible appartient au user (404 sinon)
    await this.ownership.assertCreatriceOwned(user, dto.creatriceId);

    return await this.prisma.evenement.create({
      data: dto,
    });
  }

  async findAll(user: AuthUser, creatriceId?: string) {
    return await this.prisma.evenement.findMany({
      where: {
        //- Scope obligatoire : événements des créatrices possédées (finding sécu C1)
        creatrice: this.ownership.getOwnedCreatriceWhere(user),
        ...(creatriceId ? { creatriceId } : {}),
      },
      include: { ventes: true },
      orderBy: { dateDebut: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    await this.ownership.assertEvenementOwned(user, id);

    const evenement = await this.prisma.evenement.findUnique({
      where: { id },
      include: { ventes: { include: { creatrice: true } } },
    });

    if (!evenement) throw new NotFoundException(`Événement ${id} introuvable`);

    //- Calcule le CA total de l'événement
    const ca = evenement.ventes.reduce((acc, v) => acc + v.prixVente, 0);

    return { ...evenement, ca, nbVentes: evenement.ventes.length };
  }

  async update(id: string, dto: UpdateEvenementDto, user: AuthUser) {
    await this.ownership.assertEvenementOwned(user, id);

    //- Si réassignation de créatrice, vérifie aussi l'ownership de la cible
    if (dto.creatriceId) {
      await this.ownership.assertCreatriceOwned(user, dto.creatriceId);
    }

    return this.prisma.evenement.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthUser) {
    await this.ownership.assertEvenementOwned(user, id);

    return this.prisma.evenement.delete({ where: { id } });
  }
}
