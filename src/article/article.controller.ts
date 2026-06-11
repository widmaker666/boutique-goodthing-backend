import {
  BadRequestException,
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

  @Post()
  create(@Body() dto: CreateArticleDto, @Request() req) {
    return this.articleService.create(dto, req.user);
  }

  @Get()
  findAll(@Query() query: QueryArticleDto, @Request() req) {
    return this.articleService.findAll(query, req.user);
  }

  //- Import bulk CSV/Excel — DOIT être avant @Get(':id') pour éviter le conflit de route
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Seuls les fichiers CSV/Excel sont autorisés'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  importArticles(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Query('creatriceId') creatriceId?: string,
    @Query('evenementId') evenementId?: string,
  ) {
    return this.articleService.importFromFile(file, creatriceId, evenementId, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.articleService.findOne(id, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto, @Request() req) {
    return this.articleService.update(id, dto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.articleService.remove(id, req.user);
  }
}
