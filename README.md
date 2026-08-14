# Atelier Floral

Atelier Floral est une boutique e-commerce complète pour vendre des créations artisanales en résine : bijoux, fleurs conservées et pièces personnalisées.

Le projet contient deux espaces bien séparés :

- une boutique publique pour découvrir les produits, rechercher un modèle, gérer un panier et commander ;
- une administration pour gérer le catalogue, les commandes, le stock, les clients, les promotions et les paramètres de la boutique.

Le dépôt ne contient ni faux catalogue ni identifiants administrateur. Après une première installation, la boutique est vide jusqu'à l'ajout des produits et de leurs photos.

## Fonctionnalités principales

### Boutique

- accueil éditorial et responsive ;
- catalogue avec recherche, filtres, tri et pagination ;
- fiches produit avec galerie, variantes et personnalisation ;
- panier persistant et calcul des prix côté serveur ;
- commande avec paiement à la livraison ;
- formulaire de contact et demandes liées à un produit ;
- liens WhatsApp configurables ;
- SEO, sitemap et données structurées.

### Administration

- tableau de bord avec indicateurs et graphiques ;
- gestion des produits, photos, catégories et collections ;
- mise à jour rapide de l'état d'un produit ;
- gestion du stock et alertes de stock faible ;
- suivi et finalisation des commandes ;
- gestion des clients, demandes, promotions et utilisateurs ;
- corbeille produit avec délai de suppression de 24 heures ;
- rôles, sessions sécurisées et journal d'audit.

## Technologies

| Partie | Technologies |
| --- | --- |
| Interface | Next.js 16, React 19, TypeScript |
| API | NestJS 11, TypeScript |
| Base de données | PostgreSQL 17, Prisma 7 |
| Tests | Vitest |
| Déploiement local | Docker Compose ou Node.js/pnpm |

## Organisation du projet

```text
apps/
  storefront/       Boutique publique et administration Next.js
  api/              API REST NestJS et logique métier
packages/
  shared/           Types et fonctions partagés
data/
  uploads/          Photos enregistrées localement, non versionnées
```

Le navigateur communique avec `/backend/api`. Next.js relaie ces appels vers l'API NestJS. L'API reste responsable des prix, du stock, des promotions, des commandes et des autorisations. Cette séparation évite de faire confiance aux valeurs envoyées par le navigateur.

## Démarrage rapide avec Docker

### 1. Prérequis

- Git ;
- Docker Desktop avec Docker Compose.

### 2. Préparer la configuration

Clonez le dépôt et placez-vous dans son dossier :

```bash
git clone https://github.com/amin8452/atelier-floral-commerce-free.git
cd atelier-floral-commerce-free
```

Créez le fichier local de configuration :

```bash
cp .env.example .env
```

Sous PowerShell, utilisez plutôt :

```powershell
Copy-Item .env.example .env
```

Dans `.env`, remplacez au minimum les valeurs suivantes :

```env
POSTGRES_PASSWORD=un-mot-de-passe-solide
SESSION_SECRET=une-valeur-aleatoire-de-32-caracteres-minimum
ADMIN_BOOTSTRAP_TOKEN=un-jeton-temporaire-long-et-aleatoire
```

Ne publiez jamais le fichier `.env`.

### 3. Lancer le projet

```bash
docker compose up --build
```

Quand les services sont prêts :

- boutique : <http://localhost:3000>
- administration : <http://localhost:3000/admin>
- API : <http://localhost:4000/api>
- contrôle de santé : <http://localhost:4000/api/health>

### 4. Créer le premier administrateur

La création est autorisée uniquement si aucun administrateur n'existe encore. Remplacez le jeton et les informations du compte dans cette commande :

```bash
curl -X POST http://localhost:4000/api/auth/bootstrap \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: VOTRE_JETON" \
  --data '{"email":"admin@example.com","password":"une-phrase-secrete-de-12-caracteres","firstName":"Admin"}'
```

Le compte reçoit le rôle `SUPER_ADMIN`. Après sa création, videz `ADMIN_BOOTSTRAP_TOKEN` dans `.env`, puis redémarrez l'API.

### 5. Préparer la boutique

Connectez-vous à `/admin`, puis procédez dans cet ordre :

1. vérifiez les paramètres de la boutique ;
2. ajoutez les catégories et collections ;
3. ajoutez les photos ;
4. créez les produits et leur stock ;
5. passez les produits à l'état actif pour les publier.

## Installation sans Docker

Prérequis supplémentaires : Node.js 22.12 ou plus récent, Corepack et PostgreSQL 17.

```bash
corepack enable
corepack pnpm install
cp .env.example .env
```

Créez une base PostgreSQL, adaptez `DATABASE_URL` dans `.env`, puis exécutez :

```bash
corepack pnpm db:deploy
corepack pnpm dev
```

Les deux applications démarrent ensemble sur les ports `3000` et `4000`.

## Commandes utiles

```bash
corepack pnpm dev            # lancer le frontend et l'API
corepack pnpm build          # construire les applications
corepack pnpm lint           # contrôler la qualité du code
corepack pnpm typecheck      # contrôler les types TypeScript
corepack pnpm test           # lancer tous les tests
corepack pnpm test:coverage  # générer la couverture des tests
corepack pnpm db:generate    # régénérer le client Prisma
corepack pnpm db:migrate     # créer une migration en développement
corepack pnpm db:deploy      # appliquer les migrations existantes
```

## Configuration importante

Toutes les variables disponibles sont documentées dans `.env.example`.

- `APP_URL` et `API_URL` définissent les adresses publiques ;
- `SESSION_SECRET` protège les sessions administrateur ;
- `CORS_ORIGINS` limite les sites autorisés à appeler l'API ;
- `STORAGE_DRIVER=local` conserve les photos dans `data/uploads` ;
- `STORAGE_DRIVER=s3` permet d'utiliser S3, Cloudflare R2 ou MinIO ;
- `EMAIL_MODE=disabled` désactive les e-mails sans bloquer les commandes ;
- `PAYMENT_MODE=cash_on_delivery` active le paiement à la livraison ;
- `WHATSAPP_NUMBER` définit le numéro utilisé par les boutons de contact.

Les photos placées dans `data/uploads` et les données PostgreSQL ne sont pas enregistrées dans Git. Elles doivent être sauvegardées séparément en production.

## Sécurité et règles métier

- mots de passe hachés avec `scrypt` et sessions opaques en cookie HttpOnly ;
- permissions vérifiées par l'API selon le rôle administrateur ;
- validation stricte des formulaires et limitation du nombre de requêtes ;
- contrôle du type, de la signature et de la taille des images ;
- prix, promotions et stock recalculés côté serveur ;
- création de commande transactionnelle et protégée contre les doublons ;
- aucune simulation de paiement en ligne.

## Méthode de travail Git

La branche `main` représente la version stable. Les modifications quotidiennes se font sur `dev` :

```bash
git switch dev
git pull

# après les modifications et les tests
git add .
git commit -m "type: description claire"
git push origin dev
```

Une fois `dev` validée, ouvrez une pull request vers `main`. Évitez de développer directement sur `main`.

## Problèmes fréquents

- **L'API ne démarre pas :** vérifiez `DATABASE_URL`, PostgreSQL et la longueur de `SESSION_SECRET`.
- **Un produit n'apparaît pas :** il doit être actif, publié, posséder une photo et avoir du stock.
- **Les images sont absentes :** vérifiez `UPLOAD_DIR`, les permissions du dossier et `API_URL`.
- **La connexion admin échoue en production :** utilisez HTTPS et vérifiez la configuration du proxy.
- **Un e-mail n'est pas envoyé :** la commande reste enregistrée ; contrôlez `EMAIL_MODE` et les paramètres SMTP.

## Avant une mise en production

- utiliser HTTPS ;
- générer des secrets uniques et longs ;
- appliquer les migrations avec `pnpm db:deploy` ;
- sauvegarder PostgreSQL et les images ;
- configurer un stockage persistant ;
- surveiller `/api/health` et les journaux de l'API.
