import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StudentInputDto } from '../../students/dto/student.dto';
import { EnrollmentPlan, EnrollmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateEnrollmentDto {
  @IsInt()
  @IsPositive()
  sprintId!: number;

  @IsOptional()
  @IsEnum(EnrollmentPlan)
  plan?: EnrollmentPlan;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  partnerFirstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  partnerLastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,17}$/, {
    message:
      'Telephone binome invalide : prefixe international requis (ex. +2250700000000).',
  })
  partnerPhone?: string;

  @ValidateNested()
  @Type(() => StudentInputDto)
  @IsNotEmpty()
  student!: StudentInputDto;
}

export class LookupByEmailDto {
  @IsEmail({}, { message: 'E-mail invalide.' })
  email!: string;
}

export class ChangeEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;
}
