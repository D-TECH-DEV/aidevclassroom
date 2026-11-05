import { IsInt, IsNotEmpty, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StudentInputDto } from '../../students/dto/student.dto';
import { EnrollmentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CreateEnrollmentDto {
  @IsInt()
  @IsPositive()
  sprintId!: number;

  @ValidateNested()
  @Type(() => StudentInputDto)
  @IsNotEmpty()
  student!: StudentInputDto;
}

export class ChangeEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;
}
