# Politique de sécurité opérationnelle

## Signaler un problème

Ne publiez pas de secret, donnée client ou preuve d’exploitation dans une issue publique. Transmettez le rapport au propriétaire du déploiement par un canal privé avec la version, l’impact et des étapes de reproduction minimales.

## Checklist de production

- secrets aléatoires hors dépôt ;
- HTTPS obligatoire ;
- CORS limité aux domaines utilisés ;
- ADMIN_BOOTSTRAP_TOKEN retiré après initialisation ;
- rôles attribués selon le moindre privilège ;
- PostgreSQL non exposé publiquement ;
- volume d’uploads non exécutable et persistant ;
- sauvegardes chiffrées et restaurations testées ;
- dépendances, images de base et OS mis à jour ;
- logs protégés contre l’accès non autorisé.

Les données client et les consentements doivent être conservés et supprimés selon la réglementation applicable au pays du vendeur. La durée de conservation reste une décision du responsable de traitement.
