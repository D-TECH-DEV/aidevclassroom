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
import { EnrollmentStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TrackingTokenGuard } from '../common/guards/tracking-token.guard';
import {
  ChangeEnrollmentStatusDto,
  CreateEnrollmentDto,
  LookupByEmailDto,
} from './dto/enrollment.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Post('enrollments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollments.create(dto.sprintId, dto.student, dto.plan, {
      firstName: dto.partnerFirstName,
      lastName: dto.partnerLastName,
      phone: dto.partnerPhone,
      email: dto.partnerEmail,
    });
  }

  @Post('enrollments/by-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  byEmail(@Body() dto: LookupByEmailDto) {
    return this.enrollments.findByEmail(dto.email);
  }

  @Get('admin/enrollments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sprintId') sprintId?: string,
    @Query('status') status?: EnrollmentStatus,
    @Query('search') search?: string,
  ) {
    return this.enrollments.listAdmin(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      {
        sprintId: sprintId ? parseInt(sprintId, 10) : undefined,
        status,
        search,
      },
    );
  }

  @Get('admin/enrollments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.enrollments.detailAdmin(id);
  }

  @Get('enrollments/:id/status')
  @UseGuards(TrackingTokenGuard)
  status(@Param('id', ParseIntPipe) id: number) {
    return this.enrollments.statusForParticipant(id);
  }

  @Patch('admin/enrollments/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeEnrollmentStatusDto,
  ) {
    return this.enrollments.changeStatus(id, dto.status);
  }

  @Get('admin/enrollments/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  payments(@Param('id', ParseIntPipe) id: number) {
    return this.enrollments.paymentsOf(id);
  }
}
