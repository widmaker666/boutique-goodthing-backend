import { PrismaService } from './../prisma.service';
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class ExportService {
  constructor(private readonly prismaService: PrismaService) {}

  async getExportPdf(user, res: Response) {
    const allData = await this.prismaService.vente.findMany({
      include: { creatrice: true },
    });

    const FONT = 'src/export/fonts/Archivo-Regular.ttf';
    const FONT_BOLD = 'src/export/fonts/Archivo-Bold.ttf';
    const PRIMARY = '#311b42';
    const ACCENT = '#eb7f45';

    //- Mode paysage
    const doc = new PDFDocument({ margin: 40, layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    // Pour développer — affiche dans le navigateur
    res.setHeader('Content-Disposition', 'inline; filename=export.pdf');

    // Pour prod — télécharge
    //res.setHeader('Content-Disposition', 'attachment; filename=export.pdf');
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

  async getExportExcel() {}

  async getExportCsv() {}
}
