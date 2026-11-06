import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, seconds } from '@nestjs/throttler';
import { StripeService } from './stripe.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripe: StripeService) {}
  @UseGuards(JwtGuard)
  //- Crée une session de paiement chez Stripe : pas plus de 5 par minute et par adresse IP
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('checkout')
  createCheckoutSession(
    @Req() req,
    @Body('priceId') priceId: string,
    //- Fourni par le web (window.location.origin) pour rediriger après paiement
    //- vers le bon site plutôt que vers le backend lui-même (voir
    //- resolveReturnOrigin — jamais fait confiance aveuglément, allowlist).
    @Body('origin') origin?: string,
  ) {
    const checkUserId = req.user.id;
    const checkPriceId = priceId;

    return this.stripe.createCheckoutSession(checkUserId, checkPriceId, origin);
  }

  //- Appelé par Stripe, authentifié par la SIGNATURE (pas par la limite de débit) : la limite de 10 requêtes
  //- par minute ferait refuser des événements légitimes lors d'une rafale.
  @SkipThrottle()
  @Post('webhook')
  handleWebhook(@Headers('stripe-signature') signature: string, @Req() req) {
    return this.stripe.handleWebhook(signature, req.body);
  }
  @UseGuards(JwtGuard)
  @Post('cancel')
  cancelSubscription(@Req() req) {
    return this.stripe.cancelSubscription(req.user.id);
  }
}
