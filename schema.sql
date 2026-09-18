-- ============================================================================
-- SHOPPRO — SCHÉMA DE BASE DE DONNÉES (PostgreSQL 15+)
-- Plateforme SaaS multi-tenant : commerce, gestion, livraison
-- ============================================================================
-- Principe multi-tenant : toute table liée à une entreprise porte company_id.
-- L'isolation stricte est appliquée au niveau applicatif (chaque requête est
-- scoping par company_id) ET recommandée au niveau base via Row Level
-- Security (exemples fournis en fin de fichier).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- pour gen_random_uuid()

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE company_status AS ENUM (
  'en_attente', 'en_negociation', 'offre_proposee', 'paiement_en_attente',
  'en_essai', 'active', 'suspendue', 'resiliee'
);

CREATE TYPE order_status AS ENUM (
  'en_attente', 'acceptee', 'refusee', 'en_preparation', 'livreur_affecte',
  'en_route', 'livree', 'livree_partiellement', 'annulee', 'remboursee'
);

CREATE TYPE delivery_status AS ENUM (
  'commande_acceptee', 'preparation', 'livreur_affecte', 'en_route',
  'livraison_en_cours', 'livree', 'annulee'
);

CREATE TYPE payment_status AS ENUM ('en_attente', 'paye', 'echoue', 'rembourse');
CREATE TYPE payment_method AS ENUM ('especes_a_la_livraison', 'orange_money', 'virement', 'autre');

CREATE TYPE driver_app_status AS ENUM ('en_attente', 'acceptee', 'refusee');
CREATE TYPE driver_status AS ENUM ('actif', 'inactif', 'suspendu');

CREATE TYPE customer_type AS ENUM ('particulier', 'professionnel');

CREATE TYPE subscription_billing_cycle AS ENUM ('mensuel', 'annuel');
CREATE TYPE subscription_status AS ENUM ('en_essai', 'active', 'en_retard', 'suspendue', 'resiliee');

CREATE TYPE movement_type AS ENUM ('entree', 'sortie', 'ajustement', 'transfert_entrant', 'transfert_sortant');

CREATE TYPE promotion_type AS ENUM ('pourcentage', 'montant_fixe', 'prix_special', 'quantite', 'produit_offert', 'code_promo');

CREATE TYPE review_target AS ENUM ('produit', 'livraison', 'service', 'plateforme');

CREATE TYPE qr_target_type AS ENUM ('page_publique', 'catalogue', 'commande', 'promotion', 'recrutement', 'fidelite');

CREATE TYPE recurrence_frequency AS ENUM ('quotidienne', 'hebdomadaire', 'mensuelle', 'personnalisee');

CREATE TYPE notification_type AS ENUM (
  'nouvelle_commande', 'paiement', 'livraison', 'stock_faible', 'nouvelle_candidature',
  'nouveau_message', 'nouvelle_promotion', 'abonnement', 'expiration_essai', 'suspension'
);

-- ============================================================================
-- 2. UTILISATEURS, ENTREPRISES, RÔLES
-- ============================================================================

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE,
  phone             TEXT UNIQUE,
  password_hash     TEXT NOT NULL,
  is_founder        BOOLEAN NOT NULL DEFAULT FALSE,   -- vrai UNIQUEMENT pour les comptes Fondateur
  two_factor_secret TEXT,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- IMPORTANT : is_founder n'est modifiable que par migration/admin serveur,
-- jamais via une route API accessible côté client (voir section Sécurité).

CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  sector          TEXT,                       -- ex: "Boissons", "Électronique", "Grossiste"...
  logo_url        TEXT,
  description     TEXT,
  status          company_status NOT NULL DEFAULT 'en_attente',
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  orange_money_number TEXT,
  orange_money_merchant_code TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,             -- "Directeur", "Manager Stock", "Préparateur"...
  is_director BOOLEAN NOT NULL DEFAULT FALSE,  -- rôle avec droits complets sur l'entreprise
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE permissions (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code  TEXT UNIQUE NOT NULL,   -- ex: "products.manage", "orders.manage", "drivers.manage"
  label TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Un utilisateur peut appartenir à plusieurs entreprises avec un rôle différent dans chacune
CREATE TABLE company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id),
  status      TEXT NOT NULL DEFAULT 'actif',  -- actif, suspendu
  invited_by  UUID REFERENCES users(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
CREATE INDEX idx_company_members_company ON company_members(company_id);
CREATE INDEX idx_company_members_user ON company_members(user_id);

-- ============================================================================
-- 3. CLIENTS (particuliers & professionnels)
-- ============================================================================

CREATE TABLE customer_addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT,                 -- "Domicile", "Bureau"...
  address_line TEXT NOT NULL,
  commune     TEXT,
  city        TEXT,
  latitude    NUMERIC(9,6),
  longitude   NUMERIC(9,6),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_user ON customer_addresses(user_id);

-- Profil client relatif à UNE entreprise (prix pro, type, limites) : un même
-- user peut être "particulier" chez une entreprise et "professionnel" chez une autre.
CREATE TABLE customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              customer_type NOT NULL DEFAULT 'particulier',
  min_order_amount  NUMERIC(14,2),          -- minimum de commande (B2B)
  negotiated_terms  TEXT,
  loyalty_points    INTEGER NOT NULL DEFAULT 0,
  loyalty_tier      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
CREATE INDEX idx_customers_company ON customers(company_id);

-- ============================================================================
-- 4. CATALOGUE PRODUITS
-- ============================================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES categories(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_company ON categories(company_id);

CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id       UUID REFERENCES categories(id),
  name              TEXT NOT NULL,
  description       TEXT,
  sku               TEXT,
  cover_photo_url   TEXT,
  weight_kg         NUMERIC(10,3),
  dimensions        TEXT,
  base_price        NUMERIC(14,2) NOT NULL,      -- prix particulier, unité de base
  professional_price NUMERIC(14,2),
  promo_price       NUMERIC(14,2),
  min_order_quantity INTEGER NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'actif', -- actif, inactif, rupture
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE product_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

-- Conditionnements : unité, pack de 6, pack de 12, carton, palette...
CREATE TABLE product_packagings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,          -- "Bouteille", "Pack de 6", "Carton"...
  unit_count  INTEGER NOT NULL DEFAULT 1,  -- nb d'unités de base contenues
  price       NUMERIC(14,2) NOT NULL,
  professional_price NUMERIC(14,2),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_packagings_product ON product_packagings(product_id);

-- Paliers de tarification professionnelle par quantité
CREATE TABLE pricing_tiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity  INTEGER NOT NULL,
  max_quantity  INTEGER,               -- NULL = "et plus" (souvent prix négociable)
  unit_price    NUMERIC(14,2),         -- NULL si "prix négociable"
  is_negotiable BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_pricing_tiers_product ON pricing_tiers(product_id);

-- ============================================================================
-- 5. DÉPÔTS ET STOCK
-- ============================================================================

CREATE TABLE warehouses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- "Kaloum", "Matoto"...
  address     TEXT,
  latitude    NUMERIC(9,6),
  longitude   NUMERIC(9,6),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_warehouses_company ON warehouses(company_id);

CREATE TABLE inventory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity      INTEGER NOT NULL DEFAULT 0,   -- exprimé en unité de base
  min_threshold INTEGER NOT NULL DEFAULT 0,
  expiry_date   DATE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id)
);
CREATE INDEX idx_inventory_company ON inventory(company_id);
CREATE INDEX idx_inventory_low_stock ON inventory(warehouse_id) WHERE quantity <= min_threshold;

CREATE TABLE inventory_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
  product_id    UUID NOT NULL REFERENCES products(id),
  type          movement_type NOT NULL,
  quantity      INTEGER NOT NULL,
  reference_type TEXT,                 -- "order", "transfer", "manual"...
  reference_id  UUID,
  performed_by  UUID REFERENCES users(id),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_company ON inventory_movements(company_id);
CREATE INDEX idx_movements_product ON inventory_movements(product_id);

-- ============================================================================
-- 6. COMMANDES
-- ============================================================================

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customers(id),
  warehouse_id        UUID REFERENCES warehouses(id),
  delivery_address_id UUID REFERENCES customer_addresses(id),
  order_number        TEXT NOT NULL UNIQUE,        -- "CMD-2025-0418"
  status              order_status NOT NULL DEFAULT 'en_attente',
  subtotal            NUMERIC(14,2) NOT NULL DEFAULT 0,
  delivery_fee        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total               NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method      payment_method,
  payment_status      payment_status NOT NULL DEFAULT 'en_attente',
  promotion_id        UUID,             -- FK ajoutée après création de la table promotions
  recurring_order_id  UUID,             -- FK ajoutée après création de la table recurring_orders
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(company_id, status);

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  packaging_id  UUID REFERENCES product_packagings(id),
  quantity      INTEGER NOT NULL,
  unit_price    NUMERIC(14,2) NOT NULL,
  subtotal      NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE returns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'en_attente',  -- en_attente, approuve, refuse, rembourse
  refund_amount NUMERIC(14,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recurring_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id),
  frequency     recurrence_frequency NOT NULL,
  custom_cron   TEXT,                 -- si fréquence personnalisée
  template_items JSONB NOT NULL,      -- [{product_id, packaging_id, quantity}, ...]
  next_run_at   TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_company ON recurring_orders(company_id);

ALTER TABLE orders ADD CONSTRAINT fk_orders_recurring
  FOREIGN KEY (recurring_order_id) REFERENCES recurring_orders(id);

-- ============================================================================
-- 7. LIVREURS ET LIVRAISONS
-- ============================================================================

CREATE TABLE drivers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  vehicle_type  TEXT,               -- moto, voiture, tricycle...
  vehicle_plate TEXT,
  rating        NUMERIC(2,1) DEFAULT 5.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE driver_applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status      driver_app_status NOT NULL DEFAULT 'en_attente',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, company_id)
);
CREATE INDEX idx_driver_apps_company ON driver_applications(company_id);

-- Un livreur n'est actif pour une entreprise qu'après acceptation de sa candidature
CREATE TABLE company_drivers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status      driver_status NOT NULL DEFAULT 'actif',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, driver_id)
);
CREATE INDEX idx_company_drivers_company ON company_drivers(company_id);

CREATE TABLE deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id       UUID REFERENCES drivers(id),
  delivery_zone_id UUID,             -- FK ajoutée après création de delivery_zones
  status          delivery_status NOT NULL DEFAULT 'commande_acceptee',
  distance_km     NUMERIC(6,2),
  otp_code        TEXT,
  signature_url   TEXT,
  proof_photo_url TEXT,
  accepted_at     TIMESTAMPTZ,
  picked_up_at    TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliveries_company ON deliveries(company_id);
CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);

CREATE TABLE delivery_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  delivery_fee  NUMERIC(14,2) NOT NULL DEFAULT 0,
  geojson       JSONB              -- contour de la zone (optionnel)
);

ALTER TABLE deliveries ADD CONSTRAINT fk_deliveries_zone
  FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id);

-- ============================================================================
-- 8. PAIEMENTS DES COMMANDES
-- ============================================================================

CREATE TABLE order_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount        NUMERIC(14,2) NOT NULL,
  method        payment_method NOT NULL,
  status        payment_status NOT NULL DEFAULT 'en_attente',
  reference     TEXT,               -- ex: référence Orange Money saisie manuellement
  collected_by  UUID REFERENCES users(id),   -- livreur qui a encaissé
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_payments_order ON order_payments(order_id);

CREATE TABLE invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id),
  number      TEXT NOT NULL UNIQUE,
  amount      NUMERIC(14,2) NOT NULL,
  pdf_url     TEXT,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. PROMOTIONS ET FIDÉLITÉ
-- ============================================================================

CREATE TABLE promotions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              promotion_type NOT NULL,
  value             NUMERIC(14,2),          -- % ou montant selon le type
  code              TEXT,                    -- code promo, si applicable
  applies_to_product_id  UUID REFERENCES products(id),
  applies_to_category_id UUID REFERENCES categories(id),
  min_quantity      INTEGER,
  professional_only BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_promotions_company ON promotions(company_id);

ALTER TABLE orders ADD CONSTRAINT fk_orders_promotion
  FOREIGN KEY (promotion_id) REFERENCES promotions(id);

CREATE TABLE loyalty_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id),
  points      INTEGER NOT NULL,        -- positif = gagné, négatif = utilisé
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_customer ON loyalty_transactions(customer_id);

-- ============================================================================
-- 10. QR CODES
-- ============================================================================

CREATE TABLE qr_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,     -- identifiant public opaque (pas d'info sensible)
  target_type qr_target_type NOT NULL,
  target_id   UUID,                     -- ex : id d'une promotion ou d'un produit
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  scan_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- IMPORTANT : la résolution d'un QR code ne renvoie qu'une redirection publique
-- (catalogue, promo...). Elle ne doit JAMAIS attribuer de rôle ou de droit.

-- ============================================================================
-- 11. AVIS
-- ============================================================================

CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type   review_target NOT NULL,
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,  -- NULL si avis plateforme
  order_id      UUID REFERENCES orders(id),
  product_id    UUID REFERENCES products(id),
  reviewer_id   UUID NOT NULL REFERENCES users(id),
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  company_reply TEXT,
  reported      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_company ON reviews(company_id);
-- Règle métier (appliquée côté API) : une entreprise ne peut pas supprimer
-- librement un avis négatif — seul un signalement + modération Fondateur le permet.

-- ============================================================================
-- 12. COMMUNICATION INTERNE
-- ============================================================================

CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT,                 -- livraison, stock, direction, general, commercial
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_groups_company ON groups(company_id);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_post  BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id      UUID NOT NULL REFERENCES users(id),
  content        TEXT,
  attachment_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_group ON messages(group_id, created_at);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES companies(id),
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  related_entity_type TEXT,
  related_entity_id   UUID,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);

-- ============================================================================
-- 13. ABONNEMENT SaaS (Fondateur)
-- ============================================================================

CREATE TABLE plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  monthly_price NUMERIC(14,2) NOT NULL DEFAULT 100000,
  features      JSONB NOT NULL DEFAULT '[]',
  limits        JSONB NOT NULL DEFAULT '{}',  -- {max_users, max_products, max_warehouses...}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE custom_offers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES users(id),   -- Fondateur
  monthly_price NUMERIC(14,2) NOT NULL,
  trial_days    INTEGER NOT NULL DEFAULT 0,
  trial_price   NUMERIC(14,2) NOT NULL DEFAULT 0,
  after_trial_action TEXT NOT NULL DEFAULT 'demander_paiement', -- demander_paiement, suspendre, nouvelle_offre
  features      JSONB NOT NULL DEFAULT '[]',
  limits        JSONB NOT NULL DEFAULT '{}',
  conditions    TEXT,
  status        TEXT NOT NULL DEFAULT 'proposee',  -- proposee, acceptee, refusee
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_offers_company ON custom_offers(company_id);

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES plans(id),
  custom_offer_id UUID REFERENCES custom_offers(id),
  billing_cycle   subscription_billing_cycle NOT NULL DEFAULT 'mensuel',
  price           NUMERIC(14,2) NOT NULL,
  status          subscription_status NOT NULL DEFAULT 'en_essai',
  trial_start     TIMESTAMPTZ,
  trial_end       TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (plan_id IS NOT NULL OR custom_offer_id IS NOT NULL)
);
CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);

CREATE TABLE subscription_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          NUMERIC(14,2) NOT NULL,
  method          TEXT,
  status          payment_status NOT NULL DEFAULT 'en_attente',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sub_payments_subscription ON subscription_payments(subscription_id);

-- ============================================================================
-- 14. JOURNAL D'ACTIVITÉ (sécurité & audit)
-- ============================================================================

CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id),   -- NULL pour les actions Fondateur globales
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,           -- ex: "order.status_changed", "member.role_updated"
  entity_type TEXT,
  entity_id   UUID,
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_company ON activity_logs(company_id, created_at);
CREATE INDEX idx_activity_user ON activity_logs(user_id, created_at);

-- ============================================================================
-- 15. EXEMPLE DE ROW LEVEL SECURITY (isolation stricte multi-tenant)
-- ============================================================================
-- Ces politiques supposent qu'à chaque requête, l'application définit :
--   SET app.current_company_id = '<uuid>';
-- via SET LOCAL dans la transaction, à partir du token authentifié.

-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_products ON products
--   USING (company_id = current_setting('app.current_company_id')::uuid);
--
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_orders ON orders
--   USING (company_id = current_setting('app.current_company_id')::uuid);
--
-- Répéter pour chaque table portant company_id. Le compte Fondateur utilise
-- un rôle DB séparé (BYPASSRLS) réservé à l'espace Fondateur.
