import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { StatsService } from './stats.service';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';

@UseGuards(JwtGuard)
@Controller('stats')
export class StatsController {
  constructor(private statService: StatsService) {}

  @Get()
  getGlobalStats() {
    return this.statService.getGlobalStats();
  }

  @Get('creatrice/:id')
  getStatsByCreatrice(@Param('id') id: string) {
    return this.statService.getStatsByCreatrice(id);
  }
}
