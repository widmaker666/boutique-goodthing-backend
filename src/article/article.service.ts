import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
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

  //- Import bulk depuis fichier CSV ou Excel
  async importFromFile(file: Express.Multer.File, creatriceId: string) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (!creatriceId) throw new BadRequestException('creatriceId manquant');

    //- Vérifie que la créatrice existe
    const creatrice = await this.prisma.creatrice.findUnique({ where: { id: creatriceId } });
    if (!creatrice) throw new NotFoundException('Créatrice introuvable');

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const rows: { nom: string; description?: string; prixIndicatif?: number; quantite?: number }[] = [];

    if (ext === 'csv') {
      //- Parse CSV manuellement (séparateur virgule ou point-virgule)
      const text = file.buffer.toString('utf-8');
      const lines = text.split('\n').filter((l) => l.trim());
      const headers = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => (row[h] = cols[idx]?.trim() ?? ''));
        if (row.nom)
          rows.push({
            nom: row.nom,
            description: row.description || undefined,
            prixIndicatif: row.prixindicatif
              ? parseFloat(row.prixindicatif.replace(',', '.'))
              : undefined,
            quantite: row.quantite ? parseInt(row.quantite, 10) : undefined,
          });
      }
    } else {
      //- Parse Excel (.xlsx / .xls)
      const workbook = new ExcelJS.Workbook();
      //- Cast nécessaire : conflit entre @types/node v22 Buffer générique et Buffer ExcelJS (extends ArrayBuffer)
      const ab = file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength,
      ) as ArrayBuffer;
      await workbook.xlsx.load(ab as any);
      const sheet = workbook.worksheets[0];
      const headers: string[] = [];

      sheet.eachRow((row, rowIndex) => {
        if (rowIndex === 1) {
          row.eachCell((cell) => headers.push(String(cell.value ?? '').trim().toLowerCase()));
          return;
        }
        const values = (row.values as ExcelJS.CellValue[]).slice(1);
        const obj: Record<string, ExcelJS.CellValue> = {};
        headers.forEach((h, i) => (obj[h] = values[i] ?? ''));
        if (obj.nom)
          rows.push({
            nom: String(obj.nom),
            description: obj.description ? String(obj.description) : undefined,
            prixIndicatif: obj.prixindicatif
              ? parseFloat(String(obj.prixindicatif).replace(',', '.'))
              : undefined,
            quantite: obj.quantite ? parseInt(String(obj.quantite), 10) : undefined,
          });
      });
    }

    if (rows.length === 0) return { imported: 0, message: 'Aucune ligne valide trouvée' };

    //- Création en bulk
    await this.prisma.article.createMany({
      data: rows.map((r) => ({ ...r, creatriceId })),
      skipDuplicates: true,
    });

    return { imported: rows.length, message: `${rows.length} article(s) importé(s)` };
  }

  //- Vérifie existence avant delete
  async remove(id: string) {
    const isExist = await this.prisma.article.findUnique({ where: { id } });
    if (!isExist) throw new NotFoundException(`Article ${id} introuvable`);

    return this.prisma.article.delete({ where: { id } });
  }
}
