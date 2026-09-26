import PDFDocument from 'pdfkit';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { calculerCommission } from 'src/common/commission.util';

//- Forme minimale d'une vente pour les exports "détail des ventes"
//- (une ligne par vente, avec sa créatrice).
export interface VenteExport {
  nomArticle: string;
  prixVente: number;
  modePaiement: string;
  sansCommission: boolean;
  photo: string | null;
  createdAt: Date;
  creatrice: { nom: string; tauxDeCommission: number };
}

export interface PdfOptions {
  plan: string;
  sousTitre: string;
  filename: string;
  //- Photos = 1 requête réseau par vente : à réserver aux exports courts
  //- (fiche d'une créatrice), pas à l'export de toute une boutique.
  withPhotos: boolean;
}

const FONT = 'src/export/fonts/Archivo-Regular.ttf';
const FONT_BOLD = 'src/export/fonts/Archivo-Bold.ttf';
const PRIMARY = '#451e64';
const ACCENT = '#eb7f45';

//- Dates à l'heure de Paris (le serveur est en UTC : sans ça une vente de 00h30 s'affiche la veille)
const formatDate = (d: Date) =>
  new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

//- Une cellule CSV entre guillemets (valeurs calculées par nous : montants, dates…)
const csvCell = (value: string | number): string =>
  `"${String(value).replace(/"/g, '""')}"`;

//- Texte saisi par une utilisatrice (nom d'article, nom de créatrice) : la gérante
//- ouvre l'export dans Excel, un texte qui commence par = + - @ serait interprété
//- comme une formule (CSV injection) → on le neutralise avec une apostrophe.
//- À ne PAS appliquer aux montants calculés ("-10.00€" commence légitimement par -).
const csvText = (value: string): string =>
  csvCell(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

//- Tronque `text` pour qu'il tienne dans `width` avec la police/taille courantes du doc
const fit = (doc: PDFKit.PDFDocument, text: string, width: number): string => {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}...`) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
};

export async function renderVentesPdf(
  ventes: VenteExport[],
  res: Response,
  opts: PdfOptions,
) {
  //- Mode paysage
  const doc = new PDFDocument({ margin: 40, layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${opts.filename}`);
  doc.pipe(res);

  //- Colonnes (la colonne Photo n'existe que si les photos sont incluses)
  const c = opts.withPhotos
    ? { photo: 40, article: 80, articleW: 115, creatrice: 200, creatriceW: 95, taux: 300, prix: 355, commission: 425, net: 505, paiement: 590, date: 675 }
    : { photo: 0, article: 40, articleW: 160, creatrice: 205, creatriceW: 110, taux: 325, prix: 380, commission: 450, net: 530, paiement: 615, date: 700 };

  const PAGE_W = 842;
  const FOOTER_Y = 565;
  const MAX_ROW_Y = 545;

  const drawWatermark = () => {
    if (opts.plan !== 'FREE') return;
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
    if (opts.withPhotos) doc.text('Photo', c.photo, top + 8);
    doc.text('Article', c.article, top + 8);
    doc.text('Créatrice', c.creatrice, top + 8);
    doc.text('Taux com.', c.taux, top + 8);
    doc.text('Prix vente', c.prix, top + 8);
    doc.text('Commission', c.commission, top + 8);
    doc.text('Net créatrice', c.net, top + 8);
    doc.text('Paiement', c.paiement, top + 8);
    doc.text('Date', c.date, top + 8);
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
  doc.font(FONT).fontSize(11).fillColor(ACCENT).text(opts.sousTitre, 40, 52);
  doc.font(FONT).fontSize(9).fillColor('#aaaaaa').text(
    `Généré le ${formatDate(new Date())}`, 40, 90, { align: 'right' },
  );
  drawWatermark();

  const tableTop = 110;
  drawColHeaders(tableTop);
  let y = tableTop + 32;
  let totalPrixVente = 0;
  let totalCommission = 0;
  let totalNet = 0;

  for (const [index, vente] of ventes.entries()) {
    const { montantCommission, netCreatrice } = calculerCommission(
      vente.prixVente,
      vente.creatrice.tauxDeCommission,
      vente.sansCommission,
    );

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
    if (opts.withPhotos && vente.photo) {
      try {
        const jpgUrl = vente.photo.replace(/\.[^/.]+$/, '.jpg');
        const response = await fetch(jpgUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        doc.image(buffer, c.photo, y, { width: 28, height: 28 });
      } catch (error) {
        console.error('Erreur photo:', error);
      }
    }

    //- Un nom trop long est tronqué à la largeur de sa colonne (mesurée), il ne doit
    //- ni passer à la ligne ni déborder sur la colonne voisine
    doc.font(FONT).fontSize(9).fillColor('#222222');
    doc.text(fit(doc, vente.nomArticle, c.articleW), c.article, y + 10, { lineBreak: false });
    doc.text(fit(doc, vente.creatrice.nom, c.creatriceW), c.creatrice, y + 10, { lineBreak: false });
    doc.text(`${vente.creatrice.tauxDeCommission}%`, c.taux, y + 10);
    doc.font(FONT_BOLD).fillColor(PRIMARY).text(`${vente.prixVente.toFixed(2)}€`, c.prix, y + 10);
    doc.font(FONT).fillColor('#cc0000').text(`-${montantCommission.toFixed(2)}€`, c.commission, y + 10);
    doc.font(FONT_BOLD).fillColor('#1a7a4a').text(`${netCreatrice.toFixed(2)}€`, c.net, y + 10);
    doc.font(FONT).fillColor('#555555').text(vente.modePaiement, c.paiement, y + 10);
    doc.text(formatDate(vente.createdAt), c.date, y + 10);

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
  doc.font(FONT_BOLD).fontSize(10).fillColor(PRIMARY).text('TOTAUX', c.article, y);
  doc.font(FONT_BOLD).fillColor(PRIMARY).text(`${totalPrixVente.toFixed(2)}€`, c.prix, y);
  doc.font(FONT_BOLD).fillColor('#cc0000').text(`-${totalCommission.toFixed(2)}€`, c.commission, y);
  doc.font(FONT_BOLD).fillColor('#1a7a4a').text(`${totalNet.toFixed(2)}€`, c.net, y);

  drawPageFooter();
  doc.end();
}

export function renderVentesCsv(
  ventes: VenteExport[],
  res: Response,
  filename: string,
) {
  //- En-têtes CSV
  const lignes = [
    '"Article";"Créatrice";"Taux com.";"Prix vente";"Commission";"Net créatrice";"Paiement";"Date"',
  ];

  let totalPrixVente = 0;
  let totalCommission = 0;
  let totalNet = 0;

  //- Lignes de données
  for (const vente of ventes) {
    const { montantCommission, netCreatrice } = calculerCommission(
      vente.prixVente,
      vente.creatrice.tauxDeCommission,
      vente.sansCommission,
    );

    lignes.push(
      [
        csvText(vente.nomArticle),
        csvText(vente.creatrice.nom),
        csvCell(`${vente.creatrice.tauxDeCommission}%`),
        csvCell(`${vente.prixVente.toFixed(2)}€`),
        csvCell(`-${montantCommission.toFixed(2)}€`),
        csvCell(`${netCreatrice.toFixed(2)}€`),
        csvCell(vente.modePaiement),
        csvCell(formatDate(vente.createdAt)),
      ].join(';'),
    );

    totalPrixVente += vente.prixVente;
    totalCommission += montantCommission;
    totalNet += netCreatrice;
  }

  //- Ligne vide + totaux
  lignes.push('');
  lignes.push(
    `"TOTAL";;;"${totalPrixVente.toFixed(2)}€";"-${totalCommission.toFixed(2)}€";"${totalNet.toFixed(2)}€";;`,
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  //- BOM UTF-8 pour que Excel ouvre correctement les accents
  res.send('﻿' + lignes.join('\n'));
}

export async function renderVentesExcel(
  ventes: VenteExport[],
  res: Response,
  filename: string,
) {
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
  for (const [index, vente] of ventes.entries()) {
    const { montantCommission, netCreatrice } = calculerCommission(
      vente.prixVente,
      vente.creatrice.tauxDeCommission,
      vente.sansCommission,
    );

    const row = sheet.addRow({
      article: vente.nomArticle,
      creatrice: vente.creatrice.nom,
      taux: `${vente.creatrice.tauxDeCommission}%`,
      prixVente: vente.prixVente,
      commission: -montantCommission,
      net: netCreatrice,
      paiement: vente.modePaiement,
      date: formatDate(vente.createdAt),
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
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

  await workbook.xlsx.write(res);
  res.end();
}
