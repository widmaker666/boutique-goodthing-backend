import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { BoutiqueService } from './boutique.service';
import { Roles } from 'src/auth/guard/role.decorateur';
import { CreateBoutiqueDto } from './dto/create-boutique.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { Role } from 'src/generated/enums';
import { UpdateMemberStatusDto } from './dto/update-memberStatus.dto';
import { UpdatePlanMemberDto } from './dto/update-memberPlan.dto';

@UseGuards(JwtGuard, RolesGuard)
@Controller('boutique')
export class BoutiqueController {
  constructor(private readonly boutiqueService: BoutiqueService) {}

  @Roles(Role.GERANTE)
  @Get('avec-stats')
  getBoutiquesAvecStats(@Req() req) {
    return this.boutiqueService.getBoutiquesAvecStats(req.user.id);
  }

  @Roles(Role.GERANTE)
  @Get('stats')
  getBoutiqueStats(@Req() req) {
    return this.boutiqueService.getBoutiqueStats(req.user.id);
  }

  @Get()
  findAll(@Req() req) {
    return this.boutiqueService.findAll(req.user.id);
  }

  @Roles(Role.GERANTE)
  @Post()
  createBoutique(@Body() createBoutique: CreateBoutiqueDto, @Req() req) {
    return this.boutiqueService.createBoutique(createBoutique, req.user.id);
  }

  @Roles(Role.GERANTE)
  @Post(':id/member')
  createMemeber(
    @Body() createMember: CreateMemberDto,
    @Param('id') id: string,
  ) {
    return this.boutiqueService.createMember(createMember, id);
  }

  @Roles(Role.GERANTE)
  @Patch(':id/member/:memberId/status')
  uploadStatusMember(
    @Param('id') id: string,
    @Body() updateMemberStatus: UpdateMemberStatusDto,
    @Param('memberId') memberId: string,
  ) {
    return this.boutiqueService.updateMemberStatus(
      id,
      updateMemberStatus,
      memberId,
    );
  }

  @Roles(Role.GERANTE)
  @Patch(':id/member/:memberId/plan')
  uploadPlanMember(
    @Param('id') id: string,
    @Body() updatePlanMember: UpdatePlanMemberDto,
    @Param('memberId') memberId: string,
  ) {
    return this.boutiqueService.updatePlanMember(
      id,
      updatePlanMember,
      memberId,
    );
  }
}
