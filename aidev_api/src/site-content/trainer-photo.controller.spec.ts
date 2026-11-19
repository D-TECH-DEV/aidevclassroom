import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  isValidPngBuffer,
  TrainerPhotoController,
} from './trainer-photo.controller';

describe('TrainerPhotoController', () => {
  const controller = new TrainerPhotoController();

  it('rejette un fichier absent ou non PNG', async () => {
    await expect(controller.uploadTrainerPhoto(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      controller.uploadTrainerPhoto({
        buffer: Buffer.from('not-a-png'),
        mimetype: 'image/jpeg',
        size: 9,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('valide la signature binaire PNG', () => {
    const valid = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(isValidPngBuffer(valid)).toBe(true);
    expect(isValidPngBuffer(Buffer.from('hello'))).toBe(false);
  });

  it('bloque les noms de fichiers non securises (path traversal)', async () => {
    const fakeRes = {} as never;
    await expect(
      controller.serveTrainerPhoto('../secret.png', fakeRes),
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.serveTrainerPhoto('photo.jpg', fakeRes),
    ).rejects.toThrow(NotFoundException);
  });
});
