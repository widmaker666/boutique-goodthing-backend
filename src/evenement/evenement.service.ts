import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    await this.ownership.assertCreatriceOwned(user, dto.creatriceId);

    return await this.prisma.evenement.create({
      data: {
        nom: dto.nom,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : new Date(),
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
        creatriceId: dto.creatriceId,
      },
    });
  }

  //- Crée un événement pour la CREATRICE authentifiée — auto-crée la fiche Creatrice si besoin
  //- FREE : max 1 événement ; PRO : illimité
  async creerMonEvenement(userId: string, nom: string, plan: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const nomCreatrice =
      [user?.prenom, user?.nom].filter(Boolean).join(' ') ||
      user?.email ||
      'Moi';

    let creatrice = await this.prisma.creatrice.findFirst({
      where: { userId },
    });

    if (!creatrice) {
      creatrice = await this.prisma.creatrice.create({
        data: {
          nom: nomCreatrice,
          email: user?.email,
          tauxDeCommission: 0,
          userId,
          geranteId: userId,
        },
      });
    }

    if (plan === 'FREE') {
      const count = await this.prisma.evenement.count({
        where: { creatriceId: creatrice.id },
      });
      if (count >= 1) {
        throw new ForbiddenException(
          'Plan FREE : 1 événement maximum. Passez à PRO pour en créer davantage.',
        );
      }
    }

    return await this.prisma.evenement.create({
      data: { nom, dateDebut: new Date(), creatriceId: creatrice.id },
    });
  }

  async findAll(user: AuthUser, creatriceId?: string) {
    return await this.prisma.evenement.findMany({
      where: {
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
