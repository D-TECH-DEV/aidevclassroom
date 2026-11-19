import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'E-mail invalide.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mot de passe requis.' })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(12, { message: '12 caracteres minimum.' })
  @MaxLength(128)
  newPassword!: string;
}
