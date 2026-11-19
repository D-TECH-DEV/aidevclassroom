/* eslint-disable @typescript-eslint/require-await */
import { StudentsService } from './students.service';

describe('StudentsService (isolation PII)', () => {
  it('register retourne uniquement { id } pour un nouveau et un existant sans fuiter aucune PII', async () => {
    const prisma = {
      student: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 42,
            firstName: 'Secret',
            lastName: 'User',
            email: 'secret@exemple.ci',
            phone: '+2250700000000',
          })
          .mockResolvedValueOnce(null),
        create: jest.fn(async () => ({
          id: 99,
          firstName: 'Nouveau',
          lastName: 'Participant',
          email: 'nouveau@exemple.ci',
          phone: '+2250700000001',
        })),
      },
    };
    const svc = new StudentsService(prisma as never);

    const existingOut = await svc.register({
      firstName: 'Fake',
      lastName: 'Name',
      email: 'secret@exemple.ci',
      phone: '+2250101010101',
    });
    expect(existingOut).toEqual({ id: 42 });
    expect(Object.keys(existingOut)).toEqual(['id']);

    const createdOut = await svc.register({
      firstName: 'Nouveau',
      lastName: 'Participant',
      email: 'nouveau@exemple.ci',
      phone: '+2250700000001',
    });
    expect(createdOut).toEqual({ id: 99 });
    expect(Object.keys(createdOut)).toEqual(['id']);
  });
});
