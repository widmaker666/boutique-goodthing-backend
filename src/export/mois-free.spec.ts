import { ExportService } from './export.service';
import { currentMois } from 'src/common/month-range.util';

//- Règle FREE : rapports "classiques" limités au mois en cours
describe('ExportService — mois par défaut selon le plan', () => {
  const service: any = new ExportService({} as any, {} as any);
  const user = (plan: string) => ({ id: 'u1', email: 'a@b.c', role: 'GERANTE', plan });

  it('FREE sans mois → mois en cours (plus de tout l\'historique)', () => {
    expect(service.resolveMoisClassique(user('FREE'), undefined)).toBe(currentMois());
  });

  it('FREE + mois en cours → accepté', () => {
    expect(service.resolveMoisClassique(user('FREE'), currentMois())).toBe(currentMois());
  });

  it('FREE + mois passé → 403', () => {
    expect(() => service.resolveMoisClassique(user('FREE'), '2020-01')).toThrow();
  });

  it('PRO et DUO sans mois → tout l\'historique', () => {
    expect(service.resolveMoisClassique(user('PRO'), undefined)).toBeUndefined();
    expect(service.resolveMoisClassique(user('DUO'), undefined)).toBeUndefined();
  });

  it('PRO + mois passé → accepté ; format invalide → erreur', () => {
    expect(service.resolveMoisClassique(user('PRO'), '2025-03')).toBe('2025-03');
    expect(() => service.resolveMoisClassique(user('PRO'), '2025-13')).toThrow();
  });
});
