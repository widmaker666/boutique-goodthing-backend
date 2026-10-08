import { OwnershipService } from './ownership.service';
import { CreatriceService } from 'src/creatrice/creatrice.service';
import { StatsService } from 'src/stats/stats.service';
import { EvenementService } from 'src/evenement/evenement.service';

//- Régression : une gérante ne doit pas voir les ventes PERSONNELLES (événements, ventes
//- hors boutique) d'une créatrice qui a son propre compte. Seules comptent les ventes de
//- SES boutiques ; une fiche gérée sans compte reste entièrement visible.
describe("Ventes personnelles d'une créatrice — périmètre gérante", () => {
  const gerante: any = { id: 'g1', role: 'GERANTE', plan: 'PRO', email: 'g@x' };

  it("getVenteOwnershipWhere : boutiques de la gérante + fiches gérées SANS compte", async () => {
    const o = new OwnershipService({} as any);
    const w: any = await o.getVenteOwnershipWhere(gerante);
    expect(w.OR).toEqual([
      { creatrice: { geranteId: 'g1', userId: null } },
      { boutique: { geranteId: 'g1' } },
    ]);
  });

  it("fiche : créatrice avec compte → ventes de ma boutique ; sans compte → tout ; elle-même → tout", async () => {
    const prisma: any = {
      creatrice: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', tauxDeCommission: 10, vente: [] }) },
    };
    const ownership: any = { assertCreatriceOwned: jest.fn() };
    const svc = new CreatriceService(prisma, {} as any, ownership, {} as any);
    const whereAppel = (i: number) => prisma.creatrice.findUnique.mock.calls[i][0].include.vente.where;

    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', userId: 'camille' });
    await svc.findOne('c1', gerante);
    expect(whereAppel(0)).toEqual({ boutique: { geranteId: 'g1' } });

    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', userId: null });
    await svc.findOne('c1', gerante);
    expect(whereAppel(1)).toEqual({});

    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', userId: 'camille' });
    await svc.findOne('c1', { ...gerante, id: 'camille', role: 'CREATRICE' });
    expect(whereAppel(2)).toEqual({});
  });

  it('fiche + mois : le mois s\'ajoute au filtre (PRO), ignoré en FREE', async () => {
    const prisma: any = {
      creatrice: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', tauxDeCommission: 10, vente: [] }) },
    };
    const ownership: any = { assertCreatriceOwned: jest.fn().mockResolvedValue({ id: 'c1', userId: 'camille' }) };
    const svc = new CreatriceService(prisma, {} as any, ownership, {} as any);

    await svc.findOne('c1', gerante, '2026-02');
    const w = prisma.creatrice.findUnique.mock.calls[0][0].include.vente.where;
    expect(w.boutique).toEqual({ geranteId: 'g1' });
    expect(w.createdAt.gte).toEqual(new Date(2026, 1, 1));
    expect(w.createdAt.lte).toEqual(new Date(2026, 2, 0, 23, 59, 59, 999));

    await svc.findOne('c1', { ...gerante, plan: 'FREE' }, '2026-02');
    expect(prisma.creatrice.findUnique.mock.calls[1][0].include.vente.where.createdAt).toBeUndefined();

    await svc.findOne('c1', gerante, 'nimportequoi');
    expect(prisma.creatrice.findUnique.mock.calls[2][0].include.vente.where.createdAt).toBeUndefined();
  });

  it("liste : ca / nbVentes sans les ventes perso d'une créatrice avec compte", async () => {
    const prisma: any = {
      creatrice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1', userId: 'camille',
            vente: [
              { prixVente: 10, boutique: { geranteId: 'g1' } },
              { prixVente: 100, boutique: null }, // événement / hors boutique
            ],
          },
          {
            id: 'c2', userId: null,
            vente: [{ prixVente: 5, boutique: null }, { prixVente: 7, boutique: { geranteId: 'g1' } }],
          },
        ]),
      },
    };
    const svc = new CreatriceService(prisma, {} as any, new OwnershipService({} as any), {} as any);
    const [avecCompte, sansCompte]: any = await svc.findAll({} as any, gerante);
    expect(avecCompte.nbVentes).toBe(1);
    expect(avecCompte.ca).toBe(10);
    expect(sansCompte.nbVentes).toBe(2);
    expect(sansCompte.ca).toBe(12);
  });

  it('stats par créatrice : filtre sur les boutiques de la gérante si la créatrice a un compte', async () => {
    const vente = {
      aggregate: jest.fn().mockResolvedValue({ _sum: { prixVente: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const ownership: any = { assertCreatriceOwned: jest.fn().mockResolvedValue({ id: 'c1', userId: 'camille' }) };
    const svc = new StatsService({ vente } as any, ownership);
    await svc.getStatsByCreatrice('c1', gerante);
    expect(vente.aggregate.mock.calls[0][0].where).toEqual({ creatriceId: 'c1', boutique: { geranteId: 'g1' } });

    ownership.assertCreatriceOwned.mockResolvedValue({ id: 'c1', userId: null });
    await svc.getStatsByCreatrice('c1', gerante);
    expect(vente.aggregate.mock.calls[1][0].where).toEqual({ creatriceId: 'c1' });
  });

  it("supprimer un événement supprime aussi ses ventes (plus de ventes orphelines)", async () => {
    const calls: string[] = [];
    const prisma: any = {
      vente: { deleteMany: jest.fn((a: any) => { calls.push('ventes:' + a.where.evenementId); return 'v'; }) },
      evenement: { delete: jest.fn((a: any) => { calls.push('evenement:' + a.where.id); return { id: a.where.id }; }) },
      $transaction: jest.fn(async (ops: any[]) => ops.map(() => ({ id: 'e1' }))),
    };
    const ownership: any = { assertEvenementOwned: jest.fn() };
    const svc = new EvenementService(prisma, ownership);
    await svc.remove('e1', { id: 'u1' } as any);
    expect(calls).toEqual(['ventes:e1', 'evenement:e1']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
