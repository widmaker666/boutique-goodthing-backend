import { currentMois, moisLabel, moisRange } from './month-range.util';

describe('moisRange (bornes à l\'heure de Paris)', () => {
  it("septembre (heure d'été, UTC+2) : minuit Paris = 22h la veille en UTC", () => {
    const { debut, fin } = moisRange('2026-09');
    expect(debut.toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-09-30T22:00:00.000Z');
  });

  it("janvier (heure d'hiver, UTC+1)", () => {
    const { debut, fin } = moisRange('2026-01');
    expect(debut.toISOString()).toBe('2025-12-31T23:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-01-31T23:00:00.000Z');
  });

  it('mars : la fin tombe après le passage à l\'heure d\'été', () => {
    const { debut, fin } = moisRange('2026-03');
    expect(debut.toISOString()).toBe('2026-02-28T23:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-03-31T22:00:00.000Z');
  });

  it("décembre : la fin est le 1er janvier de l'année suivante", () => {
    const { debut, fin } = moisRange('2026-12');
    expect(debut.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('une vente à 00h30 Paris le 1er compte dans le nouveau mois, pas le précédent', () => {
    //- 30 sept 22h30 UTC = 1er oct 00h30 à Paris
    const vente = new Date('2026-09-30T22:30:00.000Z');
    const sept = moisRange('2026-09');
    const oct = moisRange('2026-10');
    expect(vente >= sept.fin).toBe(true);
    expect(vente >= oct.debut && vente < oct.fin).toBe(true);
  });

  it('refuse un format invalide', () => {
    expect(() => moisRange('2026-13')).toThrow();
    expect(() => moisRange('septembre')).toThrow();
  });
});

describe('currentMois', () => {
  it('lit le mois à Paris, pas en UTC', () => {
    //- 30 sept 22h30 UTC = déjà octobre à Paris
    expect(currentMois(new Date('2026-09-30T22:30:00.000Z'))).toBe('2026-10');
    expect(currentMois(new Date('2026-09-15T12:00:00.000Z'))).toBe('2026-09');
  });
});

describe('moisLabel', () => {
  it('écrit le mois en français', () => {
    expect(moisLabel('2026-09')).toBe('septembre 2026');
    expect(moisLabel('2026-02')).toBe('février 2026');
    expect(moisLabel('2026-08')).toBe('août 2026');
  });
});
