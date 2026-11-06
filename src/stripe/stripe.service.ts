import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Plan } from 'src/generated/enums';
import { UserService } from 'src/user/user.service';
import { NotificationService } from 'src/notification/notification.service';
import Stripe from 'stripe';

//- Forme minimale d'une session Checkout lue dans le webhook
interface SessionCheckout {
  id: string;
  mode?: string;
  payment_status?: string;
  client_reference_id?: string | null;
  metadata?: { userId?: string } | null;
  customer: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  //- Les 4 tarifs vendus (PRO/DUO × mensuel/annuel), lus dans l'environnement du serveur
  private prixAutorises(): string[] {
    return [
      process.env.STRIPE_PRICE_PRO_MONTHLY,
      process.env.STRIPE_PRICE_PRO_ANNUAL,
      process.env.STRIPE_PRICE_DUO_MONTHLY,
      process.env.STRIPE_PRICE_DUO_ANNUAL,
    ].filter((p): p is string => !!p);
  }

  //- Résout un priceId Stripe vers le Plan correspondant (FREE si inconnu)
  //- Supporte mensuel + annuel pour chaque plan
  private resolvePlan(priceId: string): Plan {
    const proPrices = [
      process.env.STRIPE_PRICE_PRO_MONTHLY,
      process.env.STRIPE_PRICE_PRO_ANNUAL,
    ].filter(Boolean);
    const duoPrices = [
      process.env.STRIPE_PRICE_DUO_MONTHLY,
      process.env.STRIPE_PRICE_DUO_ANNUAL,
    ].filter(Boolean);
    if (proPrices.includes(priceId)) return Plan.PRO;
    if (duoPrices.includes(priceId)) return Plan.DUO;
    return Plan.FREE;
  }

  //- Origines autorisées à recevoir la redirection post-paiement. Jamais
  //- l'origine fournie par le client telle quelle (open redirect) — un
  //- attaquant pourrait sinon faire pointer success_url vers un site de
  //- phishing. WEB_ORIGINS (séparées par des virgules) permet d'ajouter un
  //- domaine personnalisé sans toucher au code.
  private static readonly ALLOWED_WEB_ORIGINS = [
    'https://encaissly-web.vercel.app',
    'https://encaissly-web-git-main-widmaker666s-projects.vercel.app',
    'http://localhost:5173',
    'http://localhost:5183',
  ];

  private originesAutorisees(): string[] {
    const supplementaires = (process.env.WEB_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    return [...StripeService.ALLOWED_WEB_ORIGINS, ...supplementaires];
  }

  //- Le paiement se fait UNIQUEMENT depuis le site web : une origine absente ou inconnue est refusée
  //- (plutôt que de renvoyer le client vers une page qui n'existe pas).
  private resolveReturnUrls(origin?: string): { success: string; cancel: string } {
    if (!origin || !this.originesAutorisees().includes(origin)) {
      throw new BadRequestException(
        "Le paiement se fait depuis le site web d'Encaissly.",
      );
    }
    return {
      success: `${origin}/compte?onglet=abonnement&checkout=success`,
      cancel: `${origin}/compte?onglet=abonnement&checkout=cancel`,
    };
  }

  async createCheckoutSession(userId: string, priceId: string, origin?: string) {
    const { success, cancel } = this.resolveReturnUrls(origin);

    //- Le tarif vient du client : on n'accepte QUE les 4 tarifs d'Encaissly, jamais un price_ quelconque
    //- du compte Stripe (autre produit, tarif de test…).
    if (!this.prixAutorises().includes(priceId)) {
      throw new BadRequestException("Ce tarif n'existe pas.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Compte introuvable.');

    //- Évite de payer deux fois : un abonnement payant est déjà actif
    if (user.plan !== Plan.FREE) {
      throw new ConflictException('Tu as déjà un abonnement actif.');
    }

    const session = await this.stripe.checkout.sessions.create({
      //- 'subscription' = abonnement récurrent (pas un paiement unique)
      mode: 'subscription',
      //- Méthodes de paiement acceptées
      payment_method_types: ['card'],
      //- Le produit acheté — priceId = price_xxx du plan choisi (mensuel ou annuel)
      line_items: [{ price: priceId, quantity: 1 }],
      //- URL de redirection après paiement réussi / annulé (origines autorisées uniquement)
      success_url: success,
      cancel_url: cancel,
      locale: 'fr',
      //- Rattache la session au compte, de 3 façons : retrouvable dans Stripe et dans le webhook,
      //- même si le lien client Stripe se perd (le plan est ensuite relu depuis le prix réellement payé)
      client_reference_id: userId,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      //- Réutilise le client Stripe existant, sinon préremplit (et verrouille) l'email du compte :
      //- le reçu part à la bonne adresse
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user.email }),
    });

    if (!session.url) {
      throw new BadRequestException("Impossible d'ouvrir la page de paiement.");
    }

    //- Retourne l'URL de la page de paiement Stripe vers laquelle rediriger le user
    return { url: session.url };
  }

  async cancelSubscription(userId: string) {
    //- Récupère le stripeCustomerId du user en base
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeCustomerId) {
      throw new BadRequestException('Aucun abonnement actif trouvé');
    }

    //- Récupère les abonnements actifs du customer chez Stripe
    const subscriptions = await this.stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
    });

    if (subscriptions.data.length === 0) {
      throw new BadRequestException('Aucun abonnement actif trouvé');
    }

    //- Résiliation à la fin de la période payée (CGV : pas de prorata) —
    //- l'accès reste actif jusque-là, puis Stripe enverra le webhook
    //- customer.subscription.deleted qui repasse le user en FREE
    const updated = await this.stripe.subscriptions.update(
      subscriptions.data[0].id,
      { cancel_at_period_end: true },
    );
    const endsAt = updated.cancel_at
      ? new Date(updated.cancel_at * 1000).toISOString()
      : null;

    if (endsAt) {
      const dateFr = new Date(endsAt).toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
      });
      await this.notificationService.createForUser(
        userId,
        'ABONNEMENT',
        `Résiliation enregistrée : ton abonnement reste actif jusqu'au ${dateFr}, puis tu repasseras en plan FREE.`,
      );
    }

    return { message: 'Résiliation programmée', endsAt };
  }

  private verifierSignature(body: Buffer, signature: string) {
    try {
      return this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Webhook rejeté (signature invalide) : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
      throw new BadRequestException('Signature invalide');
    }
  }

  async handleWebhook(signature: string, body: Buffer) {
    //- 1) Authenticité : seule une requête signée par Stripe (secret du webhook) passe.
    //- Aucun détail technique n'est renvoyé à l'appelant.
    const event = this.verifierSignature(body, signature);

    //- 2) Traitement. Une erreur ici renvoie 500 : Stripe réessaiera automatiquement plus tard.
    try {
      switch (event.type) {
        //- Paiement réussi (ou, pour un moyen de paiement différé, confirmé plus tard)
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          await this.activerAbonnement(event.data.object as unknown as SessionCheckout);
          break;

        //- Abonnement terminé (fin de période après résiliation, ou impayé) → retour en FREE
        case 'customer.subscription.deleted':
          await this.desactiverAbonnement(
            event.data.object as unknown as {
              customer: string;
              metadata?: { userId?: string } | null;
            },
          );
          break;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Webhook ${event.type} (${event.id}) en échec : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
      throw new InternalServerErrorException('Traitement du webhook impossible');
    }

    return { received: true };
  }

  private async activerAbonnement(session: SessionCheckout) {
    //- Paiement différé pas encore encaissé : on attend l'événement « async_payment_succeeded »
    if (session.payment_status === 'unpaid') {
      this.logger.warn(`Session ${session.id} : paiement pas encore encaissé, en attente`);
      return;
    }
    if (session.mode && session.mode !== 'subscription') return;

    const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
    if (!userId) {
      this.logger.warn(`Session ${session.id} sans compte rattaché, ignorée`);
      return;
    }

    //- Lit le prix réellement payé (jamais ce que le client prétend avoir acheté)
    const expanded = await this.stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items'],
    });
    const priceId = expanded.line_items?.data?.[0]?.price?.id ?? '';
    const plan = this.resolvePlan(priceId);

    //- Prix inconnu (ex. STRIPE_PRICE_* du serveur pas passés en « live ») : la personne
    //- a PAYÉ mais on ne sait pas quel plan lui donner. Surtout ne rien lui annoncer de faux :
    //- on garde son identifiant client Stripe et on signale l'erreur dans les logs.
    if (plan === Plan.FREE) {
      this.logger.error(
        `Paiement reçu mais prix inconnu : session=${session.id} user=${userId} priceId="${priceId}" — plan NON activé, à traiter à la main (vérifier les STRIPE_PRICE_* du serveur)`,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: session.customer },
      });
      return;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.error(`Paiement reçu pour un compte introuvable : session=${session.id} user=${userId}`);
      return;
    }

    //- Doublon : Stripe renvoie parfois le même événement — rien à refaire (et surtout pas de 2e notification)
    if (user.plan === plan && user.stripeCustomerId === session.customer) return;

    //- Déjà abonnée avec un AUTRE client Stripe : risque de double facturation, à vérifier dans Stripe
    if (
      user.plan !== Plan.FREE &&
      user.stripeCustomerId &&
      user.stripeCustomerId !== session.customer
    ) {
      this.logger.error(
        `DOUBLE ABONNEMENT possible : user=${userId} déjà ${user.plan} (client ${user.stripeCustomerId}), nouveau paiement session=${session.id} (client ${session.customer}) — vérifier et rembourser dans Stripe si besoin`,
      );
    }

    //- Sauvegarde le stripeCustomerId et le plan résolu pour retrouver le user lors d'une annulation
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan, stripeCustomerId: session.customer },
    });

    //- Si plan DUO confirmé par Stripe → sync role + fiche Creatrice (idempotent)
    if (plan === Plan.DUO) {
      await this.userService.upgradeDuo(userId);
    }

    //- Notif in-app : abonnement activé
    const planLabel = plan === Plan.DUO ? 'DUO' : 'PRO';
    await this.notificationService.createForUser(
      userId,
      'ABONNEMENT',
      `Ton abonnement ${planLabel} est activé. Bienvenue !`,
    );
  }

  private async desactiverAbonnement(subscription: {
    customer: string;
    metadata?: { userId?: string } | null;
  }) {
    //- Retrouve le user via son stripeCustomerId stocké en base, sinon via l'identifiant posé à la souscription
    let user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer },
    });
    if (!user && subscription.metadata?.userId) {
      user = await this.prisma.user.findUnique({
        where: { id: subscription.metadata.userId },
      });
      //- Retrouvé par le seul identifiant de souscription ET lié à un AUTRE client Stripe : c'est un
      //- ancien abonnement (doublon, essai…) qui se termine — on ne touche pas à l'abonnement en cours.
      if (user?.stripeCustomerId && user.stripeCustomerId !== subscription.customer) {
        this.logger.warn(
          `Ancien abonnement terminé (client ${subscription.customer}) pour user=${user.id} qui est lié à un autre client — plan conservé`,
        );
        return;
      }
    }
    if (!user) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { plan: Plan.FREE, stripeCustomerId: null },
    });
    await this.notificationService.createForUser(
      user.id,
      'ABONNEMENT',
      'Ton abonnement a été résilié. Tu es repassé en plan FREE.',
    );
  }
}
