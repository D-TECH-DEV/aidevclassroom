import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class CreateSprintDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @IsPositive({ message: 'Le prix doit etre un entier positif.' })
  priceXof!: number;

  @IsInt()
  @Min(1)
  minimumPaymentXof!: number;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsEnum(SprintStatus)
  status?: SprintStatus;
}

export class UpdateSprintDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  priceXof?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minimumPaymentXof?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;
}

export class ChangeSprintStatusDto {
  @IsEnum(SprintStatus)
  status!: SprintStatus;
}
