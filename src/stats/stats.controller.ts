import { StatsService } from './stats.service';
import { Controller, Get, Param } from '@nestjs/common';

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
