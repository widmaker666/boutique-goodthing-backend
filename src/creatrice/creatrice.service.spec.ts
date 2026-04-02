import { Test, TestingModule } from '@nestjs/testing';
import { CreatriceService } from './creatrice.service';
import { PrismaService } from 'src/prisma.service';

const mockPrismaService = {
  creatrice: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CreatriceService', () => {
  let service: CreatriceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatriceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CreatriceService>(CreatriceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
