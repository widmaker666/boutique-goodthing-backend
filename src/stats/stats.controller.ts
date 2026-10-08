import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { StatsService } from './stats.service';
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { resolveRole } from 'src/common/resolve-role.util';

@UseGuards(JwtGuard)
@Controller('stats')
export class StatsController {
  constructor(private statService: StatsService) {}

  @Get()
  getGlobalStats(
    @Req() req,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('evenementId') evenementId?: string,
    @Query('mode') mode?: string,
    @Query('mois') mois?: string,
  ) {
    return this.statService.getGlobalStats(
      req.user.id,
      resolveRole(req.user.role, mode),
      req.user.plan,
      boutiqueId,
      evenementId,
      mois,
    );
  }

  @Get('historique')
  getHistorique(
    @Req() req,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('evenementId') evenementId?: string,
    @Query('mode') mode?: string,
  ) {
    return this.statService.getHistorique(
      req.user.id,
      resolveRole(req.user.role, mode),
      boutiqueId,
      evenementId,
    );
  }

  @Get('top-articles')
  getTopArticles(
    @Req() req,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('evenementId') evenementId?: string,
    @Query('mode') mode?: string,
    @Query('mois') mois?: string,
  ) {
    return this.statService.getTopArticles(
      req.user.id,
      resolveRole(req.user.role, mode),
      req.user.plan,
      boutiqueId,
      evenementId,
      mois,
    );
  }

  @Get('par-creatrice')
  getParCreatrice(
    @Req() req,
    @Query('mode') mode?: string,
    @Query('mois') mois?: string,
  ) {
    if (resolveRole(req.user.role, mode) !== 'GERANTE') return [];
    return this.statService.getParCreatrice(req.user.id, req.user.plan, mois);
  }

  @Get('creatrice/:id')
  getStatsByCreatrice(@Param('id') id: string, @Req() req) {
    return this.statService.getStatsByCreatrice(id, req.user);
  }
}
