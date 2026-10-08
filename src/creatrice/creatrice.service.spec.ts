import { Test, TestingModule } from '@nestjs/testing';
import { CreatriceService } from './creatrice.service';
import { PrismaService } from 'src/prisma.service';
import { EmailService } from 'src/email/email.service';
import {
  AuthUser,
  OwnershipService,
} from 'src/common/ownership/ownership.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotFoundException } from '@nestjs/common';
import { Role } from 'src/generated/enums';
import {
  mockCreatrice,
  mockPrismaService,
} from './mocksTest/mockCreatriceService';

//- User factice (gérante) injecté à la place de req.user dans les tests
const mockUser: AuthUser = {
  id: 'gerante-id',
  email: 'gerante@test.fr',
  role: Role.GERANTE,
  plan: 'PRO',
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
        { provide: EmailService, useValue: {} },
        { provide: NotificationService, useValue: {} },
        {
          provide: OwnershipService,
          useValue: {
            getOwnedCreatriceWhere: jest.fn().mockReturnValue({}),
            assertCreatriceOwned: jest.fn().mockResolvedValue(mockCreatrice),
          },
        },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get<CreatriceService>(CreatriceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException if creatrice not found', async () => {
    mockPrismaService.creatrice.findUnique.mockResolvedValue(null);
    await expect(service.findOne('id-inexistant', mockUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return a creatrice when found', async () => {
    mockPrismaService.creatrice.findUnique.mockResolvedValue({ ...mockCreatrice, vente: [] });
    //- findOne renvoie la fiche enrichie : ses ventes et ses stats (ca, commission, net)
    const result = await service.findOne('uuid-test', mockUser);
    expect(result).toMatchObject({ id: mockCreatrice.id, nom: mockCreatrice.nom });
    expect(result.stats).toEqual(
      expect.objectContaining({ nbVentes: expect.any(Number), ca: expect.any(Number) }),
    );
  });
});
