import { Module } from '@nestjs/common';
import { MailService } from '../common/mail/mail.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SprintNotificationQueueService } from './sprint-notification.queue';
import { SprintsController } from './sprints.controller';
import { SprintsService } from './sprints.service';

@Module({
  imports: [PrismaModule],
  controllers: [SprintsController],
  providers: [SprintsService, MailService, SprintNotificationQueueService],
  exports: [SprintsService],
})
export class SprintsModule {}
