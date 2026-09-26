import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { currentMois, moisLabel, moisRange } from 'src/common/month-range.util';
import { ExportService } from './export.service';
import * as renderer from './ventes-renderer';

jest.mock('./ventes-renderer', () => ({
  renderVentesPdf: jest.fn(),
  renderVentesCsv: jest.fn(),
  renderVentesExcel: jest.fn(),
}));

//- Ce que ces tests protègent : le PÉRIMÈTRE du détail des ventes gérante.
//- Un compte DUO n'a pas de "mode" côté serveur → tout repose sur la relation
//- réelle en base (boutique dont elle est gérante, créatrice qu'elle gère).
describe('ExportService.getExportVentesGerante', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { vente: { findMany } };
  const ownership = {
    assertBoutiqueOwned: jest.fn(),
    assertCreatriceOwned: jest.fn(),
  };
  const service = new ExportService(prisma as any, ownership as any);
  const res = {} as any;
  const gerante = (plan: string) => ({ id: 'user-1', email: 'g@x.fr', role: 'GERANTE' as any, plan });

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  it('sans boutique ni créatrice : toutes SES boutiques uniquement (pas les événements perso)', async () => {
    await service.getExportVentesGerante(gerante('PRO'), res, 'pdf');

    const { where } = findMany.mock.calls[0][0];
    expect(where.boutique).toEqual({ geranteId: 'user-1' });
    expect(where.boutiqueId).toBeUndefined();
    expect(where.creatriceId).toBeUndefined();
    expect(ownership.assertBoutiqueOwned).not.toHaveBeenCalled();
  });

  it('avec boutiqueId : vérifie que la boutique lui appartient, puis filtre dessus', async () => {
    ownership.assertBoutiqueOwned.mockResolvedValue({ id: 'b1', nom: 'Lamartine' });

    await service.getExportVentesGerante(gerante('PRO'), res, 'csv', 'b1');

    expect(ownership.assertBoutiqueOwned).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), 'b1');
    expect(findMany.mock.calls[0][0].where.boutiqueId).toBe('b1');
  });

  it("boutique d'une autre gérante : 404 et aucune requête de ventes", async () => {
    ownership.assertBoutiqueOwned.mockRejectedValue(new NotFoundException('Boutique introuvable'));

    await expect(
      service.getExportVentesGerante(gerante('PRO'), res, 'pdf', 'boutique-autre'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("créatrice qu'elle ne gère pas : 404 et aucune requête de ventes", async () => {
    ownership.assertCreatriceOwned.mockRejectedValue(new NotFoundException('Créatrice introuvable'));

    await expect(
      service.getExportVentesGerante(gerante('PRO'), res, 'pdf', undefined, 'creatrice-autre'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('avec creatriceId : filtre sur cette créatrice et nomme le rapport', async () => {
    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', nom: 'Sophie' });

    await service.getExportVentesGerante(gerante('PRO'), res, 'pdf', undefined, 'c1');

    expect(findMany.mock.calls[0][0].where.creatriceId).toBe('c1');
    expect(renderer.renderVentesPdf).toHaveBeenCalledWith(
      [],
      res,
      expect.objectContaining({
        sousTitre: "Ventes de Sophie — tout l'historique",
        filename: 'ventes-creatrice.pdf',
      }),
    );
  });

  it("FREE : limité au mois en cours (bornes à l'heure de Paris)", async () => {
    await service.getExportVentesGerante(gerante('FREE'), res, 'pdf');

    const { debut, fin } = moisRange(currentMois());
    expect(findMany.mock.calls[0][0].where.createdAt).toEqual({ gte: debut, lt: fin });
    expect(renderer.renderVentesPdf).toHaveBeenCalledWith(
      [],
      res,
      expect.objectContaining({
        sousTitre: `Toutes les ventes — ${moisLabel(currentMois())}`,
        plan: 'FREE',
      }),
    );
  });

  it('FREE : demander explicitement le mois en cours est accepté', async () => {
    await service.getExportVentesGerante(gerante('FREE'), res, 'pdf', undefined, undefined, currentMois());
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('FREE : un mois passé est refusé (403) sans aucune requête de ventes', async () => {
    await expect(
      service.getExportVentesGerante(gerante('FREE'), res, 'pdf', undefined, undefined, '2020-01'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('PRO et DUO : peuvent choisir un mois passé', async () => {
    for (const plan of ['PRO', 'DUO']) {
      findMany.mockClear();
      await service.getExportVentesGerante(gerante(plan), res, 'excel', undefined, undefined, '2026-08');

      const { debut, fin } = moisRange('2026-08');
      expect(findMany.mock.calls[0][0].where.createdAt).toEqual({ gte: debut, lt: fin });
    }
    expect(renderer.renderVentesExcel).toHaveBeenLastCalledWith([], res, 'ventes-boutique.xlsx');
  });

  it("PRO et DUO sans mois : tout l'historique", async () => {
    for (const plan of ['PRO', 'DUO']) {
      findMany.mockClear();
      await service.getExportVentesGerante(gerante(plan), res, 'excel');
      expect(findMany.mock.calls[0][0].where.createdAt).toBeUndefined();
    }
  });

  it('mois au mauvais format : 400 sans aucune requête', async () => {
    for (const mauvais of ['2026-13', 'septembre', '2026-9', '../etc']) {
      await expect(
        service.getExportVentesGerante(gerante('PRO'), res, 'pdf', undefined, undefined, mauvais),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(findMany).not.toHaveBeenCalled();
  });

  it('trie par créatrice puis par date pour lire les ventes créatrice par créatrice', async () => {
    await service.getExportVentesGerante(gerante('PRO'), res, 'csv');
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ creatrice: { nom: 'asc' } }, { createdAt: 'asc' }]);
  });

  it('exports boutique entière : PDF sans photos (1 requête réseau par photo serait trop lent)', async () => {
    await service.getExportVentesGerante(gerante('PRO'), res, 'pdf');
    expect(renderer.renderVentesPdf).toHaveBeenCalledWith(
      [],
      res,
      expect.objectContaining({ withPhotos: false }),
    );
  });
});
