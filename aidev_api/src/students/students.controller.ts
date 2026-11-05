import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@Controller()
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Post('students')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  register(@Body() dto: CreateStudentDto) {
    return this.students.register(dto);
  }

  @Get('admin/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.students.listAdmin(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  @Get('admin/students/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.students.detailAdmin(id);
  }

  @Patch('admin/students/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto) {
    return this.students.updateAdmin(id, dto);
  }

  @Get('admin/students/:id/enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.students.enrollmentsOf(id);
  }
}
