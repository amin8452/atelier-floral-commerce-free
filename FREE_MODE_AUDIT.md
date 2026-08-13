# Audit du mode sans service payant obligatoire

| Capacité | Choix par défaut | Service payant obligatoire |
|---|---|---:|
| Frontend | Next.js auto-hébergé | non |
| API | NestJS auto-hébergé | non |
| Base | PostgreSQL local | non |
| ORM/migrations | Prisma | non |
| Images | volume disque local | non |
| Paiement | paiement à la livraison | non |
| WhatsApp | lien wa.me | non |
| Email | désactivé ou SMTP existant | non |
| Analytics | tables PostgreSQL internes | non |
| Conteneurs | Docker Compose facultatif | non |

Le fonctionnement gratuit suppose une machine et une connexion déjà disponibles. Domaine, énergie, sauvegarde externe, hébergement, transport et commissions bancaires ne peuvent pas être garantis gratuits par le logiciel.

Le stockage S3, le SMTP et le paiement en ligne sont des extensions optionnelles. Aucun écran ne prétend qu’ils fonctionnent sans configuration réelle. Si l’email est désactivé, les leads restent complets et visibles dans l’administration.

Pour une exploitation sérieuse en stockage local, sauvegardez séparément PostgreSQL et le volume data/uploads, puis vérifiez périodiquement une restauration.
