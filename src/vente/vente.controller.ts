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
} from '@nestjs/common';
import { VenteService } from './vente.service';
import { CreateVenteDto } from './dto/create-vente.dto';
import { UpdateVenteDto } from './dto/update-vente.dto';
import { QueryVente } from './dto/query-vente.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@UseGuards(JwtGuard)
@Controller('vente')
export class VenteController {
  constructor(private readonly venteService: VenteService) {}

  @Post()
  create(@Body() createVenteDto: CreateVenteDto) {
    return this.venteService.create(createVenteDto);
  }

  @Get()
  findAll(@Query() filters: QueryVente) {
    return this.venteService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venteService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVenteDto: UpdateVenteDto) {
    return this.venteService.update(id, updateVenteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.venteService.remove(id);
  }
}
