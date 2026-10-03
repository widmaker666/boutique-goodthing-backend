import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripe: StripeService) {}
  @UseGuards(JwtGuard)
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
