import { ENROLLMENT_TRANSITIONS } from './enrollments.service';
import { SPRINT_TRANSITIONS } from '../sprints/sprints.service';

describe('Transitions inscription (RG07 : etats separes)', () => {
  it('PENDING peut etre confirme ou annule, jamais termine directement', () => {
    expect(ENROLLMENT_TRANSITIONS.PENDING).toEqual(
      expect.arrayContaining(['CONFIRMED', 'CANCELLED']),
    );
    expect(ENROLLMENT_TRANSITIONS.PENDING).not.toContain('COMPLETED');
  });

  it('CANCELLED et COMPLETED sont terminaux', () => {
    expect(ENROLLMENT_TRANSITIONS.CANCELLED).toEqual([]);
    expect(ENROLLMENT_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it('un paiement echoue ne figure dans aucune transition inscription', () => {
    const all = Object.values(ENROLLMENT_TRANSITIONS).flat();
    expect(all).not.toContain('FAILED');
    expect(all).not.toContain('SUCCESS');
  });
});

describe('Transitions sprint (RG07)', () => {
  it('COMPLETED est terminal et DRAFT ne va pas directement a COMPLETED', () => {
    expect(SPRINT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(SPRINT_TRANSITIONS.DRAFT).not.toContain('COMPLETED');
  });
});
