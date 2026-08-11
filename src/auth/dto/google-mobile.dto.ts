import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from 'src/generated/enums';

export class GoogleMobileDto {
  @IsString()
  accessToken!: string;

  //- Optionnels : uniquement fournis quand le front finalise une INSCRIPTION
  //- (après le formulaire pré-rempli). Absents pour un simple login — dans ce
  //- cas un compte inexistant n'est jamais créé silencieusement.
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  acceptedCGU?: boolean;
}
