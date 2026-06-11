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
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { VenteService } from './vente.service';
import { CreateVenteDto } from './dto/create-vente.dto';
import { UpdateVenteDto } from './dto/update-vente.dto';
import { QueryVente } from './dto/query-vente.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { FileInterceptor } from '@nestjs/platform-express';

@UseGuards(JwtGuard)
@Controller('vente')
export class VenteController {
  // Dans le constructor, ajoute CloudinaryService :
  constructor(
    private readonly venteService: VenteService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Seules les images sont autorisées'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async create(
    @Req() req,
    @Body() createVenteDto: CreateVenteDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let photoUrl: string | undefined;
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      photoUrl = uploaded.secure_url;
    }
    return this.venteService.create(createVenteDto, req.user, photoUrl);
  }

  @Get()
  findAll(@Query() filters: QueryVente, @Req() req) {
    return this.venteService.findAll(filters, req.user);
  }

  @Get('recent')
  getRecent(@Req() req) {
    return this.venteService.getRecentVentes(req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.venteService.findOne(id, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateVenteDto: UpdateVenteDto,
    @Req() req,
  ) {
    return this.venteService.update(id, updateVenteDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.venteService.remove(id, req.user);
  }
}
