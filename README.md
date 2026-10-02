# LeadScraper Dakar 🇸🇳 — Google Maps Scraper Pro

Un logiciel de génération de leads locaux au **Sénégal** basé sur Google Maps.
Extraction automatique des coordonnées d'entreprises à **Dakar** et dans les autres villes sénégalaises, avec enrichissement des **emails** et **réseaux sociaux**.

---

## ✨ Fonctionnalités

- 🛡️ **100% Gratuit — Aucune clé API Google requise**
- 🇸🇳 **Adapté Sénégal/Dakar** : Quartiers, secteurs locaux, numéros +221
- 📞 **Détection de l'opérateur** : Orange, Free, Expresso, Fixe Sonatel
- 💬 **Lien WhatsApp direct** généré pour chaque entreprise
- ✉️ **Enrichissement d'emails** depuis le site web officiel
- 📱 **Réseaux sociaux** : Instagram, LinkedIn, Facebook, TikTok
- 📊 **Export Excel (.xlsx)** stylisé + **CSV (.csv)** UTF-8 (compatible Excel FR)
- 🔄 **Mode Batch** : scraper plusieurs quartiers/secteurs en une seule session

---

## 🚀 Installation & Lancement local

### Avec `uv` (recommandé)
```bash
uv run playwright install chromium
uv run streamlit run app.py
```

### Avec `pip`
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
streamlit run app.py
```

---

## 📁 Structure
```
├── app.py                         # Interface Streamlit (Dashboard)
├── src/google_maps_scraper/
│   ├── scraper.py                 # Moteur Playwright / Google Maps
│   ├── enricher.py                # Crawl emails & réseaux sociaux
│   └── exporter.py                # Génération Excel & CSV
├── exports/                       # Fichiers générés
├── requirements.txt
└── run.bat                        # Lanceur Windows 1 clic
```

---

## ☁️ Déploiement Streamlit Cloud

1. Forkez ce dépôt sur votre compte GitHub
2. Connectez-vous sur [share.streamlit.io](https://share.streamlit.io)
3. Sélectionnez ce dépôt et le fichier `app.py`
4. Cliquez sur **Deploy** — URL publique obtenue en 2 minutes

> **Note Streamlit Cloud** : Playwright/Chromium nécessite le fichier `packages.txt` présent dans ce repo pour l'installation des dépendances système (chromium, libglib, etc.).

---

## 📝 Exemples de recherches
- `Agence immobilière Almadies Dakar`
- `Cabinet médical Plateau Dakar Sénégal`
- `Transitaire port de Dakar`
- `BTP Sacré-Cœur Dakar`
- `Restaurant Mermoz Dakar`
