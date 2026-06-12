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
import { CreatriceService } from './creatrice.service';
import { CreateCreatriceDto } from './dto/create-creatrice.dto';
import { UpdateCreatriceDto } from './dto/update-creatrice.dto';
import { QueryCreatrice } from './dto/query-creatrice.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { Roles } from 'src/auth/guard/role.decorateur';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { Role } from 'src/generated/enums';

@UseGuards(JwtGuard, RolesGuard)
@Controller('creatrice')
export class CreatriceController {
  constructor(private readonly creatriceService: CreatriceService) {}

  @Post()
  async create(@Body() createCreatriceDto: CreateCreatriceDto, @Req() req) {
    return this.creatriceService.create(createCreatriceDto, req.user);
  }

  @Get()
  findAll(@Query() filters: QueryCreatrice, @Req() req) {
    return this.creatriceService.findAll(filters, req.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    return this.creatriceService.findOne(id, req.user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCreatriceDto: UpdateCreatriceDto,
    @Req() req,
  ) {
    return this.creatriceService.update(id, updateCreatriceDto, req.user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    return this.creatriceService.remove(id, req.user);
  }

  @Roles(Role.GERANTE)
  @Post(':id/invite')
  inviteCreatrice(
    @Param('id') id: string,
    @Body('email') email: string,
    @Body('boutiqueId') boutiqueId: string,
    @Req() req,
  ) {
    return this.creatriceService.inviteCreatrice(id, email, boutiqueId, req.user);
  }

  //- Accessible à CREATRICE et GERANTE — pas de @Roles restrictif
  @Post(':id/accept-invitation')
  acceptInvitation(
    @Param('id') id: string,
    @Body('boutiqueId') boutiqueId: string,
    @Req() req,
  ) {
    return this.creatriceService.acceptInvitation(id, boutiqueId, req.user);
  }
}
