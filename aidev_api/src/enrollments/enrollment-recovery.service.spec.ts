/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment */
import { EnrollmentRecoveryService } from './enrollment-recovery.service';

describe('EnrollmentRecoveryService (OTP 6 chiffres)', () => {
  function makeDeps(studentsFound: Array<{ email: string }> = []) {
    const prisma = {
      student: {
        findMany: jest.fn(async () => studentsFound),
      },
    };
    const enrollments = {
      findByContact: jest.fn(async () => ({
        dossiers: [{ id: 10, trackingToken: 'tok_new' }],
      })),
    };
    const mail = {
      sendRecoveryOtpEmail: jest.fn(async () => true),
    };
    return {
      prisma,
      enrollments,
      mail,
      svc: new EnrollmentRecoveryService(
        prisma as never,
        enrollments as never,
        mail as never,
      ),
    };
  }

  it('retourne une reponse neutre et envoie un code 6 chiffres si dossier actif', async () => {
    const { svc, mail } = makeDeps([{ email: 'amina@exemple.ci' }]);
    const res = await svc.requestOtp('Amina@Exemple.ci');
    expect(res).toEqual({ sent: true, expiresInSeconds: 600 });
    expect(mail.sendRecoveryOtpEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendRecoveryOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'amina@exemple.ci',
        code: expect.stringMatching(/^\d{6}$/),
        expiresMinutes: 10,
      }),
    );
  });

  it('retourne la meme reponse neutre sans envoyer mail si compte inexistant', async () => {
    const { svc, mail } = makeDeps([]);
    const res = await svc.requestOtp('inconnu@exemple.ci');
    expect(res).toEqual({ sent: true, expiresInSeconds: 600 });
    expect(mail.sendRecoveryOtpEmail).not.toHaveBeenCalled();
  });

  it('valide le code OTP a usage unique puis invalide apres usage', async () => {
    const { svc, mail, enrollments } = makeDeps([{ email: 'a@exemple.ci' }]);
    await svc.requestOtp('a@exemple.ci');
    const sentCode = (mail.sendRecoveryOtpEmail.mock.calls[0] as unknown[])[0] as {
      code: string;
    };
    const out = await svc.verifyOtp('a@exemple.ci', undefined, sentCode.code);
    expect(enrollments.findByContact).toHaveBeenCalledWith(
      'a@exemple.ci',
      undefined,
    );
    expect(out.dossiers).toHaveLength(1);

    await expect(
      svc.verifyOtp('a@exemple.ci', undefined, sentCode.code),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECOVERY_OTP_INVALID' }),
    });
  });

  it('invalide definitivement le code apres 5 tentatives erronees', async () => {
    const { svc, mail } = makeDeps([{ email: 'brute@exemple.ci' }]);
    await svc.requestOtp('brute@exemple.ci');
    const sentCode = (mail.sendRecoveryOtpEmail.mock.calls[0] as unknown[])[0] as {
      code: string;
    };
    const wrong = sentCode.code === '000000' ? '999999' : '000000';

    for (let i = 0; i < 5; i++) {
      await expect(
        svc.verifyOtp('brute@exemple.ci', undefined, wrong),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RECOVERY_OTP_INVALID' }),
      });
    }

    await expect(
      svc.verifyOtp('brute@exemple.ci', undefined, sentCode.code),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECOVERY_OTP_INVALID' }),
    });
  });
});
