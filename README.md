# LeadScraper Dakar 🇸🇳 — SaaS de prospection B2B au Sénégal

Plateforme web multi-entreprises qui trouve les entreprises d'une activité et d'un quartier donnés
(Dakar, banlieue, régions) avec **téléphones +221, liens WhatsApp, emails, sites web et réseaux sociaux**,
puis génère un **fichier Excel professionnel**.

Vous vendez des abonnements. Vous créez vous-même les comptes de vos clients depuis la
**console administrateur**, et vous pouvez couper ou rétablir l'accès de chaque entreprise en un clic.

---

## Fonctionnalités

### Espace client (`/app`)
- Assistant de recherche en 3 étapes : 10 secteurs et 60 activités prêtes, saisie libre, 38 zones.
- Résultats en direct pendant la collecte. On peut fermer la page, la recherche continue en arrière-plan.
- Filtres : avec téléphone, WhatsApp ou email, recherche texte.
- Export **Excel** (mis en forme, liens cliquables, filtres, feuille « Résumé ») et **CSV** compatible Excel FR.
- Historique des recherches, quota mensuel visible, changement de mot de passe.
- Message clair si l'accès est suspendu ou l'abonnement expiré, avec bouton de contact WhatsApp.

### Console administrateur (`/admin`)
- **Clients & accès** :
  - Création d'une entreprise avec génération automatique d'un mot de passe, envoyé par WhatsApp ou email en un clic.
  - Formules Starter, Pro, Business ou sur mesure, quota mensuel, nombre d'utilisateurs, date de fin d'abonnement.
- **Coupure d'accès immédiate** : toutes les sessions du client sont fermées et ses recherches arrêtées. Le rétablissement se fait en un clic.
- Expiration automatique à la date de fin d'abonnement.
- Gestion des utilisateurs :
  - ajout, désactivation, suppression ;
  - réinitialisation du mot de passe ;
  - déconnexion forcée.
- **Demandes d'accès** reçues depuis la page d'accueil, converties en client en un clic.
- Suivi de toutes les recherches, relance d'une recherche en échec.
- **Journal d'audit** : connexions, créations, coupures, exports.
- **Système & sources** : état des variables d'environnement, santé de chaque source, test en direct.

---

## Robustesse du scraping

Le point faible des scrapers Python classiques est qu'ils dépendent d'une seule source (souvent un
navigateur automatisé sur Google Maps), et Google la bloque vite. Ici, chaque recherche passe par
une **chaîne de sources avec bascule automatique** :

| Ordre | Source | Clé requise | Blocage possible |
|---|---|---|---|
| 1 | Google Places API (officielle) | `GOOGLE_PLACES_API_KEY` | Non |
| 2 | SerpAPI (Google Maps) | `SERPAPI_API_KEY` | Non, géré par le service |
| 3 | Google Maps, lecture directe (sans navigateur) | Aucune | Oui, atténué par `SCRAPER_PROXY_URLS` ou `SCRAPER_GATEWAY_URL` |
| 4 | OpenStreetMap (Overpass, 4 serveurs en rotation) | Aucune | Non, c'est le secours ultime |

Plusieurs mécanismes s'ajoutent à cette chaîne :

- **Disjoncteur** : une source qui échoue 3 fois de suite est mise en pause 20 minutes puis réessayée.
- **Requêtes réseau robustes** :
  - délai maximum par requête ;
  - nouvelles tentatives avec attente exponentielle ;
  - rotation d'empreintes navigateur ;
  - proxys résidentiels et passerelle anti-blocage optionnels.
- **Traitement par étapes** : chaque recherche est découpée en tâches stockées en base. Les fonctions
  serverless traitent les tâches par tranches avec verrou, puis se relancent elles-mêmes. Si une
  exécution est interrompue, la consultation de la page ou la maintenance quotidienne la reprend
  exactement où elle s'était arrêtée.
- **Enrichissement** : le site officiel de chaque entreprise (accueil et pages contact) est analysé
  pour trouver emails, téléphones, Facebook, Instagram, LinkedIn, X, TikTok, YouTube et WhatsApp.
- **Dédoublonnage** par numéro de téléphone, ou par nom et position.

> Pour une fiabilité maximale, ajoutez au moins `GOOGLE_PLACES_API_KEY`.
> Sans aucune clé, l'outil fonctionne quand même : Google direct d'abord, puis OpenStreetMap.

---

## Zéro doublon par entreprise

Un contact n'est **jamais livré deux fois au même client**, même s'il relance exactement la même recherche.

- Chaque contact livré laisse des empreintes dans `app.org_contacts` : identifiant Google ou OSM, numéro de téléphone normalisé, nom et position à 100 m près.
- Une fiche qui partage une seule de ces empreintes avec un contact déjà fourni est écartée. Exemple : la même entreprise trouvée par une autre source, ou avec un format de numéro différent.
- Pour livrer quand même des contacts **nouveaux**, le moteur va plus loin :
  - il pagine plus profondément dans les résultats ;
  - il explore 4 sous-zones du quartier ;
  - il complète avec les autres sources.
- La réservation se fait sous verrou : deux recherches simultanées du même client ne peuvent pas se partager un contact.
- Le client voit combien de doublons ont été écartés. Si tout a déjà été livré, il est invité à changer de quartier ou d'activité.

## Sécurité

| Risque | Protection |
|---|---|
| Vol de session | Cookie `HttpOnly`, `Secure`, `SameSite=Lax` ; jeton aléatoire de 256 bits stocké haché ; révocation immédiate (suspension, réinitialisation, déconnexion) |
| Mots de passe | scrypt avec sel ; mots de passe générés de 12 caractères ; anti force brute (8 essais par email, 30 par IP, sur 15 min) ; temps de réponse identique que l'email existe ou non |
| CSRF | Vérification `Origin` et `Sec-Fetch-Site` sur toutes les requêtes qui modifient des données, en plus de `SameSite` |
| Accès aux données d'un autre client | Chaque requête est filtrée par entreprise ; routes admin réservées au super-admin |
| Injection SQL | Requêtes paramétrées uniquement ; validation stricte des entrées (zod) |
| XSS | Échappement par React ; liens externes limités à http(s), donc pas de `javascript:` ; CSP stricte |
| SSRF (analyse des sites web) | Refus des IP internes, des hôtes locaux, de l'adresse de métadonnées cloud et des ports non standard ; chaque redirection est revérifiée |
| Injection de formules Excel | Cellules CSV commençant par `= + - @` neutralisées |
| Moteur et tâche planifiée | Secret obligatoire comparé en temps constant ; route refusée si le secret n'est pas configuré |
| En-têtes | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, pas de cache sur l'API |
| Base de données | Schéma privé non exposé par l'API Supabase ; rôle applicatif aux droits minimaux |
| Dépendances | `npm audit` sans vulnérabilité connue |

Tests :

```bash
npm test                                            # tests unitaires : sécurité, doublons, téléphones
BASE_URL=https://votre-app.vercel.app TEST_EMAIL=… TEST_PASSWORD=… npm test   # + tests HTTP de bout en bout
```

## Architecture

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4), hébergé sur **Vercel**.
- **PostgreSQL Supabase**, dans le schéma privé `app`. Il n'est pas exposé par l'API publique de Supabase ;
  seul le rôle dédié `leadscraper_app` y accède.
- Sessions stockées en base, cookie `httpOnly` : la révocation est instantanée.
- Mots de passe hachés avec scrypt.
- Protections :
  - anti force brute (8 essais par email et 30 par IP sur 15 minutes) ;
  - contrôle d'origine contre le CSRF ;
  - en-têtes de sécurité.
- Tâche planifiée quotidienne (`/api/cron/maintenance`) : nettoyage, reprise des travaux bloqués, base maintenue active.

```
src/
├── app/                 # pages (accueil, connexion, /app client, /admin) et routes /api
├── components/          # interface (tableaux, assistant, modales…)
└── lib/
    ├── scraper/         # moteur : sources, bascule, enrichissement, worker
    ├── data/            # zones du Sénégal et secteurs d'activité
    ├── auth.ts, api.ts  # sessions, sécurité
    └── export.ts        # Excel / CSV
legacy-python/           # ancienne application Streamlit (utilisable en local)
```

## Variables d'environnement

Toutes les variables sont documentées dans [`.env.example`](.env.example).

## Développement local

```bash
npm install
cp .env.example .env.local   # puis remplir DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, WORKER_SECRET
npm run dev
npm test                     # tests unitaires
```

## Avant de vendre : points de vigilance

1. **Vercel Hobby est réservé à un usage non commercial.** Passez sur Vercel Pro avant de facturer des clients.
   Pro permet aussi des fonctions plus longues et plus de tâches planifiées.
2. **Supabase gratuit met en pause un projet inactif après 7 jours.** La tâche quotidienne limite ce risque,
   mais Supabase Pro est recommandé en production.
3. **Données personnelles** : les fiches d'entreprises sont publiques, mais la prospection doit respecter la
   loi sénégalaise n° 2008-12 sur la protection des données personnelles (CDP). Prévoyez des CGU pour vos clients.
4. **Conditions d'utilisation de Google** : la lecture directe de Google Maps n'est pas autorisée par Google.
   La voie conforme est l'API Places officielle, déjà intégrée et prioritaire dès que la clé est fournie.
