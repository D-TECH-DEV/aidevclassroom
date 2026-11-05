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

export class RegisterDto {
  @IsEmail({}, { message: 'E-mail invalide?' })
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
  @MinLength(8, { message: '8 caracteres minimum.' })
  @MaxLength(128)
  newPassword!: string;
}
