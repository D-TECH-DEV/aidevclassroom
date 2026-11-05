import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary() {
    return this.dashboard.summary();
  }

  @Get('recent-enrollments')
  recentEnrollments(@Query('limit') limit?: string) {
    return this.dashboard.recentEnrollments(limit ? parseInt(limit, 10) : 10);
  }

  @Get('recent-payments')
  recentPayments(@Query('limit') limit?: string) {
    return this.dashboard.recentPayments(limit ? parseInt(limit, 10) : 10);
  }

  @Get('collections')
  collections(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboard.collections(from, to);
  }

  @Get('outstanding-balances')
  outstanding(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.dashboard.outstandingBalances(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
