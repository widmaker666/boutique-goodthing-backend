import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ModePaiement } from 'src/generated/enums';

export class CreateVenteDto {
  @IsString()
  @MinLength(2, {
    message: 'Le nom est trop court',
  })
  @MaxLength(100, {
    message: 'Le nom est trop long',
  })
  nomArticle!: string;

  @Type(() => Number)
  @IsNumber()
  prixVente!: number;

  @IsEnum(ModePaiement)
  modePaiement!: ModePaiement;

  @IsUUID()
  creatriceId!: string;

  @IsOptional()
  @IsUUID()
  boutiqueId?: string;

  @IsOptional()
  @IsUUID()
  evenementId?: string;

  @IsOptional()
  @IsString()
  articleId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantite?: number;
}
