import { Module } from '@nestjs/common';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { PrismaService } from 'src/prisma.service';
import { OwnershipModule } from 'src/common/ownership/ownership.module';

@Module({
  imports: [OwnershipModule],
  controllers: [ArticleController],
  providers: [ArticleService, PrismaService],
})
export class ArticleModule {}
