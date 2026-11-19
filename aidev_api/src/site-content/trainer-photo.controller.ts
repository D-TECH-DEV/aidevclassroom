import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

type UploadedPngFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.png$/;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'formateurs');

export function isValidPngBuffer(buf?: Buffer): boolean {
  return Boolean(buf && buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC));
}

@ApiTags('site-content')
@Controller()
export class TrainerPhotoController {
  @Post('admin/site-content/trainer-photo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('jwt')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_SIZE_BYTES } }),
  )
  async uploadTrainerPhoto(@UploadedFile() file?: UploadedPngFile) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Aucun fichier PNG reçu.',
      });
    }
    if (file.mimetype !== 'image/png' || !isValidPngBuffer(file.buffer)) {
      throw new BadRequestException({
        code: 'INVALID_PNG',
        message: 'Seules les images au format PNG valide sont acceptées.',
      });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.png`;
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);

    return {
      filename,
      photoPath: `/api/media/formateurs/${filename}`,
    };
  }

  @Get('uploads/formateurs/:filename')
  async serveTrainerPhoto(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!SAFE_FILENAME.test(filename)) {
      throw new NotFoundException('Fichier introuvable.');
    }
    const target = join(UPLOAD_DIR, filename);
    if (!existsSync(target)) {
      throw new NotFoundException('Fichier introuvable.');
    }

    const data = await readFile(target);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(data);
  }
}
