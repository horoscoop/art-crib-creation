## KOA Guardian — v1.2 : suivi périodique, expertises, sauvegardes, KOA Vision & KOA Trace

Merci pour ce cahier des charges très détaillé. Vu l'ampleur, je propose de découper en 3 vagues livrables, chacune testable de bout en bout. Je commence par la **Vague A** dès ton feu vert et j'enchaîne sur B puis C.

**Lien de test (inchangé)** : https://project--78315e02-6a86-483a-9907-40bcd3112992-dev.lovable.app

---

### Vague A — Suivi, expertises, pièces jointes, sauvegardes (priorité immédiate)

1. **Fiche œuvre enrichie** (clôture du plan v1.1)
   - Bloc « Paramètres initiaux » (baseline jsonb) éditable.
   - Sélecteur de système d'accroche avec fiche illustrative (image générée + description + plage d'usage + maintenance recommandée).
   - Upload de pièces jointes (bucket `artwork-attachments` déjà créé) — UI dans la fiche.

2. **Onglet « Suivi périodique »** (nouveau)
   - Table `inspections` (artwork_id, inspector_id, performed_at, period_type [`monthly`,`quarterly`,`annual`,`ad_hoc`], notes text, score_global, signatures jsonb [fatigue, corrosion, support, fluage, sismique]).
   - Liaison avec `attachments` (photos d'inspection).
   - Vue chronologique par œuvre + vue globale filtrée.
   - Génération automatique de la prochaine échéance selon période.

3. **Module « Expertises KOA »** (nouveau)
   - Table `expertises` (artwork_id, expert_id, performed_at, type [`installation`,`audit`,`incident`,`transfert`], rapport text, recommandations text, charge_mesuree_kg, kit_recommande, certificat_url).
   - Réservé aux profils ayant le rôle `expert_koa` (nouveau rôle ajouté à l'enum).
   - Pièces jointes liées.
   - Export PDF du rapport d'expertise.

4. **Sauvegardes base de données** (admin)
   - Table `backups` (created_by, created_at, size_bytes, storage_path, tables_count, rows_count).
   - Bucket privé `db-backups`.
   - Server function `createBackup()` : export JSON de toutes les tables métier (artworks, sensor_readings, alerts, maintenance_logs, inspections, expertises, attachments metadata, gateways).
   - Bouton « Sauvegarder maintenant » + liste/téléchargement/restauration manuelle dans la console admin.
   - Note : la restauration complète d'un projet Supabase passe par le support Lovable ; ces sauvegardes sont des **exports métier** téléchargeables, suffisants pour reconstruire les données en cas d'incident applicatif.

### Vague B — KOA Vision (diagnostic IA visuel)

5. **KOA Vision — Recommandation d'accrochage**
   - Page `/vision` avec drag & drop 2 photos (œuvre + mur).
   - Server function `analyzeKoaVision()` utilisant **Lovable AI (`google/gemini-2.5-pro` multimodal)** avec prompt expert basé sur ta taxonomie (média → densité, mur → capacité de charge).
   - Moteur de calcul : charge statique × **coefficient sécurité ×4**.
   - Sortie : Kit KOA recommandé (catalogue seed) + justification.
   - Aucune clé API externe nécessaire (Lovable AI Gateway intégré).

6. **KOA Vision — Diagnostic visuel d'état**
   - Page `/vision/diagnostic` : upload photo d'un système installé.
   - Analyse multimodale renvoyant les **signatures visuelles** du catalogue (fatigue, corrosion, support, fluage, systémique) avec niveau de criticité (`mineur`,`modéré`,`majeur`,`critique`).
   - Calcul de l'indice **R_global** (Miner généralisé) avec poids par défaut.
   - Stockage en `inspections` (lien Vague A).

### Vague C — KOA Trace (traçabilité phygitale)

7. **Carte d'Identité Technique**
   - Page publique `/trace/:nfcId` (route `api/public` lecture seule, données non sensibles).
   - Hash de chaque événement (install, maintenance, expertise, transfert) dans une table `trace_events` (hash SHA-256 chaînés — registre append-only signé serveur, prouvable, sans dépendance blockchain externe).
   - Mention claire : « Registre vérifiable » (vraie blockchain = lot ultérieur si besoin, nécessiterait un wallet/contrat).

8. **Transfert de propriété**
   - Fonction `transferArtwork(artworkId, newOwnerEmail)` réservée admin/expert.
   - Génère un événement trace + email de notification (via Lovable AI Gateway / Resend si connecté).

9. **Certificat PDF signé**
   - Export PDF de la carte d'identité avec QR code vers `/trace/:nfcId`.

### Document récapitulatif

10. **`/docs/architecture`** (route in-app, accessible admin)
    - Génère et affiche un récapitulatif Markdown des modules, schéma de données, modèles physiques implémentés, flux capteurs, rôles, exports. Téléchargeable en PDF.

---

### Décisions techniques
- **Pas de blockchain externe** dans cette itération : registre append-only chaîné par hash côté serveur, vérifiable, sans coût ni clé tierce. Migrable vers une vraie blockchain plus tard si demandé.
- **IA = Lovable AI Gateway** (Gemini 2.5 Pro pour multimodal, Gemini 3 Flash pour texte) → pas de clé Google Vision à demander.
- **NFC** : déjà supporté côté lecture (Web NFC), j'ajoute la génération d'IDs cryptés pour les nouvelles étiquettes.
- **Schema.org VisualArtwork** : balisage JSON-LD ajouté sur les pages publiques `/trace/:id`.

### Confirmation demandée
- **OK pour ce découpage en 3 vagues ?**
- Je commence par la **Vague A** complète dans la foulée ?
- Pour les visuels des systèmes d'accroche et kits KOA : je génère des illustrations techniques (style schéma technique sobre) ?
