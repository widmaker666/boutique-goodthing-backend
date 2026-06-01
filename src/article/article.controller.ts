import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@UseGuards(JwtGuard)
@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  //- creatriceId priorité : body > query param
  @Post()
  create(
    @Body() dto: CreateArticleDto,
    @Query('creatriceId') creatriceIdQuery?: string,
  ) {
    const creatriceId = dto.creatriceId ?? creatriceIdQuery ?? '';
    return this.articleService.create(dto, creatriceId);
  }

  @Get()
  findAll(@Query() query: QueryArticleDto) {
    return this.articleService.findAll(query);
  }

  //- Import bulk CSV/Excel — DOIT être avant @Get(':id') pour éviter le conflit de route
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  importArticles(
    @UploadedFile() file: Express.Multer.File,
    @Query('creatriceId') creatriceId: string,
  ) {
    return this.articleService.importFromFile(file, creatriceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articleService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articleService.remove(id);
  }
}
