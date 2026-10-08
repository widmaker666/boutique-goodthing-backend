import { PassThrough } from 'stream';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import {
  renderVentesCsv,
  renderVentesExcel,
  renderVentesPdf,
  VenteExport,
} from './ventes-renderer';

//- Faux Response Express : un flux qui collecte les octets + les headers posés
function fakeRes() {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c) => chunks.push(Buffer.from(c)));
  const headers: Record<string, string> = {};
  const res = Object.assign(stream, {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    send: (body: string) => {
      chunks.push(Buffer.from(body, 'utf8'));
      stream.end();
    },
  });
  const done = () =>
    new Promise<Buffer>((resolve) => {
      if (stream.writableFinished) return resolve(Buffer.concat(chunks));
      stream.on('finish', () => resolve(Buffer.concat(chunks)));
    });
  return { res: res as unknown as Response, headers, done };
}

const vente = (over: Partial<VenteExport> = {}): VenteExport => ({
  nomArticle: 'Collier argent',
  prixVente: 40,
  modePaiement: 'CARTE',
  sansCommission: false,
  photo: null,
  createdAt: new Date('2026-09-10T10:00:00Z'),
  creatrice: { nom: 'Sophie', tauxDeCommission: 25 },
  ...over,
});

describe('renderVentesCsv', () => {
  it('écrit une ligne par vente avec commission et net, plus un total', async () => {
    const { res, headers, done } = fakeRes();
    renderVentesCsv(
      [
        vente(),
        //- espèces sans commission : commission 0, net = prix
        vente({ nomArticle: 'Bracelet', prixVente: 20, modePaiement: 'ESPECES', sansCommission: true }),
      ],
      res,
      'ventes-boutique.csv',
    );
    const csv = (await done()).toString('utf8');

    expect(headers['Content-Disposition']).toContain('ventes-boutique.csv');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Collier argent";"Sophie";"25%";"40,00€";"-10,00€";"30,00€";"CARTE"');
    expect(csv).toContain('"Bracelet";"Sophie";"25%";"20,00€";"-0,00€";"20,00€";"ESPECES"');
    expect(csv).toContain('"TOTAL";;;"60,00€";"-10,00€";"50,00€"');
  });

  it("neutralise une formule saisie comme nom d'article (CSV injection)", async () => {
    const { res, done } = fakeRes();
    renderVentesCsv([vente({ nomArticle: '=HYPERLINK("http://evil","clic")' })], res, 'x.csv');
    const csv = (await done()).toString('utf8');

    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""clic"")"`);
    expect(csv).not.toMatch(/;"=HYPERLINK|^"=HYPERLINK/m);
  });

  it("n'est pas cassé par un point-virgule dans un nom", async () => {
    const { res, done } = fakeRes();
    renderVentesCsv([vente({ nomArticle: 'Pendentif; or' })], res, 'x.csv');
    const csv = (await done()).toString('utf8');
    expect(csv).toContain('"Pendentif; or";"Sophie"');
  });
});

describe('renderVentesExcel', () => {
  it('produit un xlsx lisible avec les ventes et le total', async () => {
    const { res, done } = fakeRes();
    await renderVentesExcel(
      [vente(), vente({ nomArticle: 'Boucles', prixVente: 10, creatrice: { nom: 'Léa', tauxDeCommission: 20 } })],
      res,
      'ventes-boutique.xlsx',
    );
    const buffer = await done();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const sheet = wb.getWorksheet('Ventes')!;
    //- colonnes : 1 Article, 2 Créatrice, 4 Prix vente (les clés ne survivent pas au rechargement)
    expect(sheet.getRow(2).getCell(1).value).toBe('Collier argent');
    expect(sheet.getRow(3).getCell(2).value).toBe('Léa');
    //- ligne 4 vide, ligne 5 = total : 40 + 10 = 50
    expect(sheet.getRow(5).getCell(4).value).toBe(50);
  });
});

describe('renderVentesPdf', () => {
  it("tronque un nom trop long à sa colonne au lieu de le laisser déborder", async () => {
    const { res, done } = fakeRes();
    await renderVentesPdf([vente({ nomArticle: 'Z'.repeat(300) })], res, {
      plan: 'PRO',
      sousTitre: 'test',
      filename: 'x.pdf',
      withPhotos: false,
    });
    const buffer = await done();
    //- 300 glyphes "Z" non tronqués donneraient un flux de contenu énorme ; tronqué,
    //- le PDF reste petit (quelques Ko, polices embarquées comprises)
    expect(buffer.length).toBeLessThan(200_000);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('produit un PDF valide sans photos (export boutique entière)', async () => {
    const { res, headers, done } = fakeRes();
    await renderVentesPdf([vente(), vente({ nomArticle: 'X'.repeat(200) })], res, {
      plan: 'PRO',
      sousTitre: 'Toutes les ventes — Boutique Lamartine',
      filename: 'ventes-boutique.pdf',
      withPhotos: false,
    });
    const buffer = await done();

    expect(headers['Content-Type']).toBe('application/pdf');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('gère la pagination sur beaucoup de ventes', async () => {
    const { res, done } = fakeRes();
    const beaucoup = Array.from({ length: 120 }, (_, i) => vente({ nomArticle: `Article ${i}` }));
    await renderVentesPdf(beaucoup, res, {
      plan: 'FREE',
      sousTitre: 'Toutes les ventes (mois en cours)',
      filename: 'ventes-boutique.pdf',
      withPhotos: false,
    });
    const buffer = await done();
    const pages = buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThan(3);
  });
});
