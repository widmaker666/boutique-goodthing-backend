import { Test, TestingModule } from '@nestjs/testing';
import { BoutiqueController } from './boutique.controller';

describe('BoutiqueController', () => {
  let controller: BoutiqueController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoutiqueController],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<BoutiqueController>(BoutiqueController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
