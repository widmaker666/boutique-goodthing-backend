import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  //- Crée un article lié à une créatrice
  async create(dto: CreateArticleDto, creatriceId: string) {
    const { creatriceId: _ignored, ...rest } = dto;
    return this.prisma.article.create({
      data: {
        ...rest,
        creatriceId,
      },
    });
  }

  //- Retourne tous les articles, filtrables par créatrice et/ou nom
  async findAll(query: QueryArticleDto) {
    const { creatriceId, nom } = query;
    return this.prisma.article.findMany({
      where: {
        ...(creatriceId ? { creatriceId } : {}),
        ...(nom ? { nom: { contains: nom, mode: 'insensitive' } } : {}),
      },
      include: { creatrice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  //- Retourne un article par id — NotFoundException si absent
  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { creatrice: true },
    });
    if (!article) throw new NotFoundException(`Article ${id} introuvable`);
    return article;
  }

  //- Vérifie existence avant update
  async update(id: string, dto: UpdateArticleDto) {
    const isExist = await this.prisma.article.findUnique({ where: { id } });
    if (!isExist) throw new NotFoundException(`Article ${id} introuvable`);

    const { creatriceId, ...rest } = dto;
    return this.prisma.article.update({
      where: { id },
      data: rest,
    });
  }

  //- Vérifie existence avant delete
  async remove(id: string) {
    const isExist = await this.prisma.article.findUnique({ where: { id } });
    if (!isExist) throw new NotFoundException(`Article ${id} introuvable`);

    return this.prisma.article.delete({ where: { id } });
  }
}
