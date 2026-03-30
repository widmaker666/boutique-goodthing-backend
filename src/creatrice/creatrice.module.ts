import { Module } from '@nestjs/common';
import { CreatriceService } from './creatrice.service';
import { CreatriceController } from './creatrice.controller';

@Module({
  controllers: [CreatriceController],
  providers: [CreatriceService],
})
export class CreatriceModule {}
