import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreatriceResolver } from './creatrice/creatrice.resolver';
import { CreatriceModule } from './creatrice/creatrice.module';

@Module({
  imports: [CreatriceModule],
  controllers: [AppController],
  providers: [AppService, CreatriceResolver],
})
export class AppModule {}
