import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';

@Injectable()
export class ArticleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async create(dto: CreateArticleDto, user: AuthUser) {
    const { creatriceId, evenementId, ...rest } = dto;

    if (evenementId) {
      await this.ownership.assertEvenementOwned(user, evenementId);
      return this.prisma.article.create({ data: { ...rest, evenementId } });
    }

    const id = creatriceId ?? '';
    await this.ownership.assertCreatriceOwned(user, id);
    return this.prisma.article.create({ data: { ...rest, creatriceId: id } });
  }

  async findAll(query: QueryArticleDto, user: AuthUser) {
    const { creatriceId, evenementId, nom } = query;
    const nameFilter = nom ? { nom: { contains: nom, mode: 'insensitive' as const } } : {};

    if (evenementId) {
      await this.ownership.assertEvenementOwned(user, evenementId);
      return this.prisma.article.findMany({
        where: { evenementId, ...nameFilter },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.article.findMany({
      where: {
        creatrice: this.ownership.getOwnedCreatriceWhere(user),
        ...(creatriceId ? { creatriceId } : {}),
        ...nameFilter,
      },
      include: { creatrice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    await this.ownership.assertArticleOwned(user, id);

    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { creatrice: true },
    });
    if (!article) throw new NotFoundException(`Article ${id} introuvable`);
    return article;
  }

  async update(id: string, dto: UpdateArticleDto, user: AuthUser) {
    await this.ownership.assertArticleOwned(user, id);

    const { creatriceId, evenementId, ...rest } = dto as any;
    return this.prisma.article.update({ where: { id }, data: rest });
  }

  async importFromFile(
    file: Express.Multer.File,
    creatriceId: string | undefined,
    evenementId: string | undefined,
    user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (!creatriceId && !evenementId) throw new BadRequestException('creatriceId ou evenementId manquant');

    if (evenementId) {
      await this.ownership.assertEvenementOwned(user, evenementId);
    } else {
      await this.ownership.assertCreatriceOwned(user, creatriceId!);
    }

    const COLS = {
      nom:         ['nom', 'name', 'article', 'libelle', 'libellé', 'produit', 'titre', 'title'],
      prix:        ['prix', 'prixindicatif', 'prix_indicatif', 'price', 'tarif', 'cout', 'coût', 'montant'],
      description: ['description', 'desc', 'detail', 'détail', 'details', 'détails', 'info'],
      quantite:    ['quantite', 'quantité', 'qty', 'stock', 'qte', 'qté', 'quantity'],
    };

    const get = (obj: Record<string, string>, keys: string[]): string =>
      keys.map(k => obj[k]).find(v => v !== undefined && v !== '') ?? '';

    const toFloat = (val: unknown): number | undefined => {
      if (val == null || val === '') return undefined;
      if (typeof val === 'number') return isNaN(val) ? undefined : val;
      const str = String(val).replace(',', '.').replace(/[^\d.-]/g, '');
      const n = parseFloat(str);
      return isNaN(n) ? undefined : n;
    };

    const toInt = (val: unknown): number | undefined => {
      if (val == null || val === '') return undefined;
      if (typeof val === 'number') return isNaN(val) ? undefined : Math.round(val);
      const n = parseInt(String(val).replace(/[^\d]/g, ''), 10);
      return isNaN(n) ? undefined : n;
    };

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const rows: { nom: string; description?: string; prixIndicatif?: number; quantite?: number }[] = [];

    if (ext === 'csv') {
      const text = file.buffer.toString('utf-8').replace(/\r/g, '');
      const lines = text.split('\n').filter((l) => l.trim());
      const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => (row[h] = cols[idx]?.trim() ?? ''));
        const nom = get(row, COLS.nom);
        if (!nom) continue;
        rows.push({
          nom,
          description: get(row, COLS.description) || undefined,
          prixIndicatif: toFloat(get(row, COLS.prix)),
          quantite: toInt(get(row, COLS.quantite)),
        });
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      const ab = file.buffer.buffer.slice(
        file.buffer.byteOffset,
        file.buffer.byteOffset + file.buffer.byteLength,
      ) as ArrayBuffer;
      await workbook.xlsx.load(ab as any);
      const sheet = workbook.worksheets[0];
      const headers: string[] = [];

      sheet.eachRow((row, rowIndex) => {
        if (rowIndex === 1) {
          row.eachCell((cell) =>
            headers.push(String(cell.value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')),
          );
          return;
        }
        const values = (row.values as ExcelJS.CellValue[]).slice(1);
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => (obj[h] = values[i] ?? ''));
        const nom = obj[headers.find(h => COLS.nom.includes(h)) ?? ''];
        if (!nom) return;
        rows.push({
          nom: String(nom),
          description: String(obj[headers.find(h => COLS.description.includes(h)) ?? ''] ?? '') || undefined,
          prixIndicatif: toFloat(obj[headers.find(h => COLS.prix.includes(h)) ?? '']),
          quantite: toInt(obj[headers.find(h => COLS.quantite.includes(h)) ?? '']),
        });
      });
    }

    if (rows.length === 0) return { imported: 0, message: 'Aucune ligne valide trouvée' };

    const result = await this.prisma.article.createMany({
      data: rows.map((r) => evenementId ? { ...r, evenementId } : { ...r, creatriceId: creatriceId! }),
      skipDuplicates: true,
    });

    const skipped = rows.length - result.count;
    return {
      imported: result.count,
      skipped,
      message: skipped > 0
        ? `${result.count} article(s) importé(s), ${skipped} ignoré(s) (déjà existants)`
        : `${result.count} article(s) importé(s)`,
    };
  }

  async remove(id: string, user: AuthUser) {
    await this.ownership.assertArticleOwned(user, id);
    return this.prisma.article.delete({ where: { id } });
  }
}
