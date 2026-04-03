import { Test, TestingModule } from '@nestjs/testing';
import { CreatriceService } from './creatrice.service';
import { PrismaService } from 'src/prisma.service';
import { NotFoundException } from '@nestjs/common';
import {
  mockCreatrice,
  mockPrismaService,
} from './mocksTest/mockCreatriceService';

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

  it('should throw NotFoundException if creatrice not found', async () => {
    mockPrismaService.creatrice.findUnique.mockResolvedValue(null);
    await expect(service.findOne('id-inexistant')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return a creatrice when found', async () => {
    mockPrismaService.creatrice.findUnique.mockResolvedValue(mockCreatrice);
    await expect(service.findOne('uuid-test')).resolves.toEqual(mockCreatrice);
  });
});
