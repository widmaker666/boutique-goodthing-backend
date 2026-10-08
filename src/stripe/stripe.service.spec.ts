import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';

//- Ces services créent leur client tiers à l'instanciation : une clé factice suffit (aucun appel réseau)
process.env.STRIPE_SECRET_KEY ??= 'sk_test_factice';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
