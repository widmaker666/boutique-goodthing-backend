import { Test, TestingModule } from '@nestjs/testing';
import { VenteService } from './vente.service';
import { PrismaService } from 'src/prisma.service';

const mockPrismaService = {
  creatrice: {
    findUnique: jest.fn(),
  },
  vente: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('VenteService', () => {
  let service: VenteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenteService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<VenteService>(VenteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
