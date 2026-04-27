import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  });

  constructor(private readonly prisma: PrismaService) {}

  async createCheckoutSession(userId: string, priceId: string) {
    const session = await this.stripe.checkout.sessions.create({
      //- 'subscription' = abonnement récurrent (pas un paiement unique)
      mode: 'subscription',
      //- Méthodes de paiement acceptées
      payment_method_types: ['card'],
      //- Le produit acheté — priceId = price_xxx du plan choisi (mensuel ou annuel)
      line_items: [{ price: priceId, quantity: 1 }],
      //- URL de redirection après paiement réussi
      success_url: 'http://localhost:3000/stripe/success',
      //- URL de redirection si l'user annule le paiement
      cancel_url: 'http://localhost:3000/stripe/cancel',
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
    console.log('Webhook reçu', signature);
    try {
      //- Vérifie que la requête vient bien de Stripe grâce à la signature
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );

      switch (event.type) {
        //- Paiement réussi → on passe le user en PRO
        case 'checkout.session.completed': {
          const session = event.data.object as unknown as {
            metadata: { userId: string };
            customer: string;
          };
          const userId = session.metadata?.userId;

          //- Sauvegarde le stripeCustomerId pour retrouver le user lors d'une annulation
          if (userId) {
            await this.prisma.user.update({
              where: { id: userId },
              data: {
                plan: 'PRO',
                stripeCustomerId: session.customer,
              },
            });
          }
          break;
        }

        //- Abonnement annulé → on repasse le user en FREE
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as unknown as {
            customer: string;
          };
          console.log('subscription.customer:', subscription.customer);

          //- Retrouve le user via son stripeCustomerId stocké en base
          const user = await this.prisma.user.findFirst({
            where: { stripeCustomerId: subscription.customer },
          });

          console.log('user trouvé:', user);

          if (user) {
            await this.prisma.user.update({
              where: { id: user.id },
              data: { plan: 'FREE', stripeCustomerId: null },
            });
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
