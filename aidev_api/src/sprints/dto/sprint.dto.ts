import {
  ArrayMaxSize,
  IsArray,
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

  @IsOptional()
  @IsInt()
  @Min(1)
  duoPriceXof?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  duoMinimumPaymentXof?: number;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  format?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  level?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  modules?: string[];

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
  @IsInt()
  @Min(1)
  duoPriceXof?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  duoMinimumPaymentXof?: number | null;

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  format?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  level?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  modules?: string[] | null;
}

export class ChangeSprintStatusDto {
  @IsEnum(SprintStatus)
  status!: SprintStatus;
}
