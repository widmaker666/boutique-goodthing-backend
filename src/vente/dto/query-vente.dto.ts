import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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

  //- Filtre par créatrice — n'est honoré côté service QUE pour une gérante
  //- (voir VenteService.findAll) : sans ça une créatrice pourrait composer
  //- ce filtre avec le sien et écraser son propre scope d'ownership.
  @IsString()
  @IsOptional()
  creatriceId?: string;

  //- Filtre par mois ("un mois précis" dans l'UI, même logique que les
  //- exports existants) — bornes ISO inclusives sur Vente.createdAt.
  @IsDateString()
  @IsOptional()
  dateDebut?: string;

  @IsDateString()
  @IsOptional()
  dateFin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  //- Plafonné à 100 : empêche un client de demander toute la table d'un coup
  //- en passant un `take` énorme (le bug qu'on corrige ici, pas à réintroduire
  //- par la bande).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
