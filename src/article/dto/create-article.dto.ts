import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nom!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  prixIndicatif?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantite?: number;

  @IsOptional()
  @IsString()
  creatriceId?: string;
}
