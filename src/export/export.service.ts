import { PrismaService } from './../prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';
import { calculerCommission } from 'src/common/commission.util';
import {
  currentMois,
  MOIS_REGEX,
  moisLabel,
  moisRange,
} from 'src/common/month-range.util';
import {
  renderVentesCsv,
  renderVentesExcel,
  renderVentesPdf,
} from './ventes-renderer';

@Injectable()
export class ExportService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  //* Documents CREATRICE *//

  //- Choix du mois pour les rapports "classiques" (celui-ci et les 3
  //- rapports boutique ci-dessous) : contrairement au détail des ventes
  //- (getExportVentesGerante), omettre `mois` reste autorisé en FREE —
  //- "tout l'historique" n'a jamais été limité pour ce rapport, décision
  //- confirmée avec Alex le 2026-10 plutôt que de le restreindre en
  //- silence. Seul le choix d'un mois PASSÉ précis est réservé PRO/DUO.
  private resolveMoisClassique(user: AuthUser, mois?: string): string | undefined {
    if (mois === undefined) return undefined;
    if (!MOIS_REGEX.test(mois)) {
      throw new BadRequestException('Mois invalide (format attendu : AAAA-MM)');
    }
    if (user.plan === 'FREE' && mois !== currentMois()) {
      throw new ForbiddenException(
        "L'historique des mois passés est réservé aux plans PRO et DUO",
      );
    }
    return mois;
  }

  //- Ventes de la créatrice liée au user connecté (404 si aucune fiche liée)
  private async getVentesCreatrice(user, periode?: { debut: Date; fin: Date }) {
    const creatrice = await this.prismaService.creatrice.findFirst({
      where: { userId: user.id },
    });

    if (!creatrice) {
      throw new NotFoundException('Aucune créatrice liée à ce compte');
    }

    return this.prismaService.vente.findMany({
      where: {
        creatriceId: creatrice.id,
        ...(periode ? { createdAt: { gte: periode.debut, lt: periode.fin } } : {}),
      },
      include: { creatrice: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getExportPdf(user, res: Response, mois?: string) {
    const moisCible = this.resolveMoisClassique(user, mois);
    const periode = moisCible ? moisRange(moisCible) : undefined;
    const ventes = await this.getVentesCreatrice(user, periode);
    return renderVentesPdf(ventes, res, {
      plan: user.plan,
      sousTitre: moisCible ? `Rapport des ventes — ${moisLabel(moisCible)}` : 'Rapport des ventes',
      filename: moisCible ? `export-${moisCible}.pdf` : 'export.pdf',
      withPhotos: true,
    });
  }

  async getExportCsv(user, res: Response, mois?: string) {
    const moisCible = this.resolveMoisClassique(user, mois);
    const periode = moisCible ? moisRange(moisCible) : undefined;
    const ventes = await this.getVentesCreatrice(user, periode);
    return renderVentesCsv(ventes, res, moisCible ? `export-${moisCible}.csv` : 'export.csv');
  }

  async getExportExcel(user, res: Response, mois?: string) {
    const moisCible = this.resolveMoisClassique(user, mois);
    const periode = moisCible ? moisRange(moisCible) : undefined;
    const ventes = await this.getVentesCreatrice(user, periode);
    return renderVentesExcel(ventes, res, moisCible ? `export-${moisCible}.xlsx` : 'export.xlsx');
  }

  //* DÉTAIL DES VENTES (gérante) *//
  //- Une ligne par vente. Toute la boutique d'un coup, ou une seule créatrice
  //- (creatriceId). Périmètre toujours vérifié via la relation réelle en base
  //- (boutique dont elle est gérante / créatrice qu'elle gère) — jamais via le
  //- rôle stocké seul, un compte DUO n'ayant pas de "mode" côté serveur.
  //- mois ("AAAA-MM", heure de Paris) : restreint aux ventes de ce mois ; absent =
  //- tout l'historique. FREE : mois en cours uniquement (les mois passés → 403) ;
  //- le PDF-only est appliqué par le @Plans du controller sur csv/excel.
  async getExportVentesGerante(
    user: AuthUser,
    res: Response,
    format: 'pdf' | 'csv' | 'excel',
    boutiqueId?: string,
    creatriceId?: string,
    mois?: string,
  ) {
    if (mois !== undefined && !MOIS_REGEX.test(mois)) {
      throw new BadRequestException('Mois invalide (format attendu : AAAA-MM)');
    }
    const boutique = boutiqueId
      ? await this.ownership.assertBoutiqueOwned(user, boutiqueId)
      : null;
    const creatrice = creatriceId
      ? await this.ownership.assertCreatriceOwned(user, creatriceId)
      : null;

    const isFree = user.plan === 'FREE';
    let moisCible = mois;
    if (isFree) {
      const moisCourant = currentMois();
      if (moisCible && moisCible !== moisCourant) {
        throw new ForbiddenException(
          "L'historique des mois passés est réservé aux plans PRO et DUO",
        );
      }
      moisCible = moisCourant;
    }
    const periode = moisCible ? moisRange(moisCible) : null;

    const ventes = await this.prismaService.vente.findMany({
      where: {
        //- Sans boutique précisée : toutes SES boutiques (jamais les événements
        //- personnels d'une créatrice, qui n'ont pas de boutiqueId)
        ...(boutique
          ? { boutiqueId: boutique.id }
          : { boutique: { geranteId: user.id } }),
        ...(creatrice ? { creatriceId: creatrice.id } : {}),
        ...(periode
          ? { createdAt: { gte: periode.debut, lt: periode.fin } }
          : {}),
      },
      include: { creatrice: true },
      orderBy: [{ creatrice: { nom: 'asc' } }, { createdAt: 'asc' }],
    });

    const sousTitre =
      (creatrice ? `Ventes de ${creatrice.nom}` : 'Toutes les ventes') +
      (boutique ? ` — ${boutique.nom}` : '') +
      ` — ${moisCible ? moisLabel(moisCible) : "tout l'historique"}`;
    const base = creatrice ? 'ventes-creatrice' : 'ventes-boutique';

    switch (format) {
      case 'pdf':
        return renderVentesPdf(ventes, res, {
          plan: user.plan,
          sousTitre,
          filename: `${base}.pdf`,
          withPhotos: false,
        });
      case 'csv':
        return renderVentesCsv(ventes, res, `${base}.csv`);
      case 'excel':
        return renderVentesExcel(ventes, res, `${base}.xlsx`);
    }
  }

  //* DOCUMENTS BOUTIQUE *//
  async getExportPdfBoutique(user: AuthUser, res: Response, boutiqueId?: string, mois?: string) {
    //- Auto-détecte la boutique si non fournie
    if (!boutiqueId) {
      const boutique = await this.prismaService.boutique.findFirst({ where: { geranteId: user.id } });
      if (!boutique) throw new NotFoundException('Aucune boutique trouvée');
      boutiqueId = boutique.id;
    }
    //- Vérifie que la boutique appartient à la gérante connectée (finding sécu C1)
    await this.ownership.assertBoutiqueOwned(user, boutiqueId);

    const moisCible = this.resolveMoisClassique(user, mois);
    const periode = moisCible ? moisRange(moisCible) : undefined;

    const allData = await this.prismaService.vente.findMany({
      where: {
        boutiqueId,
        ...(periode ? { createdAt: { gte: periode.debut, lt: periode.fin } } : {}),
      },
      include: { creatrice: true },
    });

    const FONT = 'src/export/fonts/Archivo-Regular.ttf';
    const FONT_BOLD = 'src/export/fonts/Archivo-Bold.ttf';
    const PRIMARY = '#451e64';
    const ACCENT = '#eb7f45';

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=export-boutique${moisCible ? `-${moisCible}` : ''}.pdf`,
    );
    doc.pipe(res);

    //- Filigrane FREE
    if (user.plan === 'FREE') {
      doc.save();
      doc.font(FONT).fontSize(18).opacity(0.15).fillColor('#cc0000');
      for (let fy = 100; fy < 800; fy += 120) {
        for (let fx = -50; fx < 700; fx += 220) {
          doc.text('MODE GRATUIT', fx, fy, { lineBreak: false });
        }
      }
      doc.restore();
    }

    //- Header
    doc.rect(0, 0, 612, 80).fill(PRIMARY);
    doc
      .font(FONT_BOLD)
      .fontSize(26)
      .fillColor('white')
      .text('Encaissly', 40, 20);
    doc
      .font(FONT)
      .fontSize(11)
      .fillColor(ACCENT)
      .text(moisCible ? `Rapport boutique — ${moisLabel(moisCible)}` : 'Rapport boutique', 40, 52);
    doc
      .font(FONT)
      .fontSize(9)
      .fillColor('#aaaaaa')
      .text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 40, 90, {
        align: 'right',
      });

    //- Calcul résumé par créatrice
    const resumeParCreatrice: Record<
      string,
      {
        nom: string;
        taux: number;
        total: number;
        commission: number;
        net: number;
      }
    > = {};

    let totalCA = 0;
    let totalCommission = 0;
    let totalNet = 0;

    for (const vente of allData) {
      const { montantCommission, netCreatrice } = calculerCommission(
        vente.prixVente,
        vente.creatrice.tauxDeCommission,
        vente.sansCommission,
      );

      if (!resumeParCreatrice[vente.creatriceId]) {
        resumeParCreatrice[vente.creatriceId] = {
          nom: vente.creatrice.nom,
          taux: vente.creatrice.tauxDeCommission,
          total: 0,
          commission: 0,
          net: 0,
        };
      }

      resumeParCreatrice[vente.creatriceId].total += vente.prixVente;
      resumeParCreatrice[vente.creatriceId].commission += montantCommission;
      resumeParCreatrice[vente.creatriceId].net += netCreatrice;

      totalCA += vente.prixVente;
      totalCommission += montantCommission;
      totalNet += netCreatrice;
    }

    //- Colonnes
    const col1 = 40,
      col2 = 180,
      col3 = 270,
      col4 = 380,
      col5 = 480;

    const PAGE_W_P = 612;
    const FOOTER_Y_P = 780;
    const MAX_ROW_Y_P = 760;

    const drawColHeadersP = (top: number) => {
      doc.rect(40, top, 530, 26).fill(ACCENT);
      doc.font(FONT_BOLD).fontSize(10).fillColor('white');
      doc.text('Créatrice', col1, top + 8);
      doc.text('Taux', col2, top + 8);
      doc.text('CA total', col3, top + 8);
      doc.text('Commission', col4, top + 8);
      doc.text('Net créatrice', col5, top + 8);
    };

    const drawPageFooterP = () => {
      doc.rect(0, FOOTER_Y_P, PAGE_W_P, 20).fill(PRIMARY);
      doc.font(FONT).fontSize(8).fillColor('#aaaaaa').text(
        'Encaissly — La caisse intelligente des boutiques de créateurs',
        40,
        FOOTER_Y_P + 4,
      );
    };

    //- Tableau résumé par créatrice
    const tableTop = 115;
    drawColHeadersP(tableTop);
    let y = tableTop + 32;

    const creatriceEntries = Object.values(resumeParCreatrice);
    for (let index = 0; index < creatriceEntries.length; index++) {
      const c = creatriceEntries[index];

      //- Saut de page si la prochaine ligne déborde (26px/ligne)
      if (y + 26 > MAX_ROW_Y_P) {
        drawPageFooterP();
        doc.addPage();
        const newTop = 30;
        drawColHeadersP(newTop);
        y = newTop + 32;
      }

      if (index % 2 === 0) doc.rect(40, y - 4, 530, 26).fill('#f7f7f7');
      doc.font(FONT).fontSize(10).fillColor('#222222').text(c.nom, col1, y);
      doc.font(FONT).fillColor('#555555').text(`${c.taux}%`, col2, y);
      doc.font(FONT_BOLD).fillColor(PRIMARY).text(`${c.total.toFixed(2)}€`, col3, y);
      doc.font(FONT).fillColor('#cc0000').text(`-${c.commission.toFixed(2)}€`, col4, y);
      doc.font(FONT_BOLD).fillColor('#1a7a4a').text(`${c.net.toFixed(2)}€`, col5, y);
      y += 26;
    }

    //- Saut de page si le total global ne tient pas (séparateur + rect 36px ≈ 75px)
    if (y + 75 > MAX_ROW_Y_P) {
      drawPageFooterP();
      doc.addPage();
      y = 40;
    }

    //- Séparateur
    doc.moveTo(40, y + 10).lineTo(570, y + 10).strokeColor(ACCENT).lineWidth(1.5).stroke();
    y += 25;

    //- Total global
    doc.rect(40, y, 530, 36).fill(PRIMARY);
    doc.font(FONT_BOLD).fontSize(11).fillColor('white');
    doc.text('TOTAL BOUTIQUE', col1, y + 11);
    doc.text(`${totalCA.toFixed(2)}€`, col3, y + 11);
    doc.fillColor('#ff9999').text(`-${totalCommission.toFixed(2)}€`, col4, y + 11);
    doc.fillColor('#66ffaa').text(`${totalNet.toFixed(2)}€`, col5, y + 11);

    drawPageFooterP();
    doc.end();
  }

  async getExportCsvBoutique(
    boutiqueId: string | undefined,
    res: Response,
    user: AuthUser,
    mois?: string,
  ) {
    //- Auto-détecte la boutique si non fournie
    if (!boutiqueId) {
      const boutique = await this.prismaService.boutique.findFirst({ where: { geranteId: user.id } });
      if (!boutique) throw new NotFoundException('Aucune boutique trouvée');
      boutiqueId = boutique.id;
    }
    //- Vérifie que la boutique appartient à la gérante connectée (finding sécu C1)
    await this.ownership.assertBoutiqueOwned(user, boutiqueId);

    const moisCible = this.resolveMoisClassique(user, mois);
    const periode = moisCible ? moisRange(moisCible) : undefined;

    const allData = await this.prismaService.vente.findMany({
      where: {
        boutiqueId,
        ...(periode ? { createdAt: { gte: periode.debut, lt: periode.fin } } : {}),
      },
      include: { creatrice: true },
    });

    //- Calcul résumé par créatrice
    const resumeParCreatrice: Record<
      string,
      {
        nom: string;
        taux: number;
        total: number;
        commission: number;
        net: number;
      }
    > = {};

    let totalCA = 0;
    let totalCommission = 0;
    let totalNet = 0;

    for (const vente of allData) {
      const { montantCommission, netCreatrice } = calculerCommission(
        vente.prixVente,
        vente.creatrice.tauxDeCommission,
        vente.sansCommission,
      );

      if (!resumeParCreatrice[vente.creatriceId]) {
        resumeParCreatrice[vente.creatriceId] = {
          nom: vente.creatrice.nom,
          taux: vente.creatrice.tauxDeCommission,
          total: 0,
          commission: 0,
          net: 0,
        };
      }

      resumeParCreatrice[vente.creatriceId].total += vente.prixVente;
      resumeParCreatrice[vente.creatriceId].commission += montantCommission;
      resumeParCreatrice[vente.creatriceId].net += netCreatrice;

      totalCA += vente.prixVente;
      totalCommission += montantCommission;
      totalNet += netCreatrice;
    }

    //- En-têtes (+ ligne de période si un mois précis est demandé)
    //- Texte généré côté serveur (jamais saisi par une créatrice) : pas
    //- besoin de neutralisation anti-injection de formule ici.
    const lignes = [
      `"Période";"${moisCible ? moisLabel(moisCible) : "Tout l'historique"}"`,
      '',
      '"Créatrice";"Taux com.";"CA total";"Commission";"Net créatrice"',
    ];

    //- Lignes par créatrice
    for (const c of Object.values(resumeParCreatrice)) {
      lignes.push(
        `${c.nom};${c.taux}%;${c.total.toFixed(2)}€;-${c.commission.toFixed(2)}€;${c.net.toFixed(2)}€`,
      );
    }

    //- Ligne vide + totaux
    lignes.push('');
    lignes.push(
      `"TOTAL BOUTIQUE";;${totalCA.toFixed(2)}€;-${totalCommission.toFixed(2)}€;${totalNet.toFixed(2)}€`,
    );

    const csv = lignes.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=export-boutique${moisCible ? `-${moisCible}` : ''}.csv`,
    );
    res.send('\uFEFF' + csv);
  }

  async getExportExcelBoutique(
    boutiqueId: string | undefined,
    res: Response,
    user: AuthUser,
    mois?: string,
  ) {
    //- Auto-détecte la boutique si non fournie
    if (!boutiqueId) {
      const boutique = await this.prismaService.boutique.findFirst({ where: { geranteId: user.id } });
      if (!boutique) throw new NotFoundException('Aucune boutique trouvée');
      boutiqueId = boutique.id;
    }
    //- Vérifie que la boutique appartient à la gérante connectée (finding sécu C1)
    await this.ownership.assertBoutiqueOwned(user, boutiqueId);

    const moisCible = this.resolveMoisClassique(user, mois);
    const periode = moisCible ? moisRange(moisCible) : undefined;

    const allData = await this.prismaService.vente.findMany({
      where: {
        boutiqueId,
        ...(periode ? { createdAt: { gte: periode.debut, lt: periode.fin } } : {}),
      },
      include: { creatrice: true },
    });

    const resumeParCreatrice: Record<
      string,
      {
        nom: string;
        taux: number;
        total: number;
        commission: number;
        net: number;
      }
    > = {};

    let totalCA = 0;
    let totalCommission = 0;
    let totalNet = 0;

    for (const vente of allData) {
      const { montantCommission, netCreatrice } = calculerCommission(
        vente.prixVente,
        vente.creatrice.tauxDeCommission,
        vente.sansCommission,
      );

      if (!resumeParCreatrice[vente.creatriceId]) {
        resumeParCreatrice[vente.creatriceId] = {
          nom: vente.creatrice.nom,
          taux: vente.creatrice.tauxDeCommission,
          total: 0,
          commission: 0,
          net: 0,
        };
      }

      resumeParCreatrice[vente.creatriceId].total += vente.prixVente;
      resumeParCreatrice[vente.creatriceId].commission += montantCommission;
      resumeParCreatrice[vente.creatriceId].net += netCreatrice;

      totalCA += vente.prixVente;
      totalCommission += montantCommission;
      totalNet += netCreatrice;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rapport boutique');

    //- Colonnes
    sheet.columns = [
      { header: 'Créatrice', key: 'creatrice', width: 25 },
      { header: 'Taux com.', key: 'taux', width: 12 },
      { header: 'CA total', key: 'total', width: 14 },
      { header: 'Commission', key: 'commission', width: 14 },
      { header: 'Net créatrice', key: 'net', width: 14 },
    ];

    //- Style en-têtes
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEB7F45' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    //- Ligne de période au-dessus des en-têtes (décale la ligne stylée vers
    //- le bas — ExcelJS conserve le style avec la ligne lors de l'insertion)
    sheet.insertRow(1, [`Période : ${moisCible ? moisLabel(moisCible) : "Tout l'historique"}`]);
    sheet.mergeCells('A1:E1');
    sheet.getRow(1).font = { italic: true, color: { argb: 'FF888888' } };

    //- Lignes par créatrice
    Object.values(resumeParCreatrice).forEach((c, index) => {
      const row = sheet.addRow({
        creatrice: c.nom,
        taux: `${c.taux}%`,
        total: c.total,
        commission: -c.commission,
        net: c.net,
      });

      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F7F7' },
          };
        });
      }

      row.getCell('commission').font = { color: { argb: 'FFCC0000' } };
      row.getCell('net').font = { color: { argb: 'FF1A7A4A' }, bold: true };
    });

    //- Ligne vide
    sheet.addRow({});

    //- Total boutique
    const totalRow = sheet.addRow({
      creatrice: 'TOTAL BOUTIQUE',
      total: totalCA,
      commission: -totalCommission,
      net: totalNet,
    });

    totalRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF311B42' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=export-boutique${moisCible ? `-${moisCible}` : ''}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
