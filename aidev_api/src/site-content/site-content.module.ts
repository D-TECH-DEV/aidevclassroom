import { Module } from '@nestjs/common';
import { SiteContentController } from './site-content.controller';
import { SiteContentService } from './site-content.service';
import { TrainerPhotoController } from './trainer-photo.controller';

@Module({
  controllers: [SiteContentController, TrainerPhotoController],
  providers: [SiteContentService],
  exports: [SiteContentService],
})
export class SiteContentModule {}
