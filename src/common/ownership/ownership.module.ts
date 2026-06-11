import { Module } from '@nestjs/common';
import { OwnershipService } from './ownership.service';
import { PrismaService } from 'src/prisma.service';

//- Module partagé exposant OwnershipService — importé par les modules métier
//- nécessitant un contrôle d'accès aux ressources (créatrices, ventes, etc.)
@Module({
  providers: [OwnershipService, PrismaService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
