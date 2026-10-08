import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryVente } from './dto/query-vente.dto';

//- Le serveur plafonne une page de ventes à 100. Un client qui demande plus reçoit une erreur
//- 400 (et non « moins de résultats ») : l'écran « Mes ventes » de la boutique rejointe
//- demandait 200 et restait vide, quel que soit le nombre de ventes de la créatrice.
describe('QueryVente — plafond de pagination', () => {
  const erreurs = async (q: Record<string, unknown>) =>
    (await validate(plainToInstance(QueryVente, q))).map((e) => e.property);

  it('take=200 est refusé', async () => {
    expect(await erreurs({ boutiqueId: 'b1', take: '200' })).toContain('take');
  });

  it('take=100 et take=20 sont acceptés', async () => {
    expect(await erreurs({ boutiqueId: 'b1', take: '100' })).not.toContain('take');
    expect(await erreurs({ boutiqueId: 'b1', take: '20', skip: '100' })).toEqual([]);
  });
});
