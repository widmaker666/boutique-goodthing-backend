import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Plan } from 'src/generated/enums';
import { UserService } from 'src/user/user.service';
import { NotificationService } from 'src/notification/notification.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

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
  //- phishing. Le mobile ne passe pas `origin` : il garde l'ancien
  //- comportement (APP_URL, backend — cassé en UX mais webhook = source de
  //- vérité, voir project_stripe_prod memory), inchangé par ce fix.
  private static readonly ALLOWED_WEB_ORIGINS = [
    'https://encaissly-web.vercel.app',
    'https://encaissly-web-git-main-widmaker666s-projects.vercel.app',
    'http://localhost:5173',
    'http://localhost:5183',
  ];

  private resolveReturnUrls(origin?: string): { success: string; cancel: string } {
    if (origin && StripeService.ALLOWED_WEB_ORIGINS.includes(origin)) {
      return {
        success: `${origin}/profil?checkout=success`,
        cancel: `${origin}/profil?checkout=cancel`,
      };
    }
    return {
      success: `${process.env.APP_URL}/stripe/success`,
      cancel: `${process.env.APP_URL}/stripe/cancel`,
    };
  }

  async createCheckoutSession(userId: string, priceId: string, origin?: string) {
    const { success, cancel } = this.resolveReturnUrls(origin);
    const session = await this.stripe.checkout.sessions.create({
      //- 'subscription' = abonnement récurrent (pas un paiement unique)
      mode: 'subscription',
      //- Méthodes de paiement acceptées
      payment_method_types: ['card'],
      //- Le produit acheté — priceId = price_xxx du plan choisi (mensuel ou annuel)
      line_items: [{ price: priceId, quantity: 1 }],
      //- URL de redirection après paiement réussi
      success_url: success,
      //- URL de redirection si l'user annule le paiement
      cancel_url: cancel,
      //- Données custom qu'on attache à la session — permet de retrouver le user dans le webhook
      metadata: { userId },
    });

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

    //- Annule le premier abonnement actif
    //- Stripe enverra ensuite le webhook customer.subscription.deleted
    await this.stripe.subscriptions.cancel(subscriptions.data[0].id);

    return { message: 'Abonnement annulé avec succès' };
  }

  async handleWebhook(signature: string, body: Buffer) {
    try {
      //- Vérifie que la requête vient bien de Stripe grâce à la signature
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );

      switch (event.type) {
        //- Paiement réussi → on résout le plan depuis le priceId acheté
        case 'checkout.session.completed': {
          const session = event.data.object as unknown as {
            id: string;
            metadata: { userId: string };
            customer: string;
          };
          const userId = session.metadata?.userId;

          if (userId) {
            //- Récupère les line_items pour lire le priceId réel de la session
            const expanded = await this.stripe.checkout.sessions.retrieve(
              session.id,
              { expand: ['line_items'] },
            );
            const priceId =
              expanded.line_items?.data?.[0]?.price?.id ?? '';
            const plan = this.resolvePlan(priceId);

            //- Sauvegarde le stripeCustomerId et le plan résolu pour retrouver le user lors d'une annulation
            await this.prisma.user.update({
              where: { id: userId },
              data: {
                plan,
                stripeCustomerId: session.customer,
              },
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
          break;
        }

        //- Abonnement annulé → on repasse le user en FREE
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as unknown as {
            customer: string;
          };

          //- Retrouve le user via son stripeCustomerId stocké en base
          const user = await this.prisma.user.findFirst({
            where: { stripeCustomerId: subscription.customer },
          });

          if (user) {
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
          break;
        }
      }

      return { received: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Webhook error';
      throw new BadRequestException(`Webhook error: ${message}`);
    }
  }
}
