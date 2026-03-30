import {
  IsEmail,
  IsNumber,
  IsPhoneNumber,
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
  nom: string;
  @IsEmail()
  email?: string;

  @IsPhoneNumber('FR')
  telephone?: string;
  @IsNumber()
  tauxDeCommission: number;
}
