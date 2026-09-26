//- Bornes de mois pour les exports comptables.
//- Le serveur tourne en UTC : "le mois de septembre" doit se lire à l'heure de
//- Paris, sinon une vente faite à 00h30 le 1er atterrit dans le mois précédent.
const TZ = 'Europe/Paris';

//- Format attendu d'un mois : "AAAA-MM" (ex. "2026-09")
export const MOIS_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

//- Écart Paris − UTC (en ms) à l'instant donné (+1h l'hiver, +2h l'été)
function parisOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  const parisAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return parisAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

//- Minuit (heure de Paris) du 1er du mois, exprimé en instant UTC
function parisMonthStart(year: number, month: number): Date {
  const guess = Date.UTC(year, month - 1, 1);
  return new Date(guess - parisOffsetMs(new Date(guess)));
}

//- Mois courant à Paris, "AAAA-MM"
export function currentMois(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}

//- [debut, fin[ : `fin` est le 1er du mois suivant, à exclure (lt, pas lte)
export function moisRange(mois: string): { debut: Date; fin: Date } {
  const match = MOIS_REGEX.exec(mois);
  if (!match) throw new Error(`Mois invalide : ${mois}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    debut: parisMonthStart(year, month),
    fin: month === 12 ? parisMonthStart(year + 1, 1) : parisMonthStart(year, month + 1),
  };
}

//- "2026-09" → "septembre 2026"
export function moisLabel(mois: string): string {
  const match = MOIS_REGEX.exec(mois);
  if (!match) return mois;
  return `${MOIS_FR[Number(match[2]) - 1]} ${match[1]}`;
}
