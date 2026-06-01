import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';
import { PrismaService } from 'src/prisma.service';
import { QueryCreatrice } from './dto/query-creatrice.dto';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class CreatriceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(createCreatriceDto: CreateCreatriceDto, userId: string) {
    const newCreateur = await this.prisma.creatrice.create({
      data: {
        ...createCreatriceDto,
        userId,
      },
    });
    return newCreateur;
  }

  async findAll(filters: QueryCreatrice) {
    //- Récupère toutes les créatrices avec des filtres optionnels
    //- Si les filtres sont undefined, Prisma les ignore automatiquement
    //- Include les ventes pour calculer nbVentes et ca côté JS
    const allData = await this.prisma.creatrice.findMany({
      where: {
        nom: filters.nom,
        tauxDeCommission: {
          gte: filters.minCommision, //- gte = greater than or equal (supérieur ou égal)
          lte: filters.maxCommision, //- lte = less than or equal (inférieur ou égal)
        },
      },
      include: {
        vente: { select: { prixVente: true } },
      },
    });

    //- Calcule nbVentes et ca (somme prixVente) pour chaque créatrice
    //- Destructure `vente` hors du spread pour ne pas l'exposer dans la réponse
    return allData.map(({ vente, ...creatrice }) => ({
      ...creatrice,
      nbVentes: vente.length,
      ca: vente.reduce((sum, v) => sum + v.prixVente, 0),
    }));
  }

  async findOne(id: string) {
    //- Cherche une créatrice par son id unique avec ses ventes
    const findData = await this.prisma.creatrice.findUnique({
      where: { id },
      include: {
        vente: {
          select: {
            id: true,
            nomArticle: true,
            prixVente: true,
            modePaiement: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    //- Si la créatrice n'existe pas → erreur 404 Not Found
    if (!findData) {
      throw new NotFoundException(`Createur ${id} introuvable`);
    }

    //- Destructure vente pour le renommer et calculer les stats
    const { vente, ...creatrice } = findData;
    const ca = vente.reduce((sum, v) => sum + v.prixVente, 0);
    const totalCommission = (ca * creatrice.tauxDeCommission) / 100;

    return {
      ...creatrice,
      ventes: vente,
      stats: {
        nbVentes: vente.length,
        ca,
        totalCommission,
        netCreatrice: ca - totalCommission,
      },
    };
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

  //- Invite créatrice par mail
  async inviteCreatrice(
    creatriceId: string,
    email: string,
    boutiqueId: string,
  ) {
    //- Vérifie que la créatrice existe
    const creatrice = await this.prisma.creatrice.findUnique({
      where: { id: creatriceId },
    });
    if (!creatrice) throw new NotFoundException('Créatrice introuvable');

    //- Cherche si un User avec cet email existe déjà
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      //- Lie directement le User au profil Creatrice
      await this.prisma.creatrice.update({
        where: { id: creatriceId },
        data: { userId: user.id },
      });

      //- Ajoute en BoutiqueMember
      await this.prisma.boutiqueMember.create({
        data: { memberId: user.id, boutiqueMemberId: boutiqueId },
      });

      return { message: 'Créatrice liée avec succès', linked: true };
    }

    //- Si pas de compte → envoie un email d'invitation
    await this.emailService.sendInvitation(email, creatrice.nom);
    return { message: 'Invitation envoyée', linked: false };
  }
}
