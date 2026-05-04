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
import { EvenementService } from './evenement.service';
import { CreateEvenementDto } from './dto/create-evenement.dto';
import { UpdateEvenementDto } from './dto/update-evenement.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@UseGuards(JwtGuard)
@Controller('evenement')
export class EvenementController {
  constructor(private readonly evenementService: EvenementService) {}

  @Post()
  create(@Body() dto: CreateEvenementDto) {
    return this.evenementService.create(dto);
  }

  @Get()
  findAll(@Query('creatriceId') creatriceId?: string) {
    return this.evenementService.findAll(creatriceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.evenementService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEvenementDto) {
    return this.evenementService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.evenementService.remove(id);
  }
}
