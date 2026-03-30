import { Test, TestingModule } from '@nestjs/testing';
import { CreatriceService } from './creatrice.service';

describe('CreatriceService', () => {
  let service: CreatriceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreatriceService],
    }).compile();

    service = module.get<CreatriceService>(CreatriceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
