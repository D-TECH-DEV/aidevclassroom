import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

function trimToNull({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class UpdateTrainerItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  role!: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^(?:\/|https:\/\/)/, {
    message: 'photoPath doit commencer par / ou https://.',
  })
  photoPath?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^(?:\/|https:\/\/)/, {
    message: 'badgePath doit commencer par / ou https://.',
  })
  badgePath?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  bio?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'githubUrl doit etre une URL HTTPS valide.' },
  )
  @MaxLength(255)
  githubUrl?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'linkedinUrl doit etre une URL HTTPS valide.' },
  )
  @MaxLength(255)
  linkedinUrl?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'portfolioUrl doit etre une URL HTTPS valide.' },
  )
  @MaxLength(255)
  portfolioUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateFaqItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  question!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2500)
  answer?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSiteContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  whatsappDisplay!: string;

  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'whatsappHref doit etre une URL HTTPS valide (ex: https://wa.me/225...).' },
  )
  @MaxLength(255)
  whatsappHref!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => UpdateTrainerItemDto)
  trainers?: UpdateTrainerItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => UpdateFaqItemDto)
  faqs?: UpdateFaqItemDto[];
}
