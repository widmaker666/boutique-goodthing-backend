import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class QueryCreatrice {
  @IsOptional()
  nom: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minCommision: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCommision: number;
}
