import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SprintStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ChangeSprintStatusDto,
  CreateSprintDto,
  UpdateSprintDto,
} from './dto/sprint.dto';
import { SprintsService } from './sprints.service';

@ApiTags('sprints')
@Controller()
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get('sprints')
  listPublic(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.sprints.listPublic(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('admin/sprints')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  listAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: SprintStatus,
  ) {
    return this.sprints.listAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    );
  }

  @Get('sprints/:id')
  detailPublic(@Param('id', ParseIntPipe) id: number) {
    return this.sprints.detailPublic(id);
  }

  @Get('admin/sprints/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  detailAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.sprints.detail(id);
  }

  @Post('sprints')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  create(@Body() dto: CreateSprintDto) {
    return this.sprints.create(dto);
  }

  @Patch('sprints/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSprintDto) {
    return this.sprints.update(id, dto);
  }

  @Patch('sprints/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeSprintStatusDto,
  ) {
    return this.sprints.changeStatus(id, dto.status);
  }

  @Delete('sprints/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sprints.remove(id);
  }
}
