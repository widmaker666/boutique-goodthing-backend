import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ExportService } from './export.service';
import { Plan, Role } from 'src/generated/enums';
import { Plans } from 'src/auth/guard/plan.decorateur';
import { PlanGuard } from 'src/auth/guard/plan.guard';
import { Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from 'src/auth/guard/role.decorateur';

@UseGuards(JwtGuard, PlanGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  //* GET CREATRICE *//

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
  getexportCsv(@Req() req, @Res() res: Response) {
    return this.exportService.getExportCsv(req.user, res);
  }

  //* GET BOUTIQUE *//

  @Roles(Role.GERANTE)
  @Get('pdf/boutique')
  getexportPdfBoutique(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId: string,
  ) {
    return this.exportService.getExportPdfBoutique(req.user, res, boutiqueId);
  }

  @Roles(Role.GERANTE)
  @Plans(Plan.PRO)
  @Get('excel/boutique')
  getexportExcelBoutique(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId: string,
  ) {
    return this.exportService.getExportExcelBoutique(boutiqueId, res);
  }

  @Roles(Role.GERANTE)
  @Plans(Plan.PRO)
  @Get('csv/boutique')
  getexportCsvBoutique(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId: string,
  ) {
    return this.exportService.getExportCsvBoutique(boutiqueId, res);
  }
}
