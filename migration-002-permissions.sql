-- =========================================================================
-- SHOPPRO — Migration 002 : catalogue des permissions
-- =========================================================================
-- À exécuter UNE FOIS dans Supabase : SQL Editor → New query → coller →
-- Run. Sans ce script, la page "Rôles et permissions" n'aura rien à
-- afficher (la table permissions reste vide depuis le schéma initial).
-- =========================================================================

insert into permissions (code, label) values
  ('products.manage',   'Gérer les produits'),
  ('warehouses.manage', 'Gérer les dépôts'),
  ('stock.manage',      'Gérer le stock'),
  ('drivers.manage',    'Gérer les livreurs'),
  ('deliveries.manage', 'Affecter les livraisons'),
  ('promotions.manage', 'Gérer les promotions'),
  ('reviews.manage',    'Répondre aux avis'),
  ('qrcodes.manage',    'Générer des QR codes'),
  ('employees.manage',  'Gérer les employés'),
  ('groups.manage',     'Créer des groupes de discussion')
on conflict (code) do nothing;
