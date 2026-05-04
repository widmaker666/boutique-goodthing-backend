import { IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateEvenementDto {
  @IsString()
  nom!: string;

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @IsUUID()
  creatriceId!: string;
}
