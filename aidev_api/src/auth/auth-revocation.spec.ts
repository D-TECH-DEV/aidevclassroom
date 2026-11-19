/* eslint-disable @typescript-eslint/require-await */
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('Auth revocation (tokenVersion)', () => {
  it('JwtStrategy rejette un token dont tv ne correspond plus a tokenVersion', async () => {
    const config = {
      getOrThrow: jest.fn(() => 'jwt_test_secret_at_least_32_characters_long'),
    };
    const prisma = {
      user: {
        findUnique: jest.fn(async () => ({
          id: 1,
          email: 'admin@exemple.ci',
          name: 'Admin',
          role: 'ADMIN',
          isActive: true,
          tokenVersion: 2,
        })),
      },
    };
    const strategy = new JwtStrategy(config as never, prisma as never);

    await expect(
      strategy.validate({ sub: 1, email: 'admin@exemple.ci', role: 'ADMIN', tv: 1 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'UNAUTHORIZED' }),
    });

    await expect(
      strategy.validate({ sub: 1, email: 'admin@exemple.ci', role: 'ADMIN' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'UNAUTHORIZED' }),
    });

    await expect(
      strategy.validate({ sub: 1, email: 'admin@exemple.ci', role: 'ADMIN', tv: 2 }),
    ).resolves.toMatchObject({ id: 1, role: 'ADMIN' });
  });

  it('logout incremente tokenVersion', async () => {
    const prisma = {
      user: {
        update: jest.fn(async () => ({ id: 1, tokenVersion: 3 })),
      },
    };
    const auth = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await expect(auth.logout(1)).resolves.toEqual({ loggedOut: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
