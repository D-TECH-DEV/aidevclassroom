import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class StudentInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsEmail({}, { message: 'E-mail invalide.' })
  email!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{6,17}$/, {
    message:
      'Telephone invalide : prefixe international requis (ex. +2250700000000).',
  })
  phone!: string;
}

export class CreateStudentDto extends StudentInputDto {}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,17}$/, { message: 'Telephone invalide.' })
  phone?: string;
}
