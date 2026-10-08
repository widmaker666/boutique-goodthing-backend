import { OwnershipService } from './ownership.service';
import { CreatriceService } from 'src/creatrice/creatrice.service';
import { StatsService } from 'src/stats/stats.service';

//- Régression : une gérante ne doit pas voir les ventes d'ÉVÉNEMENT des
//- créatrices qu'elle gère (compte perso de la créatrice).
describe('Ventes d\'événements — périmètre gérante', () => {
  const gerante: any = { id: 'g1', role: 'GERANTE', plan: 'PRO', email: 'g@x' };

  it('getVenteOwnershipWhere exclut les ventes d\'événement des créatrices gérées', async () => {
    const o = new OwnershipService({} as any);
    const w: any = await o.getVenteOwnershipWhere(gerante);
    expect(w.OR[0]).toEqual({ creatrice: { geranteId: 'g1' }, evenementId: null });
    expect(w.OR[1].boutique).toEqual({ geranteId: 'g1' });
    expect(w.OR[1].OR).toContainEqual({ evenementId: null });
  });

  it('findOne : gérante → ventes sans événement ; sa propre fiche → tout', async () => {
    const prisma: any = {
      creatrice: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', tauxDeCommission: 10, vente: [] }) },
    };
    const ownership: any = { assertCreatriceOwned: jest.fn() };
    const svc = new CreatriceService(prisma, {} as any, ownership, {} as any);

    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', userId: 'camille' });
    await svc.findOne('c1', gerante);
    expect(prisma.creatrice.findUnique.mock.calls[0][0].include.vente.where).toEqual({ evenementId: null });

    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', userId: 'g1' });
    await svc.findOne('c1', gerante);
    expect(prisma.creatrice.findUnique.mock.calls[1][0].include.vente.where).toEqual({});

    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', userId: 'camille' });
    await svc.findOne('c1', { ...gerante, id: 'camille', role: 'CREATRICE' });
    expect(prisma.creatrice.findUnique.mock.calls[2][0].include.vente.where).toEqual({});
  });

  it('findAll : ca/nbVentes sans les ventes d\'événement pour la gérante', async () => {
    const prisma: any = {
      creatrice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1', userId: 'camille',
            vente: [
              { prixVente: 10, evenementId: null },
              { prixVente: 100, evenementId: 'ev1' },
            ],
          },
        ]),
      },
    };
    const svc = new CreatriceService(prisma, {} as any, new OwnershipService({} as any), {} as any);
    const [c]: any = await svc.findAll({} as any, gerante);
    expect(c.nbVentes).toBe(1);
    expect(c.ca).toBe(10);
  });

  it('getStatsByCreatrice : filtre evenementId null pour la gérante', async () => {
    const vente = {
      aggregate: jest.fn().mockResolvedValue({ _sum: { prixVente: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const ownership: any = { assertCreatriceOwned: jest.fn().mockResolvedValue({ id: 'c1', userId: 'camille' }) };
    const svc = new StatsService({ vente } as any, ownership);
    await svc.getStatsByCreatrice('c1', gerante);
    expect(vente.aggregate.mock.calls[0][0].where).toEqual({ creatriceId: 'c1', evenementId: null });
    expect(vente.findMany.mock.calls[0][0].where).toEqual({ creatriceId: 'c1', evenementId: null });
  });
});
