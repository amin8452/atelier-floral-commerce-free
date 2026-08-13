# Atelier Floral Commerce

Boutique e-commerce auto-hébergeable pour créations florales artisanales. Le monorepo fournit un storefront Next.js, une API NestJS, PostgreSQL/Prisma, une administration RBAC, un panier, un checkout transactionnel, des leads, des commandes, une médiathèque locale ou S3 et des analytics internes.

Aucune donnée commerciale fictive n’est injectée. Une installation neuve affiche des états vides jusqu’à la saisie des paramètres, médias et produits.

## Prérequis

- Node.js 22.12 ou ultérieur ;
- Corepack et pnpm 10 ;
- PostgreSQL 17 ou Docker Compose ;
- Windows, Linux ou macOS.

## Installation locale

~~~bash
corepack enable
corepack pnpm install
cp .env.example .env
~~~

Créez la base et son rôle PostgreSQL, puis adaptez DATABASE_URL dans .env :

~~~sql
CREATE USER atelier WITH PASSWORD 'change-me';
CREATE DATABASE atelier OWNER atelier;
~~~

Appliquez ensuite les migrations versionnées et démarrez les deux applications :

~~~bash
corepack pnpm db:deploy
corepack pnpm dev
~~~

- boutique : http://localhost:3000
- API : http://localhost:4000/api
- santé : http://localhost:4000/api/health
- administration : http://localhost:3000/admin

## Premier administrateur

Renseignez temporairement ADMIN_BOOTSTRAP_TOKEN avec une valeur aléatoire longue. Tant qu’aucun administrateur n’existe :

~~~bash
curl -X POST http://localhost:4000/api/auth/bootstrap +  -H "Origin: http://localhost:3000" +  -H "Content-Type: application/json" +  -H "x-bootstrap-token: VOTRE_JETON" +  -d '{"email":"admin@example.com","password":"une-phrase-secrete-de-12-caracteres","firstName":"Admin"}'
~~~

Le compte créé est SUPER_ADMIN. Retirez ensuite ADMIN_BOOTSTRAP_TOKEN de l’environnement et redémarrez l’API. L’endpoint refuse toute seconde initialisation.

## Architecture

~~~text
apps/storefront   Next.js App Router, boutique et administration
apps/api          API REST NestJS et domaines métier
packages/shared   statuts, formatage monétaire et liens WhatsApp
data/uploads      médias locaux, hors code exécutable
~~~

Le navigateur appelle /backend/api sur le même domaine. Next.js relaie vers l’API, ce qui conserve les cookies HttpOnly et évite d’exposer une URL interne. L’API reste la seule source de vérité pour prix, promotions, stock, permissions, totaux et statuts.

Consultez [ARCHITECTURE.md](./ARCHITECTURE.md) pour les modules et les flux.

## Frontend

Le storefront comprend :

- accueil, nouveautés, collections et storytelling ;
- boutique filtrée, triée et paginée ;
- page produit, galerie, variantes, personnalisation et Schema.org Product ;
- panier persistant par jeton opaque ;
- checkout et confirmation non fondée sur les paramètres d’URL ;
- formulaires produit et contact sauvegardés comme leads ;
- WhatsApp alimenté uniquement par StoreSettings ;
- SEO dynamique, canonical, Open Graph, robots et sitemap ;
- états loading, vide, succès et erreur ;
- interface responsive, navigation clavier et préférence reduced-motion.

L’administration propose commandes, produits, collections, catégories, clients, leads, stocks, promotions, médias et paramètres. Les liens sont filtrés selon le rôle, mais chaque permission est également revérifiée par l’API.

## Backend

Les domaines NestJS sont séparés : auth, settings, products, categories, collections, media, carts, pricing, promotions, leads, notifications, orders, payments, customers, inventory et analytics.

Mesures principales :

- DTO stricts, propriétés inconnues rejetées ;
- sessions opaques hachées en base et cookies HttpOnly/SameSite ;
- scrypt salé pour les mots de passe ;
- RBAC SUPER_ADMIN, ADMIN, ORDER_MANAGER, PRODUCT_MANAGER et SUPPORT ;
- contrôle Origin sur les mutations ;
- CORS en liste blanche, Helmet et rate limiting ;
- noms d’upload UUID, allowlist MIME/extension, signature binaire et taille maximale ;
- filtres d’erreurs sans stack trace ou détails internes ;
- journal d’audit pour les opérations sensibles.

## PostgreSQL et Prisma

La migration initiale se trouve dans apps/api/prisma/migrations. Elle crée les relations, index, contraintes uniques et contraintes CHECK sur stocks, quantités, prix, promotions et montants.

Commandes :

~~~bash
corepack pnpm db:generate
corepack pnpm db:migrate   # développement, crée une migration
corepack pnpm db:deploy    # CI et production, applique les migrations existantes
~~~

La production ne dépend jamais de prisma db push.

## Variables d’environnement

Copiez .env.example. Les variables indispensables sont DATABASE_URL, APP_URL, API_URL, SESSION_SECRET, CORS_ORIGINS, STORE_NAME, STORE_DEFAULT_CURRENCY, STORE_DEFAULT_LOCALE et CONSENT_POLICY_VERSION.

En production :

- utilisez au moins 32 caractères aléatoires pour SESSION_SECRET ;
- utilisez HTTPS afin d’activer le cookie Secure ;
- limitez CORS_ORIGINS aux domaines réels ;
- activez TRUST_PROXY uniquement derrière un proxy de confiance ;
- ne commitez jamais .env.

## Images

Le mode par défaut stocke les fichiers dans data/uploads :

~~~env
STORAGE_DRIVER=local
UPLOAD_DIR=data/uploads
UPLOAD_PUBLIC_PATH=/uploads
MAX_UPLOAD_BYTES=5242880
~~~

Pour S3, R2 ou MinIO, passez STORAGE_DRIVER à s3 et renseignez les variables S3_* de .env.example. Sauvegardez à la fois PostgreSQL et les fichiers du stockage local.

## Email

EMAIL_MODE=disabled ne bloque jamais la création d’un lead. Avec EMAIL_MODE=smtp, toutes les variables SMTP sont obligatoires. Le service envoie une notification au vendeur et, si une adresse client a été fournie, une confirmation au client. Un échec SMTP est journalisé sans supprimer le lead.

## WhatsApp

Le projet utilise des liens wa.me préremplis, sans API payante. Le numéro public vient de StoreSettings. Depuis un lead, l’administration ouvre une conversation vers le numéro du client et ajoute l’événement à la timeline.

## Paiements

Le mode livré est le paiement à la livraison, sans commission logicielle :

~~~env
PAYMENT_MODE=cash_on_delivery
~~~

PaymentProvider isole le domaine de commande du prestataire. L’option de paiement en ligne reste désactivée tant qu’un fournisseur réel, sa vérification serveur et son webhook signé/idempotent ne sont pas intégrés. Aucun succès de paiement n’est simulé.

## Calcul et concurrence

Le serveur recharge les produits et variantes, calcule le prix effectif, applique la promotion, la livraison et la taxe, puis crée la commande dans une transaction Serializable. Le stock est décrémenté par une mise à jour conditionnelle stock >= quantité. Si deux checkouts visent le dernier article, un seul peut aboutir. Une annulation admissible restitue le stock et l’utilisation du code promotionnel.

La clé Idempotency-Key empêche la création en double d’une commande.

## Tests et contrôles

~~~bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:coverage
corepack pnpm build
~~~

Les tests couvrent notamment mots de passe et sessions, permissions, création produit, validation/persistance lead, panier cumulé, calculs financiers, promotions, concurrence de stock et transitions de commande.

## Docker Compose

Après avoir défini SESSION_SECRET dans .env :

~~~bash
docker compose up --build
~~~

Compose démarre PostgreSQL, applique les migrations, vérifie la santé de l’API puis démarre le storefront. Les volumes postgres_data et uploads sont persistants. Docker n’est pas requis pour l’installation native.

## Déploiement

1. construisez une image immuable ;
2. configurez les secrets dans le gestionnaire de l’hébergeur ;
3. exécutez db:deploy une seule fois avant la nouvelle API ;
4. montez un volume persistant pour data/uploads ou configurez S3 ;
5. placez API et storefront derrière HTTPS ;
6. surveillez /api/health et centralisez les logs ;
7. testez régulièrement la restauration des sauvegardes.

## Dépannage

- DATABASE_URL absent : Prisma peut générer le client, mais l’API et les migrations exigent une URL PostgreSQL valide.
- Origine non autorisée : vérifiez APP_URL et CORS_ORIGINS, protocole inclus.
- Images absentes : vérifiez UPLOAD_DIR, les droits du volume et API_URL.
- Cookie admin absent en production : utilisez HTTPS et vérifiez le proxy.
- Notification non envoyée : le lead reste en base ; contrôlez EMAIL_MODE et les paramètres SMTP.
- Produit non visible : son statut doit être ACTIVE et sa date de publication atteinte.

## Coût et limites

Le mode local n’impose aucun service cloud payant. Le domaine, l’hébergement, l’électricité, le transport, un SMTP externe ou un prestataire bancaire restent des coûts externes possibles. Voir [FREE_MODE_AUDIT.md](./FREE_MODE_AUDIT.md).
