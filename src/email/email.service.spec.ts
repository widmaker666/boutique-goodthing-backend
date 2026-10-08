import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

//- Ces services créent leur client tiers à l'instanciation : une clé factice suffit (aucun appel réseau)
process.env.RESEND_API_KEY ??= 're_test_key';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
