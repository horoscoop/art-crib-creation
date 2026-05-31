## Plan — KOA Guardian v1.1 (admin + paramétrage capteurs + exports)

Périmètre demandé, découpé en lots livrables. Je te confirme dès maintenant le lien de test (il est toujours le même, généré dès la première version) :

**Lien de test (preview stable)** : https://project--78315e02-6a86-483a-9907-40bcd3112992-dev.lovable.app

Ce lien reflète en permanence la dernière version preview de l'app. Une fois publiée, le lien production sera `https://project--78315e02-6a86-483a-9907-40bcd3112992.lovable.app`.

---

### Lot 1 — Rôles & profil administrateur
- Table `user_roles` + enum `app_role` (`admin`, `conservateur`) + fonction `has_role()` (security definer) — modèle anti-récursion RLS.
- Seed automatique du rôle `admin` à l'inscription pour : `celine.angelats@gmail.com`, `horoscoop@outlook.fr`, `nicolas.perbost@yahoo.fr` (trigger sur `auth.users`).
- Mise à jour des RLS : un admin peut lire/modifier toutes les œuvres, capteurs, alertes, profils.
- Table `connection_logs` (user_id, event, ip, user_agent, created_at) alimentée à chaque login (listener `onAuthStateChange`).

### Lot 2 — Console admin (`/admin`)
Onglets :
1. **Utilisateurs & droits** — liste profils, changement de rôle, suspension.
2. **Parc global** — toutes les œuvres tous clients confondus, édition inline (seuils humidité/inclinaison/fluage).
3. **Paramètres de suivi & alertes** — édition des seuils globaux par défaut + par œuvre.
4. **Journal de connexions** — table paginée.

### Lot 3 — Fiche œuvre enrichie
- Bloc « Paramètres initiaux » (valeurs à l'installation : tension nominale, humidité de référence, etc.) — nouvelle colonne `baseline jsonb`.
- Bloc « Système d'accroche » : sélecteur de type (KOA-Wire, KOA-Magnet, KOA-Cleat…) avec fiche illustrative (image + description + plage d'usage + maintenance recommandée). Données seedées en base (`hanging_systems`).
- **Pièces jointes** : bucket privé `artwork-attachments`, table `attachments` (artwork_id, filename, mime, size, uploaded_by). Upload depuis la fiche.

### Lot 4 — Passerelles capteurs (`/admin/gateways` + onglet par œuvre)
- Table `sensor_gateways` (name, protocol `http|mqtt|webhook`, endpoint, auth_token, payload_mapping jsonb, sync_interval_s, last_sync_at, status).
- Table `gateway_artwork_map` (gateway_id, artwork_id, sensor_field_map).
- UI : création/édition de passerelles, test de connexion, mapping de champs JSON → colonnes `sensor_readings`, bouton « Synchroniser maintenant ».
- L'endpoint existant `/api/public/sensors/ingest` est étendu pour accepter un `gateway_token` et appliquer le mapping.

### Lot 5 — Exports PDF & Excel par client
- Server function `exportClientReport({ ownerId, format: 'pdf'|'xlsx' })`.
  - **PDF** : `pdf-lib` côté Worker — page de garde + fiche par œuvre (paramètres initiaux, dernières mesures, alertes, maintenances).
  - **Excel** : `exceljs` — feuilles `Œuvres`, `Mesures`, `Alertes`, `Maintenances`, `Pièces jointes`.
- Boutons d'export dans la console admin (par client) et dans le dashboard conservateur (son propre parc).

---

### Détails techniques
- Stack : TanStack Start + Supabase (Lovable Cloud), tout côté serveur via `createServerFn` + `requireSupabaseAuth`.
- Sécurité : RLS partout, admin via `has_role(auth.uid(), 'admin')`, jamais de check côté client.
- UI admin : même charte « mur blanc » (Instrument Serif + Inter), mais densité augmentée (tableaux, filtres).
- Compatible mobile, mais la console admin sera optimisée desktop (tableaux larges).

### Ordre d'exécution proposé
1. Migration DB (rôles, logs, baseline, attachments, gateways, hanging_systems) — un seul appel migration.
2. Routes admin + RLS étendues.
3. Fiche œuvre enrichie + pièces jointes.
4. Passerelles + ingest étendu.
5. Exports PDF/XLSX.
6. Seed des 3 systèmes d'accroche de référence avec visuels générés.

Estimation : ~5–6 tours d'implémentation. Je peux enchaîner sans te redemander à chaque lot, ou marquer une pause après le Lot 2 (admin opérationnel) pour que tu testes.

**Tu confirmes ce plan ?** Précise aussi :
- Pause après Lot 2 ou tout enchaîner ?
- Pour les fiches illustratives d'accroche, je génère des visuels ou tu fourniras les photos KOA ?
