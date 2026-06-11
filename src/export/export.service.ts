import { PrismaService } from './../prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  //* Documents CREATRICE *//
  async getExportPdf(user, res: Response) {
    //- Trouve la créatrice liée au user connecté
    const creatrice = await this.prismaService.creatrice.findFirst({
      where: { userId: user.id },
    });

    if (!creatrice) {
      throw new NotFoundException('Aucune créatrice liée à ce compte');
    }

    const allData = await this.prismaService.vente.findMany({
      where: { creatriceId: creatrice.id },
      include: { creatrice: true },
    });

    const FONT = 'src/export/fonts/Archivo-Regular.ttf';
    const FONT_BOLD = 'src/export/fonts/Archivo-Bold.ttf';
    const PRIMARY = '#451e64';
    const ACCENT = '#eb7f45';

    //- Mode paysage
    const doc = new PDFDocument({ margin: 40, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=export.pdf');
    doc.pipe(res);

    //- Colonnes
    const col0 = 40;
    const col1 = 80;
    const col2 = 210;
    const col3 = 320;
    const col4 = 400;
    const col5 = 490;
    const col6 = 590;
    const col7 = 700;

    const PAGE_W = 842;
    const FOOTER_Y = 565;
    const MAX_ROW_Y = 545;

    const drawWatermark = () => {
      if (user.plan !== 'FREE') return;
      doc.save();
      doc.font(FONT).fontSize(18).opacity(0.15).fillColor('#cc0000');
      for (let fy = 100; fy < 600; fy += 120) {
        for (let fx = -50; fx < 900; fx += 220) {
          doc.text('MODE GRATUIT', fx, fy, { lineBreak: false });
        }
      }
      doc.restore();
    };

    const drawColHeaders = (top: number) => {
      doc.rect(40, top, 780, 26).fill(ACCENT);
      doc.font(FONT_BOLD).fontSize(9).fillColor('white');
      doc.text('Photo', col0, top + 8);
      doc.text('Article', col1, top + 8);
      doc.text('Créatrice', col2, top + 8);
      doc.text('Taux com.', col3, top + 8);
      doc.text('Prix vente', col4, top + 8);
      doc.text('Commission', col5, top + 8);
      doc.text('Net créatrice', col6, top + 8);
      doc.text('Paiement', col7, top + 8);
    };

    const drawPageFooter = () => {
      doc.rect(0, FOOTER_Y, PAGE_W, 20).fill(PRIMARY);
      doc.font(FONT).fontSize(8).fillColor('#aaaaaa').text(
        'Encaissly — La caisse intelligente des boutiques de créateurs',
        40,
        FOOTER_Y + 4,
      );
    };

    //- Header première page
    doc.rect(0, 0, PAGE_W, 80).fill(PRIMARY);
    doc.font(FONT_BOLD).fontSize(26).fillColor('white').text('Encaissly', 40, 20);
    doc.font(FONT).fontSize(11).fillColor(ACCENT).text('Rapport des ventes', 40, 52);
    doc.font(FONT).fontSize(9).fillColor('#aaaaaa').text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')}`, 40, 90, { align: 'right' },
    );
    drawWatermark();

    const tableTop = 110;
    drawColHeaders(tableTop);
    let y = tableTop + 32;
    let totalPrixVente = 0;
    let totalCommission = 0;
    let totalNet = 0;

    for (const [index, vente] of allData.entries()) {
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;

      //- Saut de page si la prochaine ligne déborde
      if (y + 42 > MAX_ROW_Y) {
        drawPageFooter();
        doc.addPage();
        drawWatermark();
        const newTop = 30;
        drawColHeaders(newTop);
        y = newTop + 32;
      }

      if (index % 2 === 0) {
        doc.rect(40, y - 4, 780, 38).fill('#f7f7f7');
      }

      //- Photo
      if (vente.photo) {
        try {
          const jpgUrl = vente.photo.replace(/\.[^/.]+$/, '.jpg');
          const response = await fetch(jpgUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          doc.image(buffer, col0, y, { width: 28, height: 28 });
        } catch (error) {
          console.error('Erreur photo:', error);
        }
      }

      doc.font(FONT).fontSize(9).fillColor('#222222');
      doc.text(vente.nomArticle, col1, y + 10);
      doc.text(vente.creatrice.nom, col2, y + 10);
      doc.text(`${vente.creatrice.tauxDeCommission}%`, col3, y + 10);
      doc.font(FONT_BOLD).fillColor(PRIMARY).text(`${vente.prixVente.toFixed(2)}€`, col4, y + 10);
      doc.font(FONT).fillColor('#cc0000').text(`-${montantCommission.toFixed(2)}€`, col5, y + 10);
      doc.font(FONT_BOLD).fillColor('#1a7a4a').text(`${netCreatrice.toFixed(2)}€`, col6, y + 10);
      doc.font(FONT).fillColor('#555555').text(vente.modePaiement, col7, y + 10);

      totalPrixVente += vente.prixVente;
      totalCommission += montantCommission;
      totalNet += netCreatrice;
      y += 42;
    }

    //- Saut de page si les totaux ne tiennent pas (séparateur + ligne totaux ≈ 50px)
    if (y + 50 > MAX_ROW_Y) {
      drawPageFooter();
      doc.addPage();
      y = 40;
    }

    //- Séparateur
    doc.moveTo(40, y + 8).lineTo(820, y + 8).strokeColor(ACCENT).lineWidth(1.5).stroke();
    y += 20;

    //- Totaux
    doc.font(FONT_BOLD).fontSize(10).fillColor(PRIMARY).text('TOTAUX', col1, y);
    doc.font(FONT_BOLD).fillColor(PRIMARY).text(`${totalPrixVente.toFixed(2)}€`, col4, y);
    doc.font(FONT_BOLD).fillColor('#cc0000').text(`-${totalCommission.toFixed(2)}€`, col5, y);
    doc.font(FONT_BOLD).fillColor('#1a7a4a').text(`${totalNet.toFixed(2)}€`, col6, y);

    drawPageFooter();
    doc.end();
  }

  async getExportCsv(user, res: Response) {
    //- Trouve la créatrice liée au user connecté
    const creatrice = await this.prismaService.creatrice.findFirst({
      where: { userId: user.id },
    });

    if (!creatrice) {
      throw new NotFoundException('Aucune créatrice liée à ce compte');
    }

    const allData = await this.prismaService.vente.findMany({
      where: { creatriceId: creatrice.id },
      include: { creatrice: true },
    });

    //- En-têtes CSV
    const lignes = [
      '"Article";"Créatrice";"Taux com.";"Prix vente";"Commission";"Net créatrice";"Paiement";"Date"',
    ];

    let totalPrixVente = 0;
    let totalCommission = 0;
    let totalNet = 0;

    //- Lignes de données
    for (const vente of allData) {
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;

      lignes.push(
        `${vente.nomArticle};${vente.creatrice.nom};${vente.creatrice.tauxDeCommission}%;${vente.prixVente.toFixed(2)}€;-${montantCommission.toFixed(2)}€;${netCreatrice.toFixed(2)}€;${vente.modePaiement};${new Date(vente.createdAt).toLocaleDateString('fr-FR')}`,
      );

      totalPrixVente += vente.prixVente;
      totalCommission += montantCommission;
      totalNet += netCreatrice;
    }

    //- Ligne vide + totaux
    lignes.push('');
    lignes.push(
      `TOTAL;;;${totalPrixVente.toFixed(2)}€;-${totalCommission.toFixed(2)}€;${totalNet.toFixed(2)}€;;`,
    );

    const csv = lignes.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
    //- BOM UTF-8 pour que Excel ouvre correctement les accents
    res.send('\uFEFF' + csv);
  }

  async getExportExcel(user, res: Response) {
    const creatrice = await this.prismaService.creatrice.findFirst({
      where: { userId: user.id },
    });

    if (!creatrice) {
      throw new NotFoundException('Aucune créatrice liée à ce compte');
    }

    const allData = await this.prismaService.vente.findMany({
      where: { creatriceId: creatrice.id },
      include: { creatrice: true },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ventes');

    //- Largeurs des colonnes
    sheet.columns = [
      { header: 'Article', key: 'article', width: 25 },
      { header: 'Créatrice', key: 'creatrice', width: 20 },
      { header: 'Taux com.', key: 'taux', width: 12 },
      { header: 'Prix vente', key: 'prixVente', width: 14 },
      { header: 'Commission', key: 'commission', width: 14 },
      { header: 'Net créatrice', key: 'net', width: 14 },
      { header: 'Paiement', key: 'paiement', width: 12 },
      { header: 'Date', key: 'date', width: 14 },
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

    let totalPrixVente = 0;
    let totalCommission = 0;
    let totalNet = 0;

    //- Lignes de données
    for (const [index, vente] of allData.entries()) {
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;

      const row = sheet.addRow({
        article: vente.nomArticle,
        creatrice: vente.creatrice.nom,
        taux: `${vente.creatrice.tauxDeCommission}%`,
        prixVente: vente.prixVente,
        commission: -montantCommission,
        net: netCreatrice,
        paiement: vente.modePaiement,
        date: new Date(vente.createdAt).toLocaleDateString('fr-FR'),
      });

      //- Alternance couleur fond
      if (index % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F7F7' },
          };
        });
      }

      //- Couleur rouge pour commission
      row.getCell('commission').font = { color: { argb: 'FFCC0000' } };
      //- Couleur verte pour net
      row.getCell('net').font = { color: { argb: 'FF1A7A4A' }, bold: true };

      totalPrixVente += vente.prixVente;
      totalCommission += montantCommission;
      totalNet += netCreatrice;
    }

    //- Ligne vide
    sheet.addRow({});

    //- Ligne totaux
    const totalRow = sheet.addRow({
      article: 'TOTAL',
      prixVente: totalPrixVente,
      commission: -totalCommission,
      net: totalNet,
    });

    totalRow.eachCell((cell) => {
      cell.font = { bold: true };
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
    res.setHeader('Content-Disposition', 'attachment; filename=export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  }
  //* DOCUMENTS BOUTIQUE *//
  async getExportPdfBoutique(user: AuthUser, res: Response, boutiqueId?: string) {
    //- Auto-détecte la boutique si non fournie
    if (!boutiqueId) {
      const boutique = await this.prismaService.boutique.findFirst({ where: { geranteId: user.id } });
      if (!boutique) throw new NotFoundException('Aucune boutique trouvée');
      boutiqueId = boutique.id;
    }
    //- Vérifie que la boutique appartient à la gérante connectée (finding sécu C1)
    await this.ownership.assertBoutiqueOwned(user, boutiqueId);

    const allData = await this.prismaService.vente.findMany({
      where: { boutiqueId },
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
      'attachment; filename=export-boutique.pdf',
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
      .text('Rapport boutique', 40, 52);
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
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;

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
  ) {
    //- Auto-détecte la boutique si non fournie
    if (!boutiqueId) {
      const boutique = await this.prismaService.boutique.findFirst({ where: { geranteId: user.id } });
      if (!boutique) throw new NotFoundException('Aucune boutique trouvée');
      boutiqueId = boutique.id;
    }
    //- Vérifie que la boutique appartient à la gérante connectée (finding sécu C1)
    await this.ownership.assertBoutiqueOwned(user, boutiqueId);

    const allData = await this.prismaService.vente.findMany({
      where: { boutiqueId },
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
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;

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

    //- En-têtes
    const lignes = [
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
      'attachment; filename=export-boutique.csv',
    );
    res.send('\uFEFF' + csv);
  }

  async getExportExcelBoutique(
    boutiqueId: string | undefined,
    res: Response,
    user: AuthUser,
  ) {
    //- Auto-détecte la boutique si non fournie
    if (!boutiqueId) {
      const boutique = await this.prismaService.boutique.findFirst({ where: { geranteId: user.id } });
      if (!boutique) throw new NotFoundException('Aucune boutique trouvée');
      boutiqueId = boutique.id;
    }
    //- Vérifie que la boutique appartient à la gérante connectée (finding sécu C1)
    await this.ownership.assertBoutiqueOwned(user, boutiqueId);

    const allData = await this.prismaService.vente.findMany({
      where: { boutiqueId },
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
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;

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
      'attachment; filename=export-boutique.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
