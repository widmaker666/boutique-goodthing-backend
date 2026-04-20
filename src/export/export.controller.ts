import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ExportService } from './export.service';
import { Plan } from 'src/generated/enums';
import { Plans } from 'src/auth/guard/plan.decorateur';
import { PlanGuard } from 'src/auth/guard/plan.guard';
import { Res } from '@nestjs/common';
import { Response } from 'express';

@UseGuards(JwtGuard, PlanGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('pdf')
  getexportPdf(@Req() req, @Res() res: Response) {
    return this.exportService.getExportPdf(req.user, res);
  }

  @Plans(Plan.PRO)
  @Get('excel')
  getexportExcel() {
    return this.exportService.getExportExcel();
  }

  @Plans(Plan.PRO)
  @Get('csv')
  getexportCsv() {
    return this.exportService.getExportCsv();
  }
}
