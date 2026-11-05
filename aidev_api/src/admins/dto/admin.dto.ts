import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsEmail({}, { message: 'E-mail invalide.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: '8 caracteres minimum.' })
  @MaxLength(128)
  password!: string;
}

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail invalide.' })
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
