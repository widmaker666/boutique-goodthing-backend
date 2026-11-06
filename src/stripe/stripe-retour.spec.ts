import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { StripeService } from './stripe.service';

process.env.STRIPE_SECRET_KEY ??= 'sk_test_factice';

//- Garde-fous du paiement : tarifs autorisés, double abonnement, adresses de retour,
//- webhook signé / idempotent / sans fausse activation
describe('Stripe — sécurité du paiement', () => {
  const ORIGINE = 'https://encaissly-web.vercel.app';

  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
    process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_a';
    process.env.STRIPE_PRICE_DUO_MONTHLY = 'price_duo_m';
    process.env.STRIPE_PRICE_DUO_ANNUAL = 'price_duo_a';
    process.env.APP_URL = 'https://api.exemple';
    delete process.env.WEB_ORIGINS;
  });

  const monter = (user: any = { id: 'u1', email: 'a@b.c', plan: 'FREE', stripeCustomerId: null }) => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const notif: any = { createForUser: jest.fn() };
    const users: any = { upgradeDuo: jest.fn() };
    const svc: any = new StripeService(prisma, users, notif);
    return { svc, prisma, notif, users };
  };

  describe('adresses de retour (web uniquement)', () => {
    it('origine autorisée → Compte > Abonnement', () => {
      const { svc } = monter();
      expect(svc.resolveReturnUrls(ORIGINE)).toEqual({
        success: `${ORIGINE}/compte?onglet=abonnement&checkout=success`,
        cancel: `${ORIGINE}/compte?onglet=abonnement&checkout=cancel`,
      });
    });

    it("origine inconnue ou absente → refus (pas de redirection vers un site tiers)", () => {
      const { svc } = monter();
      expect(() => svc.resolveReturnUrls('https://site-malveillant.example')).toThrow(BadRequestException);
      expect(() => svc.resolveReturnUrls(undefined)).toThrow(BadRequestException);
    });

    it('WEB_ORIGINS permet d\'ajouter un domaine personnalisé', () => {
      process.env.WEB_ORIGINS = 'https://app.encaissly.fr, https://autre.example';
      const { svc } = monter();
      expect(svc.resolveReturnUrls('https://app.encaissly.fr').success).toContain('https://app.encaissly.fr/compte');
    });
  });

  describe('création de la session de paiement', () => {
    const fausseSession = () => ({ checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay_1' }) } } });

    it('tarif hors des 4 tarifs Encaissly → refusé, Stripe jamais appelé', async () => {
      const { svc } = monter();
      svc.stripe = fausseSession();
      await expect(svc.createCheckoutSession('u1', 'price_un_autre_produit', ORIGINE)).rejects.toThrow(BadRequestException);
      expect(svc.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('déjà abonnée (PRO ou DUO) → refus 409, pas de double facturation', async () => {
      for (const plan of ['PRO', 'DUO']) {
        const { svc } = monter({ id: 'u1', email: 'a@b.c', plan, stripeCustomerId: 'cus_1' });
        svc.stripe = fausseSession();
        await expect(svc.createCheckoutSession('u1', 'price_pro_m', ORIGINE)).rejects.toThrow(ConflictException);
        expect(svc.stripe.checkout.sessions.create).not.toHaveBeenCalled();
      }
    });

    it('origine non autorisée → refus avant tout appel à Stripe', async () => {
      const { svc } = monter();
      svc.stripe = fausseSession();
      await expect(svc.createCheckoutSession('u1', 'price_pro_m', 'https://evil.example')).rejects.toThrow(BadRequestException);
      expect(svc.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('session complète : abonnement, tarif, compte rattaché 3 fois, email du compte, français', async () => {
      const { svc } = monter();
      svc.stripe = fausseSession();
      const res = await svc.createCheckoutSession('u1', 'price_duo_a', ORIGINE);
      expect(res).toEqual({ url: 'https://checkout.stripe.com/c/pay_1' });
      const arg = svc.stripe.checkout.sessions.create.mock.calls[0][0];
      expect(arg).toMatchObject({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: 'price_duo_a', quantity: 1 }],
        client_reference_id: 'u1',
        metadata: { userId: 'u1' },
        subscription_data: { metadata: { userId: 'u1' } },
        customer_email: 'a@b.c',
        locale: 'fr',
        success_url: `${ORIGINE}/compte?onglet=abonnement&checkout=success`,
      });
      expect(arg.customer).toBeUndefined();
    });

    it('client Stripe déjà connu → réutilisé (pas de doublon de client)', async () => {
      const { svc } = monter({ id: 'u1', email: 'a@b.c', plan: 'FREE', stripeCustomerId: 'cus_9' });
      svc.stripe = fausseSession();
      await svc.createCheckoutSession('u1', 'price_pro_m', ORIGINE);
      const arg = svc.stripe.checkout.sessions.create.mock.calls[0][0];
      expect(arg.customer).toBe('cus_9');
      expect(arg.customer_email).toBeUndefined();
    });
  });

  describe('webhook', () => {
    const evenement = (type: string, objet: any) => ({
      webhooks: { constructEvent: () => ({ id: 'evt_1', type, data: { object: objet } }) },
      checkout: { sessions: { retrieve: jest.fn() } },
    });
    const sessionPayee = (over: any = {}) => ({ id: 'cs_1', metadata: { userId: 'u1' }, customer: 'cus_1', payment_status: 'paid', mode: 'subscription', ...over });
    const avecPrix = (stripe: any, priceId: string) => {
      stripe.checkout.sessions.retrieve = jest.fn().mockResolvedValue({ line_items: { data: [{ price: { id: priceId } }] } });
      return stripe;
    };

    it('signature invalide → 400 « Signature invalide », rien n\'est écrit', async () => {
      const { svc, prisma } = monter();
      svc.stripe = { webhooks: { constructEvent: () => { throw new Error('No signatures found matching'); } } };
      const avert = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      await expect(svc.handleWebhook('mauvaise', Buffer.from('{}'))).rejects.toThrow('Signature invalide');
      expect(prisma.user.update).not.toHaveBeenCalled();
      avert.mockRestore();
    });

    it('prix connu → plan activé et une notification', async () => {
      const { svc, prisma, notif } = monter();
      svc.stripe = avecPrix(evenement('checkout.session.completed', sessionPayee()), 'price_pro_m');
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ plan: 'PRO', stripeCustomerId: 'cus_1' });
      expect(notif.createForUser).toHaveBeenCalledTimes(1);
    });

    it('DUO → synchronise le rôle et la fiche créatrice', async () => {
      const { svc, users } = monter();
      svc.stripe = avecPrix(evenement('checkout.session.completed', sessionPayee()), 'price_duo_m');
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(users.upgradeDuo).toHaveBeenCalledWith('u1');
    });

    it('même événement reçu deux fois → rien n\'est refait, pas de 2e notification', async () => {
      const { svc, prisma, notif } = monter({ id: 'u1', email: 'a@b.c', plan: 'PRO', stripeCustomerId: 'cus_1' });
      svc.stripe = avecPrix(evenement('checkout.session.completed', sessionPayee()), 'price_pro_m');
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(notif.createForUser).not.toHaveBeenCalled();
    });

    it('prix INCONNU → erreur dans les logs, plan non touché, aucune fausse notification', async () => {
      const erreur = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { svc, prisma, notif, users } = monter();
      svc.stripe = avecPrix(evenement('checkout.session.completed', sessionPayee()), 'price_ancien_test');
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(erreur).toHaveBeenCalledWith(expect.stringContaining('price_ancien_test'));
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ stripeCustomerId: 'cus_1' });
      expect(notif.createForUser).not.toHaveBeenCalled();
      expect(users.upgradeDuo).not.toHaveBeenCalled();
      erreur.mockRestore();
    });

    it('paiement pas encore encaissé (unpaid) → on attend, rien n\'est activé', async () => {
      const avert = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { svc, prisma } = monter();
      svc.stripe = avecPrix(evenement('checkout.session.completed', sessionPayee({ payment_status: 'unpaid' })), 'price_pro_m');
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(prisma.user.update).not.toHaveBeenCalled();
      avert.mockRestore();
    });

    it('paiement différé confirmé plus tard → activé', async () => {
      const { svc, prisma } = monter();
      svc.stripe = avecPrix(evenement('checkout.session.async_payment_succeeded', sessionPayee()), 'price_pro_a');
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(prisma.user.update.mock.calls[0][0].data.plan).toBe('PRO');
    });

    it('double abonnement (autre client Stripe) → alerte dans les logs', async () => {
      const erreur = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { svc } = monter({ id: 'u1', email: 'a@b.c', plan: 'PRO', stripeCustomerId: 'cus_ancien' });
      svc.stripe = avecPrix(evenement('checkout.session.completed', sessionPayee()), 'price_duo_m');
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(erreur).toHaveBeenCalledWith(expect.stringContaining('DOUBLE ABONNEMENT'));
      erreur.mockRestore();
    });

    it('erreur de traitement → 500 pour que Stripe réessaie (et aucun détail technique renvoyé)', async () => {
      const erreur = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { svc, prisma } = monter();
      prisma.user.update.mockRejectedValue(new Error('connexion base perdue'));
      svc.stripe = avecPrix(evenement('checkout.session.completed', sessionPayee()), 'price_pro_m');
      const echec = svc.handleWebhook('sig', Buffer.from(''));
      await expect(echec).rejects.toThrow(InternalServerErrorException);
      await expect(echec).rejects.not.toThrow(/connexion base perdue/);
      erreur.mockRestore();
    });

    it('abonnement terminé → retour en FREE', async () => {
      const { svc, prisma, notif } = monter();
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', stripeCustomerId: 'cus_1' });
      svc.stripe = evenement('customer.subscription.deleted', { customer: 'cus_1' });
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ plan: 'FREE', stripeCustomerId: null });
      expect(notif.createForUser).toHaveBeenCalledTimes(1);
    });

    it("ancien abonnement qui se termine alors qu'un autre est en cours → plan conservé", async () => {
      const avert = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { svc, prisma } = monter({ id: 'u1', email: 'a@b.c', plan: 'PRO', stripeCustomerId: 'cus_actuel' });
      prisma.user.findFirst.mockResolvedValue(null);
      svc.stripe = evenement('customer.subscription.deleted', { customer: 'cus_ancien', metadata: { userId: 'u1' } });
      await svc.handleWebhook('sig', Buffer.from(''));
      expect(prisma.user.update).not.toHaveBeenCalled();
      avert.mockRestore();
    });
  });
});
