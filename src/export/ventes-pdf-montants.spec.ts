import { PassThrough } from 'stream';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { renderVentesPdf, VenteExport } from './ventes-renderer';

//- Les montants du PDF s'écrivent à la française (virgule décimale), comme le CSV
describe('renderVentesPdf — format des montants', () => {
  it('écrit "25,52€" et jamais "25.52€"', async () => {
    const textes: string[] = [];
    const espion = jest.spyOn(PDFDocument.prototype, 'text').mockImplementation(function (this: any, t: any) {
      textes.push(String(t));
      return this;
    });

    const stream = new PassThrough();
    stream.on('data', () => undefined);
    const res = Object.assign(stream, { setHeader: () => undefined }) as unknown as Response;
    const vente: VenteExport = {
      nomArticle: 'Collier',
      prixVente: 25.52,
      modePaiement: 'CARTE',
      sansCommission: false,
      photo: null,
      createdAt: new Date('2026-09-10T10:00:00Z'),
      creatrice: { nom: 'Sophie', tauxDeCommission: 10 },
    } as VenteExport;

    await renderVentesPdf([vente], res, { plan: 'PRO', sousTitre: 'Test', filename: 'x.pdf', withPhotos: false } as any);
    espion.mockRestore();

    expect(textes).toContain('25,52€'); // prix de la ligne
    expect(textes).toContain('-2,55€'); // commission 10 %
    expect(textes).toContain('22,97€'); // net
    expect(textes.some((t) => /\d\.\d{2}€/.test(t))).toBe(false); // plus aucun point décimal
  });
});
