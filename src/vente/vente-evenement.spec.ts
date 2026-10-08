import { VenteService } from './vente.service';

//- Règle : une vente d'événement n'est jamais rattachée à une boutique
describe("VenteService.create — rattachement à la boutique", () => {
  const venteCreate = jest.fn();
  const prisma: any = {
    boutique: {
      findFirst: jest.fn().mockResolvedValue({ id: 'b1' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    vente: { create: venteCreate },
    article: { updateMany: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const ownership: any = {
    assertCreatriceOwned: jest.fn().mockResolvedValue({ id: 'c1' }),
    assertBoutiqueOwned: jest.fn().mockResolvedValue({ id: 'b1' }),
  };
  const service = new VenteService(prisma, {} as any, ownership, { createForUser: jest.fn() } as any);
  const duo: any = { id: 'u1', email: 'a@b.c', role: 'GERANTE_CREATRICE', plan: 'DUO' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.boutique.findFirst.mockResolvedValue({ id: 'b1' });
    venteCreate.mockImplementation(async ({ data }: any) => ({
      ...data,
      creatrice: { nom: 'Moi', tauxDeCommission: 0, userId: null },
    }));
  });

  it("vente dans un événement (compte DUO propriétaire d'une boutique) → pas de boutique", async () => {
    await service.create({ nomArticle: 'collier', prixVente: 30, modePaiement: 'ESPECES', creatriceId: 'c1', evenementId: 'e1' } as any, duo);
    expect(venteCreate.mock.calls[0][0].data.boutiqueId).toBeUndefined();
    expect(prisma.boutique.findFirst).not.toHaveBeenCalled();
  });

  it("événement + boutiqueId fourni → boutiqueId ignoré", async () => {
    await service.create({ nomArticle: 'x', prixVente: 10, modePaiement: 'CARTE', creatriceId: 'c1', evenementId: 'e1', boutiqueId: 'b1' } as any, duo);
    expect(venteCreate.mock.calls[0][0].data.boutiqueId).toBeUndefined();
  });

  it("vente hors événement par une gérante → rattachée à sa boutique (inchangé)", async () => {
    await service.create({ nomArticle: 'collier', prixVente: 30, modePaiement: 'ESPECES', creatriceId: 'c1' } as any, duo);
    expect(venteCreate.mock.calls[0][0].data.boutiqueId).toBe('b1');
  });
});
