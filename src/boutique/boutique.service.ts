import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateBoutiqueDto } from './dto/create-boutique.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberStatusDto } from './dto/update-memberStatus.dto';
import { UpdatePlanMemberDto } from './dto/update-memberPlan.dto';

@Injectable()
export class BoutiqueService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const allData = await this.prisma.boutique.findMany({
      where: {
        boutiqueMembers: {
          some: {
            memberId: userId,
          },
        },
      },
    });
    return allData;
  }

  async createBoutique(createBoutique: CreateBoutiqueDto, geranteId: string) {
    const newBoutique = await this.prisma.boutique.create({
      data: { ...createBoutique, geranteId },
    });
    return newBoutique;
  }

  async createMember(createMember: CreateMemberDto, boutiqueId: string) {
    const newMemberOfBoutique = await this.prisma.boutiqueMember.create({
      data: {
        memberId: createMember.memberId,
        boutiqueMemberId: boutiqueId,
      },
    });
    return newMemberOfBoutique;
  }

  async updateMemberStatus(
    boutiqueId: string,
    updateMemberStatus: UpdateMemberStatusDto,
    memberId: string,
  ) {
    const isMemberExist = await this.prisma.boutiqueMember.findUnique({
      where: {
        memberId_boutiqueMemberId: {
          memberId: memberId,
          boutiqueMemberId: boutiqueId,
        },
      },
    });

    if (!isMemberExist) {
      throw new NotFoundException("Il n'y a aucun membre trouvé");
    }

    const updateMember = await this.prisma.boutiqueMember.update({
      where: {
        memberId_boutiqueMemberId: {
          memberId: memberId,
          boutiqueMemberId: boutiqueId,
        },
      },
      data: {
        status: updateMemberStatus.status,
      },
    });
    return updateMember;
  }

  async updatePlanMember(
    boutiqueId: string,
    updatePlanMember: UpdatePlanMemberDto,
    memberId: string,
  ) {
    const isMemberExist = await this.prisma.boutiqueMember.findUnique({
      where: {
        memberId_boutiqueMemberId: {
          memberId: memberId,
          boutiqueMemberId: boutiqueId,
        },
      },
    });

    if (!isMemberExist) {
      throw new NotFoundException('Membre non trouvé');
    }

    const updatedMember = await this.prisma.boutiqueMember.update({
      where: {
        memberId_boutiqueMemberId: {
          memberId: memberId,
          boutiqueMemberId: boutiqueId,
        },
      },
      data: {
        planMember: updatePlanMember.plan,
      },
    });
    return updatedMember;
  }

  async getBoutiqueStats(geranteId: string) {
    //- Récupère la boutique de la gérante
    const boutique = await this.prisma.boutique.findFirst({
      where: { geranteId },
      include: {
        _count: {
          select: { boutiqueMembers: true },
        },
      },
    });

    if (!boutique) return { nbCreatrices: 0, maxCreatrices: 3 };

    return {
      nbCreatrices: boutique._count.boutiqueMembers,
      maxCreatrices: 3,
      boutiqueNom: boutique.nom,
    };
  }

  async getBoutiquesAvecStats(geranteId: string) {
    const boutiques = await this.prisma.boutique.findMany({
      where: { geranteId },
      include: {
        _count: { select: { boutiqueMembers: true } },
        ventes: true,
      },
    });

    return boutiques.map((boutique) => ({
      id: boutique.id,
      nom: boutique.nom,
      nbCreatrices: boutique._count.boutiqueMembers,
      ca: boutique.ventes.reduce((acc, v) => acc + v.prixVente, 0),
      nbVentes: boutique.ventes.length,
    }));
  }
}
