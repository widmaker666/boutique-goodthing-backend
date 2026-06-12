import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';
import { PrismaService } from 'src/prisma.service';
import { QueryCreatrice } from './dto/query-creatrice.dto';
import { EmailService } from 'src/email/email.service';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class CreatriceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly ownership: OwnershipService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createCreatriceDto: CreateCreatriceDto, user: AuthUser) {
    //- La gérante connectée devient propriétaire de la fiche (geranteId)
    //- userId reste null à la création : il sera renseigné lors de inviteCreatrice
    //- quand la créatrice possèdera son propre compte
    const newCreateur = await this.prisma.creatrice.create({
      data: {
        ...createCreatriceDto,
        geranteId: user.id,
      },
    });
    return newCreateur;
  }

  async findAll(filters: QueryCreatrice, user: AuthUser) {
    //- Récupère les créatrices possédées par le user (finding sécu C1)
    //- GERANTE → ses créatrices ; CREATRICE → uniquement sa propre fiche
    //- Si les filtres sont undefined, Prisma les ignore automatiquement
    //- Include les ventes pour calculer nbVentes et ca côté JS
    const allData = await this.prisma.creatrice.findMany({
      where: {
        ...this.ownership.getOwnedCreatriceWhere(user),
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

  async findOne(id: string, user: AuthUser) {
    //- Vérifie l'ownership avant tout (404 si pas au user → ne leak pas l'existence)
    await this.ownership.assertCreatriceOwned(user, id);

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

  async update(id: string, updateCreatriceDto: UpdateCreatriceDto, user: AuthUser) {
    //- Vérifie l'ownership (et l'existence) avant la mise à jour
    await this.ownership.assertCreatriceOwned(user, id);

    //- Met à jour uniquement les champs fournis dans le DTO (grâce à PartialType)
    const updateCreateur = await this.prisma.creatrice.update({
      where: { id },
      data: updateCreatriceDto,
    });
    return updateCreateur;
  }

  async remove(id: string, user: AuthUser) {
    //- Vérifie l'ownership (et l'existence) avant la suppression
    await this.ownership.assertCreatriceOwned(user, id);

    //- Supprime dans une transaction pour garantir l'atomicité
    //- Ordre : dépendances d'abord, puis la créatrice elle-même
    await this.prisma.$transaction([
      this.prisma.vente.deleteMany({ where: { creatriceId: id } }),
      this.prisma.evenement.deleteMany({ where: { creatriceId: id } }),
      this.prisma.article.deleteMany({ where: { creatriceId: id } }),
      this.prisma.creatrice.delete({ where: { id } }),
    ]);

    return { message: 'Créatrice supprimée avec succès' };
  }

  //- Invite créatrice — notif in-app si User existant, email sinon
  async inviteCreatrice(
    creatriceId: string,
    email: string,
    boutiqueId: string,
    currentUser: AuthUser,
  ) {
    //- Vérifie que la créatrice appartient bien à la gérante appelante
    //- (controller restreint déjà à @Roles(Role.GERANTE))
    const creatrice = await this.ownership.assertCreatriceOwned(
      currentUser,
      creatriceId,
    );

    //- Vérifie aussi que la boutique cible appartient à la gérante — retourne la boutique pour son nom
    const boutique = await this.ownership.assertBoutiqueOwned(currentUser, boutiqueId);

    //- Cherche si un User (la créatrice invitée) avec cet email existe déjà
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      //- User existant → notification in-app pour consentement manuel (pas de lien direct)
      await this.notificationService.createForUser(
        user.id,
        'INVITATION_BOUTIQUE',
        `Tu as été invitée à rejoindre une boutique Encaissly.`,
        { creatriceId: creatrice.id, boutiqueId, boutiqueName: boutique.nom },
      );
      return { message: 'Invitation envoyée', linked: false };
    }

    //- Pas de compte → envoie un email d'invitation
    await this.emailService.sendInvitation(email, creatrice.nom);
    return { message: 'Invitation envoyée par email', linked: false };
  }

  //- Accepte une invitation INVITATION_BOUTIQUE — accessible à CREATRICE et GERANTE
  async acceptInvitation(creatriceId: string, boutiqueId: string, currentUser: AuthUser) {
    const creatrice = await this.prisma.creatrice.findUnique({ where: { id: creatriceId } });

    if (!creatrice) {
      throw new NotFoundException('Créatrice introuvable');
    }

    //- Vérifie que l'invitation est bien destinée à ce compte (via email)
    if (creatrice.email !== currentUser.email) {
      throw new ForbiddenException('Cette invitation ne vous est pas destinée');
    }

    //- Bloque si déjà lié — évite un double-link silencieux
    if (creatrice.userId) {
      throw new ConflictException('Déjà lié à un compte');
    }

    //- Lie le User à la fiche Creatrice
    await this.prisma.creatrice.update({
      where: { id: creatriceId },
      data: { userId: currentUser.id },
    });

    //- Ajoute en BoutiqueMember si boutiqueId fourni et pas déjà membre
    if (boutiqueId) {
      const alreadyMember = await this.prisma.boutiqueMember.findFirst({
        where: { memberId: currentUser.id, boutiqueMemberId: boutiqueId },
      });
      if (!alreadyMember) {
        await this.prisma.boutiqueMember.create({
          data: { memberId: currentUser.id, boutiqueMemberId: boutiqueId },
        });
      }
    }

    return { message: 'Invitation acceptée' };
  }
}
