import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { ExportService } from './export.service';
import { Plan, Role } from 'src/generated/enums';
import { Plans } from 'src/auth/guard/plan.decorateur';
import { PlanGuard } from 'src/auth/guard/plan.guard';
import { Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from 'src/auth/guard/role.decorateur';
import { RolesGuard } from 'src/auth/guard/roles.guard';

//- DUO débloque exactement ce que PRO débloque : ne jamais écrire @Plans(Plan.PRO) seul
//  (PlanGuard teste l'appartenance exacte, DUO serait refusé en 403).
const PAID_PLANS = [Plan.PRO, Plan.DUO];

//- Un query param répété (?a=1&a=2) arrive en tableau : on n'accepte qu'une chaîne
const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

@UseGuards(JwtGuard, PlanGuard, RolesGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  //* GET CREATRICE *//

  @Get('pdf')
  getexportPdf(@Req() req, @Res() res: Response) {
    return this.exportService.getExportPdf(req.user, res);
  }

  @Plans(...PAID_PLANS)
  @Get('excel')
  getexportExcel(@Req() req, @Res() res: Response) {
    return this.exportService.getExportExcel(req.user, res);
  }

  @Plans(...PAID_PLANS)
  @Get('csv')
  getexportCsv(@Req() req, @Res() res: Response) {
    return this.exportService.getExportCsv(req.user, res);
  }

  //* GET BOUTIQUE (récap par créatrice) *//

  @Roles(Role.GERANTE)
  @Get('pdf/boutique')
  getexportPdfBoutique(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId?: string,
  ) {
    return this.exportService.getExportPdfBoutique(req.user, res, boutiqueId);
  }

  @Roles(Role.GERANTE)
  @Plans(...PAID_PLANS)
  @Get('excel/boutique')
  getexportExcelBoutique(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId?: string,
  ) {
    return this.exportService.getExportExcelBoutique(boutiqueId, res, req.user);
  }

  @Roles(Role.GERANTE)
  @Plans(...PAID_PLANS)
  @Get('csv/boutique')
  getexportCsvBoutique(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId?: string,
  ) {
    return this.exportService.getExportCsvBoutique(boutiqueId, res, req.user);
  }

  //* GET DÉTAIL DES VENTES (gérante) — toute la boutique, ou une créatrice (?creatriceId=) *//
  //- ?mois=AAAA-MM : les ventes de ce mois (absent = tout l'historique)
  //- FREE : PDF uniquement (csv/excel restent réservés PRO/DUO) et mois en cours uniquement

  @Roles(Role.GERANTE)
  @Get('pdf/ventes')
  getexportPdfVentes(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('creatriceId') creatriceId?: string,
    @Query('mois') mois?: string,
  ) {
    return this.exportService.getExportVentesGerante(
      req.user,
      res,
      'pdf',
      asString(boutiqueId),
      asString(creatriceId),
      asString(mois),
    );
  }

  @Roles(Role.GERANTE)
  @Plans(...PAID_PLANS)
  @Get('excel/ventes')
  getexportExcelVentes(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('creatriceId') creatriceId?: string,
    @Query('mois') mois?: string,
  ) {
    return this.exportService.getExportVentesGerante(
      req.user,
      res,
      'excel',
      asString(boutiqueId),
      asString(creatriceId),
      asString(mois),
    );
  }

  @Roles(Role.GERANTE)
  @Plans(...PAID_PLANS)
  @Get('csv/ventes')
  getexportCsvVentes(
    @Req() req,
    @Res() res: Response,
    @Query('boutiqueId') boutiqueId?: string,
    @Query('creatriceId') creatriceId?: string,
    @Query('mois') mois?: string,
  ) {
    return this.exportService.getExportVentesGerante(
      req.user,
      res,
      'csv',
      asString(boutiqueId),
      asString(creatriceId),
      asString(mois),
    );
  }
}
