export const mockPrismaService = {
  creatrice: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

export const mockCreatrice = {
  id: 'uuid-test',
  nom: 'Marie',
  email: null,
  telephone: null,
  tauxDeCommission: 30,
  createdAt: new Date(),
};
