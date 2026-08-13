# Architecture

## Vue d’ensemble

Le dépôt est un monorepo pnpm à trois packages. Next.js sert la boutique et l’administration. NestJS porte les règles métier. PostgreSQL est la source de vérité et Prisma fournit le client typé et les migrations.

~~~text
Navigateur
  |
  +-- pages publiques / admin --------> Next.js
  |                                      |
  +-- /backend/api/* --------------------+----> NestJS /api/*
                                                   |
                         +-------------------------+------------------+
                         |                         |                  |
                      PostgreSQL              disque local       SMTP optionnel
                                             ou S3 compatible
~~~

## Frontières de confiance

- Les identifiants produit/variante et les informations client viennent du navigateur.
- Les prix, stocks, promotions, devise, livraison, taxe, permissions et statuts sont rechargés côté API.
- Les sessions admin utilisent un cookie HttpOnly ; le jeton opaque n’est stocké qu’après hachage.
- Le jeton panier est opaque et envoyé dans un header, jamais dans une URL.
- Les uploads sont authentifiés et validés avant stockage.

## Modules backend

- auth : bootstrap unique, login/logout, sessions, RBAC et liste des responsables ;
- settings : singleton StoreSettings et valeurs publiques minimales ;
- products/categories/collections : catalogue public et administration ;
- media : abstraction LocalStorage/S3 et sécurité des fichiers ;
- carts/pricing/promotions : panier et calcul financier centralisé ;
- leads/notifications : demandes, consentement, timeline et SMTP ;
- orders/payments : checkout idempotent et cycle de commande ;
- customers/inventory : vues administratives et ajustement audité du stock ;
- analytics : événements internes non invasifs et agrégats réels ;
- common : Prisma, audit, validation, pagination et filtre d’erreurs.

## Cohérence transactionnelle

Le checkout utilise l’isolation Serializable. Chaque décrément de stock est une mise à jour conditionnelle. Les produits, variantes, promotion, client, adresse, commande, lignes, paiement, activités, analytics et nettoyage du panier appartiennent à la même transaction. Un conflit annule l’ensemble.

Les montants utilisent Decimal avec une échelle métier de trois décimales. Le frontend n’envoie jamais de total.

## Modèle de données

Le schéma comprend AdminUser/AdminSession/AdminAudit, Customer/Address, Category/Collection, Product/ProductVariant/ProductImage/MediaAsset, Cart/CartItem, Order/OrderItem/OrderActivity/Payment, Lead/LeadActivity, Promotion, AnalyticsEvent et StoreSettings.

Les snapshots de commande préservent les informations historiques même si un produit ou un client change ensuite.

## Extensibilité

StorageProvider permet de remplacer le disque local par un stockage S3 compatible. PaymentProvider permet d’ajouter un fournisseur réel sans déplacer la logique de commande. NotificationService concentre l’email. Les rôles spécialisés sont déjà supportés par les guards et la navigation.
