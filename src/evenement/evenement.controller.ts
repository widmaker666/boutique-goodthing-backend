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
  Req,
} from '@nestjs/common';
import { EvenementService } from './evenement.service';
import { CreateEvenementDto } from './dto/create-evenement.dto';
import { UpdateEvenementDto } from './dto/update-evenement.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@UseGuards(JwtGuard)
@Controller('evenement')
export class EvenementController {
  constructor(private readonly evenementService: EvenementService) {}

  @Post('mon-evenement')
  creerMonEvenement(@Body() body: { nom: string }, @Req() req) {
    return this.evenementService.creerMonEvenement(
      req.user.id,
      body.nom,
      req.user.plan,
    );
  }

  @Post()
  create(@Body() dto: CreateEvenementDto, @Req() req) {
    return this.evenementService.create(dto, req.user);
  }

  @Get()
  findAll(@Req() req, @Query('creatriceId') creatriceId?: string) {
    return this.evenementService.findAll(req.user, creatriceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.evenementService.findOne(id, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEvenementDto, @Req() req) {
    return this.evenementService.update(id, dto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.evenementService.remove(id, req.user);
  }

}
