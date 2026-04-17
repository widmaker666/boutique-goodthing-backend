import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCreatriceDto {
  @MinLength(2, {
    message: 'Le nom est trop court',
  })
  @MaxLength(50, {
    message: 'Le nom est trop long',
  })
  @IsString()
  nom!: string;
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber('FR')
  telephone?: string;

  @IsNumber()
  tauxDeCommission!: number;
}
