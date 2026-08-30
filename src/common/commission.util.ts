//- Calcul de commission centralisé — avant ça, la même formule
//- (prixVente * tauxDeCommission / 100) était copiée dans ~15 endroits
//- (ventes, stats, exports, emails), avec le risque d'en oublier un lors
//- d'un changement de règle. Un seul point de calcul, notamment pour gérer
//- le cas `sansCommission` (case à cocher par vente, force 0%).
export function calculerCommission(
  prixVente: number,
  tauxDeCommission: number,
  sansCommission: boolean,
): { montantCommission: number; netCreatrice: number } {
  const montantCommission = sansCommission
    ? 0
    : Math.round(((prixVente * tauxDeCommission) / 100) * 100) / 100;
  const netCreatrice = Math.round((prixVente - montantCommission) * 100) / 100;
  return { montantCommission, netCreatrice };
}
