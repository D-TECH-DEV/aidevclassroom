import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateSiteContentDto } from './dto/site-content.dto';
import { SiteContentService } from './site-content.service';

@ApiTags('site-content')
@Controller()
export class SiteContentController {
  constructor(private readonly siteContent: SiteContentService) {}

  @Get('site-content')
  getPublic() {
    return this.siteContent.getPublicContent();
  }

  @Get('admin/site-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  getAdmin() {
    return this.siteContent.getPublicContent();
  }

  @Patch('admin/site-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  updateAdmin(@Body() dto: UpdateSiteContentDto) {
    return this.siteContent.updateContent(dto);
  }
}
