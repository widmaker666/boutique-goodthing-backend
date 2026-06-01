import { IsOptional, IsString } from 'class-validator';

export class QueryArticleDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  creatriceId?: string;
}
