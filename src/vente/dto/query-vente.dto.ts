import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ModePaiement } from 'src/generated/enums';

export class QueryVente {
  @IsString()
  @IsOptional()
  nomArticle: string;

  @IsOptional()
  @Type(() => Number)
  minPrixVente: number;

  @IsOptional()
  @Type(() => Number)
  maxPrixVente: number;

  @IsOptional()
  @IsEnum(ModePaiement)
  modePaiement: ModePaiement;

  @IsString()
  @IsOptional()
  boutiqueId?: string;

  @IsString()
  @IsOptional()
  evenementId?: string;
}
