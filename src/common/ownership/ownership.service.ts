import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Role } from 'src/generated/enums';

//- Représentation minimale du user injecté dans req.user par JwtStrategy
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  plan: string;
}

//- Service centralisant le contrôle d'ownership (finding sécu C1 - IDOR)
//- Évite la duplication de la logique de scoping dans chaque service métier
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  //- Retourne le filtre Prisma des créatrices possédées par le user
  //- GERANTE / GERANTE_CREATRICE → fiches dont elle est gérante ; CREATRICE → sa propre fiche liée
  getOwnedCreatriceWhere(user: AuthUser) {
    if (user.role === Role.GERANTE || user.role === Role.GERANTE_CREATRICE) {
      return { geranteId: user.id };
    }
    return { userId: user.id };
  }

  //- Vérifie qu'une créatrice appartient au user — 404 sinon (ne leak pas l'existence)
  //- Retourne la créatrice pour réutilisation éventuelle par l'appelant
  async assertCreatriceOwned(user: AuthUser, creatriceId: string) {
    const creatrice = await this.prisma.creatrice.findFirst({
      where: { id: creatriceId, ...this.getOwnedCreatriceWhere(user) },
    });

    if (!creatrice) {
      throw new NotFoundException('Créatrice introuvable');
    }
    return creatrice;
  }

  //- Pour une CREATRICE / GERANTE_CREATRICE : retourne l'id de SA fiche liée (403 si pas encore liée)
  //- Pour une GERANTE pure : usage non pertinent → ForbiddenException
  async resolveOwnCreatriceId(user: AuthUser): Promise<string> {
    if (user.role !== Role.CREATRICE && user.role !== Role.GERANTE_CREATRICE) {
      throw new ForbiddenException('Réservé aux créatrices');
    }

    const creatrice = await this.prisma.creatrice.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!creatrice) {
      throw new ForbiddenException(
        'Aucune fiche créatrice liée à ce compte. Contactez votre gérante.',
      );
    }
    return creatrice.id;
  }

  //- Vérifie qu'une boutique appartient à la gérante connectée — 404 sinon
  async assertBoutiqueOwned(user: AuthUser, boutiqueId: string) {
    const boutique = await this.prisma.boutique.findFirst({
      where: { id: boutiqueId, geranteId: user.id },
    });

    if (!boutique) {
      throw new NotFoundException('Boutique introuvable');
    }
    return boutique;
  }

  //- Construit le filtre Prisma des ventes possédées par le user
  //- GERANTE / GERANTE_CREATRICE → ventes des créatrices qu'elle gère OU de ses boutiques
  //- CREATRICE → ventes de sa propre fiche liée
  //- Retourne un where impossible (id: 'none') si le user n'a aucune ressource liée
  async getVenteOwnershipWhere(user: AuthUser) {
    if (user.role === Role.GERANTE || user.role === Role.GERANTE_CREATRICE) {
      return {
        OR: [
          { creatrice: { geranteId: user.id } },
          { boutique: { geranteId: user.id } },
        ],
      };
    }

    const creatrice = await this.prisma.creatrice.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    return creatrice ? { creatriceId: creatrice.id } : { id: 'none' };
  }

  //- Vérifie qu'une vente appartient au user — 404 sinon
  async assertVenteOwned(user: AuthUser, venteId: string) {
    const ownershipWhere = await this.getVenteOwnershipWhere(user);
    const vente = await this.prisma.vente.findFirst({
      where: { id: venteId, ...ownershipWhere },
    });

    if (!vente) {
      throw new NotFoundException('Vente introuvable');
    }
    return vente;
  }

  //- Vérifie qu'un article appartient au user — via créatrice (GERANTE) OU via événement (CREATRICE)
  async assertArticleOwned(user: AuthUser, articleId: string) {
    const owned = this.getOwnedCreatriceWhere(user);
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        OR: [
          { creatrice: owned },
          { evenement: { creatrice: owned } },
        ],
      },
    });

    if (!article) {
      throw new NotFoundException('Article introuvable');
    }
    return article;
  }

  //- Vérifie qu'un événement appartient au user (via sa créatrice) — 404 sinon
  async assertEvenementOwned(user: AuthUser, evenementId: string) {
    const evenement = await this.prisma.evenement.findFirst({
      where: { id: evenementId, creatrice: this.getOwnedCreatriceWhere(user) },
    });

    if (!evenement) {
      throw new NotFoundException('Événement introuvable');
    }
    return evenement;
  }
}
