import { Test, TestingModule } from '@nestjs/testing';
import { CreatriceController } from './creatrice.controller';
import { CreatriceService } from './creatrice.service';

describe('CreatriceController', () => {
  let controller: CreatriceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatriceController],
      providers: [CreatriceService],
    }).compile();

    controller = module.get<CreatriceController>(CreatriceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
