import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { StatsService } from './stats.service';
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';

@UseGuards(JwtGuard)
@Controller('stats')
export class StatsController {
  constructor(private statService: StatsService) {}

  @Get()
  getGlobalStats(@Req() req) {
    return this.statService.getGlobalStats(req.user.id, req.user.role);
  }

  @Get('creatrice/:id')
  getStatsByCreatrice(@Param('id') id: string) {
    return this.statService.getStatsByCreatrice(id);
  }
}
