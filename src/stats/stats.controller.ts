import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { StatsService } from './stats.service';
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';

@UseGuards(JwtGuard)
@Controller('stats')
export class StatsController {
  constructor(private statService: StatsService) {}

  @Get()
  getGlobalStats(
    @Req() req,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('evenementId') evenementId?: string,
  ) {
    return this.statService.getGlobalStats(
      req.user.id,
      req.user.role,
      req.user.plan,
      boutiqueId,
      evenementId,
    );
  }

  @Get('historique')
  getHistorique(
    @Req() req,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('evenementId') evenementId?: string,
  ) {
    return this.statService.getHistorique(req.user.id, req.user.role, boutiqueId, evenementId);
  }

  @Get('top-articles')
  getTopArticles(
    @Req() req,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('evenementId') evenementId?: string,
  ) {
    return this.statService.getTopArticles(
      req.user.id,
      req.user.role,
      req.user.plan,
      boutiqueId,
      evenementId,
    );
  }

  @Get('par-creatrice')
  getParCreatrice(@Req() req) {
    if (req.user.role !== 'GERANTE') return [];
    return this.statService.getParCreatrice(req.user.id, req.user.plan);
  }

  @Get('creatrice/:id')
  getStatsByCreatrice(@Param('id') id: string, @Req() req) {
    return this.statService.getStatsByCreatrice(id, req.user);
  }
}
