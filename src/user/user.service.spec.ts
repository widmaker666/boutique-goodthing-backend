import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';

//- Ces services créent leur client tiers à l'instanciation : une clé factice suffit (aucun appel réseau)
process.env.STRIPE_SECRET_KEY ??= 'sk_test_factice';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
