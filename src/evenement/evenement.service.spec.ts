import { Test, TestingModule } from '@nestjs/testing';
import { EvenementService } from './evenement.service';

describe('EvenementService', () => {
  let service: EvenementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvenementService],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<EvenementService>(EvenementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
