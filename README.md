# ShopPro

Plateforme SaaS multi-tenant (commerce, gestion, livraison) — base
fonctionnelle avec authentification, isolation multi-tenant et premières
routes métier connectées à une vraie base de données PostgreSQL.

## Ce qui fonctionne déjà

- Inscription / connexion (JWT, mots de passe hashés)
- Création d'entreprise (statut `en_attente` par défaut, comme prévu dans
  le cahier des charges — pas d'accès immédiat aux fonctionnalités pro)
- Liste des entreprises d'un utilisateur avec son rôle dans chacune
- Catalogue produits (lecture + création, filtré par entreprise)
- Création de commande avec décrément de stock transactionnel
- Pages web : accueil, connexion, inscription, tableau de bord minimal

## Ce qu'il reste à construire

Les 6 écrans visuels livrés précédemment (accueil client, dashboards
Fondateur/Entreprise, fiche produit, appli livreur, offre personnalisée)
sont des prototypes HTML statiques — **ils ne sont pas encore branchés à
ce projet**. La suite consiste à les recréer comme pages React ici, en
réutilisant les routes API déjà en place et en ajoutant les routes
manquantes (stock, livraisons, livreurs, promotions, abonnements...) en
suivant exactement le même schéma que `app/api/products` et
`app/api/orders`.

---

## 1. Créer la base de données sur Supabase

1. Allez sur [supabase.com](https://supabase.com) → **New project**
2. Une fois le projet créé, ouvrez **SQL Editor** → **New query**
3. Copiez tout le contenu de `schema.sql` (à la racine de ce projet),
   collez-le et cliquez **Run**
4. Allez dans **Project Settings → Database → Connection string → URI**
5. Choisissez le mode **Transaction** (port `6543`) pour l'utiliser avec
   des fonctions serverless (Vercel) — copiez l'URL, vous en aurez besoin
   à l'étape 3

## 2. Mettre le projet sur GitHub

```bash
git init
git add .
git commit -m "Premier commit — base ShopPro"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/shoppro.git
git push -u origin main
```

(Créez d'abord un dépôt vide sur GitHub s'il n'existe pas encore.)

## 3. Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), cliquez **Add New → Project**
2. Importez votre dépôt GitHub `shoppro`
3. Dans **Environment Variables**, ajoutez :
   - `DATABASE_URL` → l'URL Supabase copiée à l'étape 1 (mode Transaction)
   - `JWT_SECRET` → une chaîne aléatoire longue (ex: générée avec
     `openssl rand -base64 48`)
   - `JWT_EXPIRES_IN` → `7d`
4. Cliquez **Deploy**

Vercel détecte automatiquement Next.js — aucune configuration
supplémentaire n'est nécessaire.

## 4. Vérifier que tout fonctionne

Une fois déployé, ouvrez l'URL Vercel fournie :
1. Créez un compte sur `/register`
2. Vous êtes redirigé vers `/dashboard` (vide au départ, normal)
3. Testez la création d'entreprise et de produit via les routes API
   (`/api/companies`, `/api/products`) avec un client comme Postman,
   en passant le token reçu à la connexion dans l'en-tête
   `Authorization: Bearer <token>`

## Développement local

```bash
npm install
cp .env.example .env.local   # renseignez DATABASE_URL et JWT_SECRET
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Structure du projet

```
app/
  page.tsx                 → accueil
  login/page.tsx           → connexion
  register/page.tsx        → inscription
  dashboard/page.tsx       → liste des entreprises de l'utilisateur
  api/
    auth/login/route.ts
    auth/register/route.ts
    companies/route.ts     → liste + création d'entreprise
    products/route.ts      → catalogue (lecture + création)
    orders/route.ts        → création de commande (stock transactionnel)
lib/
  db.ts                    → pool PostgreSQL + withTenant()
  auth.ts                  → hash mot de passe + JWT
  tenant.ts                → résolution rôle/permissions par entreprise
middleware.ts              → protège toutes les routes /api/*
schema.sql                 → schéma complet de la base (~60 tables)
```

## Principe de sécurité à respecter pour toute nouvelle route

1. Vérifier le token (`getSessionFromRequest`)
2. Résoudre l'appartenance à l'entreprise (`resolveMembership`) — ne
   jamais faire confiance à un `companyId` envoyé par le client sans
   vérifier que l'utilisateur y appartient réellement
3. Vérifier la permission requise (`hasPermission`)
4. Toujours filtrer les requêtes SQL par `company_id`

Le compte Fondateur (`is_founder`) ne doit jamais être modifiable par une
route accessible publiquement — uniquement en base, manuellement.
