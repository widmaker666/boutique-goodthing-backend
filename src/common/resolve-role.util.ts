//- Le toggle gérante/créatrice affiché dans l'app (`duoMode`) est un état
//- 100% côté client (Zustand), jamais persisté ni déductible du rôle stocké
//- en base — un compte GERANTE_CREATRICE a TOUJOURS ce même rôle, qu'il
//- affiche la vue gérante ou créatrice à l'instant T. Les endpoints qui ont
//- besoin de savoir "dans quel mode l'app est actuellement" (stats globales,
//- ventes récentes du Dashboard...) doivent recevoir ce mode explicitement
//- du client via ce paramètre — jamais le déduire du rôle seul.
//-
//- N'a d'effet que pour un compte GERANTE_CREATRICE : pour un rôle simple
//- (GERANTE ou CREATRICE), le mode est ignoré, il n'y a rien d'ambigu.
//- Générique (plutôt que `string`) pour pouvoir réassigner le résultat
//- directement à un champ typé `Role` (enum Prisma) sans cast à l'appel —
//- utile pour construire un AuthUser "effectif" (ex: vente.service.ts findAll).
export function resolveRole<T extends string>(role: T, mode?: string): T {
  if (role !== 'GERANTE_CREATRICE') return role;
  if (mode === 'GERANTE' || mode === 'CREATRICE') return mode as T;
  return role;
}
