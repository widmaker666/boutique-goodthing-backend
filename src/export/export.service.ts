import { PrismaService } from './../prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class ExportService {
  constructor(private readonly prismaService: PrismaService) {}

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
    const PRIMARY = '#311b42';
    const ACCENT = '#eb7f45';

    //- Mode paysage
    const doc = new PDFDocument({ margin: 40, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=export.pdf');
    doc.pipe(res);

    //- Header
    doc.rect(0, 0, 842, 80).fill(PRIMARY);
    doc
      .font(FONT_BOLD)
      .fontSize(26)
      .fillColor('white')
      .text('Encaissly', 40, 20);
    doc
      .font(FONT)
      .fontSize(11)
      .fillColor(ACCENT)
      .text('Rapport des ventes', 40, 52);
    doc
      .font(FONT)
      .fontSize(9)
      .fillColor('#aaaaaa')
      .text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 40, 90, {
        align: 'right',
      });

    //- Filigrane FREE
    if (user.plan === 'FREE') {
      doc.save();
      doc.font(FONT).fontSize(18).opacity(0.15).fillColor('#cc0000');
      for (let fy = 100; fy < 600; fy += 120) {
        for (let fx = -50; fx < 900; fx += 220) {
          doc.text('MODE GRATUIT', fx, fy, { lineBreak: false });
        }
      }
      doc.restore();
    }

    //- Colonnes
    const tableTop = 110;
    const col0 = 40; //- photo
    const col1 = 80; //- article
    const col2 = 210; //- créatrice
    const col3 = 320; //- taux com
    const col4 = 400; //- prix vente
    const col5 = 490; //- commission
    const col6 = 590; //- net créatrice
    const col7 = 700; //- paiement

    //- En-têtes
    doc.rect(40, tableTop, 780, 26).fill(ACCENT);
    doc.font(FONT_BOLD).fontSize(9).fillColor('white');
    doc.text('Photo', col0, tableTop + 8);
    doc.text('Article', col1, tableTop + 8);
    doc.text('Créatrice', col2, tableTop + 8);
    doc.text('Taux com.', col3, tableTop + 8);
    doc.text('Prix vente', col4, tableTop + 8);
    doc.text('Commission', col5, tableTop + 8);
    doc.text('Net créatrice', col6, tableTop + 8);
    doc.text('Paiement', col7, tableTop + 8);

    //- Lignes
    let y = tableTop + 32;
    let totalPrixVente = 0;
    let totalCommission = 0;
    let totalNet = 0;

    for (const [index, vente] of allData.entries()) {
      const montantCommission =
        (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
      const netCreatrice = vente.prixVente - montantCommission;

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
      doc
        .font(FONT_BOLD)
        .fillColor(PRIMARY)
        .text(`${vente.prixVente.toFixed(2)}€`, col4, y + 10);
      doc
        .font(FONT)
        .fillColor('#cc0000')
        .text(`-${montantCommission.toFixed(2)}€`, col5, y + 10);
      doc
        .font(FONT_BOLD)
        .fillColor('#1a7a4a')
        .text(`${netCreatrice.toFixed(2)}€`, col6, y + 10);
      doc
        .font(FONT)
        .fillColor('#555555')
        .text(vente.modePaiement, col7, y + 10);

      totalPrixVente += vente.prixVente;
      totalCommission += montantCommission;
      totalNet += netCreatrice;
      y += 42;
    }

    //- Séparateur
    doc
      .moveTo(40, y + 8)
      .lineTo(820, y + 8)
      .strokeColor(ACCENT)
      .lineWidth(1.5)
      .stroke();
    y += 20;

    //- Totaux
    doc.font(FONT_BOLD).fontSize(10).fillColor(PRIMARY).text('TOTAUX', col1, y);
    doc
      .font(FONT_BOLD)
      .fillColor(PRIMARY)
      .text(`${totalPrixVente.toFixed(2)}€`, col4, y);
    doc
      .font(FONT_BOLD)
      .fillColor('#cc0000')
      .text(`-${totalCommission.toFixed(2)}€`, col5, y);
    doc
      .font(FONT_BOLD)
      .fillColor('#1a7a4a')
      .text(`${totalNet.toFixed(2)}€`, col6, y);

    //- Footer
    doc.rect(0, 565, 842, 20).fill(PRIMARY);
    doc
      .font(FONT)
      .fontSize(8)
      .fillColor('#aaaaaa')
      .text(
        'Encaissly — La caisse intelligente des boutiques de créateurs',
        40,
        569,
      );

    doc.end();
  }

  async getExportPdfBoutique(user, res: Response, boutiqueId: string) {
    const allData = await this.prismaService.vente.findMany({
      where: { boutiqueId },
      include: { creatrice: true },
    });

    const FONT = 'src/export/fonts/Archivo-Regular.ttf';
    const FONT_BOLD = 'src/export/fonts/Archivo-Bold.ttf';
    const PRIMARY = '#1a1a2e';
    const ACCENT = '#e94560';

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

    //- Tableau résumé par créatrice
    const tableTop = 115;
    const col1 = 40,
      col2 = 180,
      col3 = 270,
      col4 = 380,
      col5 = 480;

    doc.rect(40, tableTop, 530, 26).fill(ACCENT);
    doc.font(FONT_BOLD).fontSize(10).fillColor('white');
    doc.text('Créatrice', col1, tableTop + 8);
    doc.text('Taux', col2, tableTop + 8);
    doc.text('CA total', col3, tableTop + 8);
    doc.text('Commission', col4, tableTop + 8);
    doc.text('Net créatrice', col5, tableTop + 8);

    let y = tableTop + 32;

    Object.values(resumeParCreatrice).forEach((c, index) => {
      if (index % 2 === 0) doc.rect(40, y - 4, 530, 26).fill('#f7f7f7');
      doc.font(FONT).fontSize(10).fillColor('#222222').text(c.nom, col1, y);
      doc.font(FONT).fillColor('#555555').text(`${c.taux}%`, col2, y);
      doc
        .font(FONT_BOLD)
        .fillColor(PRIMARY)
        .text(`${c.total.toFixed(2)}€`, col3, y);
      doc
        .font(FONT)
        .fillColor('#cc0000')
        .text(`-${c.commission.toFixed(2)}€`, col4, y);
      doc
        .font(FONT_BOLD)
        .fillColor('#1a7a4a')
        .text(`${c.net.toFixed(2)}€`, col5, y);
      y += 26;
    });

    //- Séparateur
    doc
      .moveTo(40, y + 10)
      .lineTo(570, y + 10)
      .strokeColor(ACCENT)
      .lineWidth(1.5)
      .stroke();
    y += 25;

    //- Total global
    doc.rect(40, y, 530, 36).fill(PRIMARY);
    doc.font(FONT_BOLD).fontSize(11).fillColor('white');
    doc.text('TOTAL BOUTIQUE', col1, y + 11);
    doc.text(`${totalCA.toFixed(2)}€`, col3, y + 11);
    doc
      .fillColor('#ff9999')
      .text(`-${totalCommission.toFixed(2)}€`, col4, y + 11);
    doc.fillColor('#66ffaa').text(`${totalNet.toFixed(2)}€`, col5, y + 11);

    //- Footer
    doc.rect(0, 780, 612, 20).fill(PRIMARY);
    doc
      .font(FONT)
      .fontSize(8)
      .fillColor('#aaaaaa')
      .text(
        'Encaissly — La caisse intelligente des boutiques de créateurs',
        40,
        784,
      );

    doc.end();
  }

  async getExportExcel() {}
  async getExportExcelBoutique(boutiqueId) {}

  async getExportCsv() {}
  async getExportCsvBoutique(boutiqueId) {}
}
