import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
}
