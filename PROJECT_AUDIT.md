# Audit complet après corrections

Date de revue : 13 août 2026

## Résultat exécutif

Le dépôt initial était une ébauche non compilable : schéma Prisma invalide, dépendance client absente, configuration ESM incohérente, aucun lockfile ni migration, fonctionnalités métier largement manquantes, authentification/rate limiting incomplets, produits factices côté storefront et aucun test réel.

La solution est désormais un monorepo e-commerce cohérent et compilable. Le parcours produit → panier → checkout → commande est calculé par l’API et protégé contre la concurrence de stock. Les demandes produit/contact deviennent des leads persistés et administrables. L’administration expose les données réelles, respecte les rôles et journalise les actions sensibles.

## Matrice des corrections

| Domaine | État après correction |
|---|---|
| Monorepo | pnpm workspace, lockfile, Node 22, scripts racine portables via Corepack |
| TypeScript | mode strict, exactOptionalPropertyTypes, aucun any/ts-ignore de contournement |
| Prisma | schéma valide, client généré, migration PostgreSQL versionnée |
| Base | relations, snapshots, index, uniques et CHECK métier |
| Configuration | validation Zod, variables centralisées, échec immédiat si secret/config invalide |
| Auth | bootstrap unique transactionnel, scrypt, sessions HMAC en DB, cookie HttpOnly, logout |
| RBAC | cinq rôles, guards API, navigation filtrée, gestion SUPER_ADMIN des comptes |
| Sécurité HTTP | Helmet, CORS explicite, Origin guard, throttling global et ciblé, erreurs sûres |
| Catalogue | produits, variantes, catégories, collections, médias, SEO, filtres et pagination |
| Médias | local/S3, drag & drop, progression, ordre, alt, UUID, MIME/extension/signature/taille |
| Panier | jeton opaque haché, expiration, stock cumulé, personnalisation validée par schéma |
| Prix | Decimal, prix effectif centralisé, promotion, livraison, taxe et total côté serveur |
| Checkout | idempotence, transaction Serializable, décrément conditionnel, snapshots |
| Commandes | activités, transitions, synchronisation Payment, annulation et restitution de stock |
| Leads | consentement versionné, timeline, assignation, notes, statuts, téléphone/email/WhatsApp |
| Notifications | SMTP optionnel, vendeur + confirmation client, échappement HTML, tolérance aux pannes |
| Clients/stock | vues administratives paginées/agrégées, ajustements de stock audités |
| Analytics | événements internes limités et dashboard alimenté uniquement par les vraies données |
| Storefront | pages réelles, empty/error/loading states, responsive, mobile menu et sticky CTA |
| Administration | dashboard dense, commandes, catalogue, leads, clients, stock, promos, médias, réglages |
| SEO | metadata, canonical, Open Graph, Product JSON-LD, robots et sitemap |
| Accessibilité | labels, focus visible, skip link, navigation clavier, reduced motion |
| Infrastructure | Dockerfile multi-stage, Compose, healthchecks, volumes persistants |
| Documentation | README d’exploitation, architecture, sécurité et audit du mode gratuit |

## Règles métier vérifiées

- Le frontend ne transmet aucun prix ou total au checkout.
- Une variante doit appartenir au produit sélectionné.
- Les quantités cumulées d’un panier ne peuvent dépasser le stock visible.
- Le checkout recharge tout depuis PostgreSQL.
- Le stock est décrémenté uniquement si stock >= quantité dans la transaction.
- Une clé d’idempotence déjà utilisée retourne la même confirmation.
- Une transition de statut non autorisée est rejetée.
- L’annulation admissible restitue le stock et décrémente l’usage promotionnel.
- Les prix promotionnels doivent être positifs et inférieurs au prix de référence.
- Un paiement en ligne ne peut pas être activé sans fournisseur serveur réel.
- Un lead sans consentement est rejeté.
- Une personnalisation inconnue, trop longue ou requise mais vide est rejetée.

## Revue de sécurité

Les entrées passent par ValidationPipe avec whitelist et forbidNonWhitelisted. Prisma évite la concaténation SQL. Les réponses 500 sont génériques et portent un requestId. Les erreurs Prisma connues deviennent 404/409 sans fuite interne. Les secrets ne sont pas envoyés au frontend.

Les sessions contiennent 256 bits aléatoires. Seul leur HMAC SHA-256 est conservé. Les mots de passe utilisent scrypt avec sel aléatoire. Le dernier SUPER_ADMIN actif ne peut pas être supprimé ou rétrogradé, et un administrateur ne peut pas se désactiver lui-même.

L’audit des dépendances de production ne signale aucune vulnérabilité connue après mise à jour de Nodemailer.

## Validation automatisée

- Prisma validate : réussi ;
- génération Prisma : réussie ;
- typecheck API/storefront/shared : réussi ;
- ESLint API/storefront/shared : réussi sans désactivation de règle ;
- tests unitaires : 17 tests réussis (13 API, 3 shared, 1 storefront) couvrant auth, RBAC, produits, leads, panier, prix, promotion, stock et commandes ;
- couverture API mesurée : 19,21 % des instructions, avec 100 % sur le moteur de prix et 87,75 % sur les primitives de sécurité ; cette base protège les règles critiques mais doit encore être renforcée par des tests d'intégration PostgreSQL avant une mise en production à fort trafic ;
- build production NestJS : réussi ;
- build production Next.js : réussi, 29 pages générées ;
- audit des dépendances de production : aucune vulnérabilité connue.

## Limites externes explicites

Le projet n’invente pas de fournisseur bancaire. Le paiement en ligne reste volontairement indisponible jusqu’au choix d’un prestataire, à la fourniture de ses identifiants et à l’implémentation de sa signature de webhook. Le paiement à la livraison est complet.

L’environnement de revue ne disposait pas de Docker et le service PostgreSQL local ne possédait pas le rôle atelier ; un test end-to-end contre une base réelle n’a donc pas été exécuté ici. La migration a été générée et validée statiquement, et Compose est fourni pour ce test dans un environnement Docker.

Avant mise en ligne, le propriétaire doit encore fournir : contenu légal, vraies coordonnées, médias, catalogue, domaine/HTTPS, politique de conservation et stratégie de sauvegarde. Ces éléments ne peuvent pas être inventés dans le code.
