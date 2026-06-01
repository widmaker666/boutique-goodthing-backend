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

    //- Synonymes acceptés par champ — insensible à la casse et aux accents
    const COLS = {
      nom:          ['nom', 'name', 'article', 'libelle', 'libellé', 'produit', 'titre', 'title'],
      prix:         ['prix', 'prixindicatif', 'prix_indicatif', 'price', 'tarif', 'cout', 'coût', 'montant'],
      description:  ['description', 'desc', 'detail', 'détail', 'details', 'détails', 'info'],
      quantite:     ['quantite', 'quantité', 'qty', 'stock', 'qte', 'qté', 'quantity'],
    };

    //- Trouve la première clé présente dans un objet parmi une liste de synonymes
    const get = (obj: Record<string, string>, keys: string[]): string =>
      keys.map(k => obj[k]).find(v => v !== undefined && v !== '') ?? '';

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const rows: { nom: string; description?: string; prixIndicatif?: number; quantite?: number }[] = [];

    if (ext === 'csv') {
      //- Parse CSV — séparateur virgule, point-virgule ou tabulation
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

        const prixRaw = get(row, COLS.prix);
        rows.push({
          nom,
          description: get(row, COLS.description) || undefined,
          prixIndicatif: prixRaw ? parseFloat(prixRaw.replace(',', '.')) : undefined,
          quantite: get(row, COLS.quantite) ? parseInt(get(row, COLS.quantite), 10) : undefined,
        });
      }
    } else {
      //- Parse Excel (.xlsx / .xls)
      const workbook = new ExcelJS.Workbook();
      //- Cast nécessaire : conflit entre @types/node v22 Buffer générique et Buffer ExcelJS
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
            headers.push(
              String(cell.value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
            ),
          );
          return;
        }
        const values = (row.values as ExcelJS.CellValue[]).slice(1);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = values[i] != null ? String(values[i]) : ''));

        const nom = get(obj, COLS.nom);
        if (!nom) return;

        const prixRaw = get(obj, COLS.prix);
        rows.push({
          nom,
          description: get(obj, COLS.description) || undefined,
          prixIndicatif: prixRaw ? parseFloat(prixRaw.replace(',', '.')) : undefined,
          quantite: get(obj, COLS.quantite) ? parseInt(get(obj, COLS.quantite), 10) : undefined,
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
