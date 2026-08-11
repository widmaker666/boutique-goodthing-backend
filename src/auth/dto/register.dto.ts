import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from 'src/generated/enums';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  nom?: string;

  @IsString()
  @IsOptional()
  prenom?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  //- Doit être `true` pour que le compte soit créé — vérifié côté service, pas juste ici
  @IsBoolean()
  acceptedCGU!: boolean;
}
