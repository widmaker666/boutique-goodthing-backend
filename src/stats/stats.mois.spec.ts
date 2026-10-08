import { StatsService } from './stats.service';

//- Prisma mocké : on vérifie uniquement le filtre de dates construit
describe('StatsService — filtre par mois', () => {
  const vente = { aggregate: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() };
  const prisma: any = {
    boutique: { findFirst: jest.fn().mockResolvedValue({ id: 'b1' }) },
    vente,
  };
  const service = new StatsService(prisma, {} as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.boutique.findFirst.mockResolvedValue({ id: 'b1' });
    vente.aggregate.mockResolvedValue({ _sum: { prixVente: 0 }, _count: 0 });
    vente.groupBy.mockResolvedValue([]);
    vente.findMany.mockResolvedValue([]);
  });

  it('PRO + mois : borne début/fin du mois et compare au mois précédent', async () => {
    await service.getGlobalStats('u1', 'GERANTE', 'PRO', undefined, undefined, '2026-02');
    const where = vente.aggregate.mock.calls[0][0].where;
    expect(where.boutiqueId).toBe('b1');
    expect(where.createdAt.gte).toEqual(new Date(2026, 1, 1));
    expect(where.createdAt.lte).toEqual(new Date(2026, 2, 0, 23, 59, 59, 999));
    const prev = vente.aggregate.mock.calls[1][0].where.createdAt;
    expect(prev.gte).toEqual(new Date(2026, 0, 1));
    expect(prev.lte).toEqual(new Date(2026, 1, 0, 23, 59, 59, 999));
  });

  it('PRO + janvier : le mois précédent est décembre N-1', async () => {
    await service.getGlobalStats('u1', 'GERANTE', 'PRO', undefined, undefined, '2026-01');
    const prev = vente.aggregate.mock.calls[1][0].where.createdAt;
    expect(prev.gte).toEqual(new Date(2025, 11, 1));
  });

  it('PRO sans mois ou mois invalide : aucun filtre de date', async () => {
    await service.getGlobalStats('u1', 'GERANTE', 'PRO');
    expect(vente.aggregate.mock.calls[0][0].where.createdAt).toBeUndefined();
    await service.getGlobalStats('u1', 'GERANTE', 'DUO', undefined, undefined, '2026-13');
    expect(vente.aggregate.mock.calls[2][0].where.createdAt).toBeUndefined();
  });

  it('FREE : param mois ignoré, reste sur le mois en cours', async () => {
    await service.getGlobalStats('u1', 'GERANTE', 'FREE', undefined, undefined, '2020-01');
    const gte: Date = vente.aggregate.mock.calls[0][0].where.createdAt.gte;
    const now = new Date();
    expect(gte).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
  });

  it('top articles : le mois est appliqué', async () => {
    await service.getTopArticles('u1', 'GERANTE', 'PRO', undefined, undefined, '2026-03');
    const where = vente.groupBy.mock.calls[0][0].where;
    expect(where.createdAt.gte).toEqual(new Date(2026, 2, 1));
  });
});
