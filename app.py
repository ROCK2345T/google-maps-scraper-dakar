"""
Google Maps Lead Scraper Pro — Édition Dakar & Sénégal
Interface Web Interactive (Streamlit)
Extraction d'entreprises locales, numéros de téléphone, adresses,
sites web, emails et réseaux sociaux sans AUCUNE clé API payante.
"""

import os
import sys
import re
import asyncio
from datetime import datetime
import pandas as pd
import streamlit as st

# Ajout du dossier src au PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))

from google_maps_scraper import (
    GoogleMapsScraper,
    format_records_for_export,
    generate_excel_bytes,
    generate_csv_bytes,
    save_export_files
)

# ---------------------------------------------------------------------------
# DONNÉES GÉOGRAPHIQUES — DAKAR & SÉNÉGAL
# ---------------------------------------------------------------------------

COMMUNES_DAKAR = [
    "Dakar Plateau",
    "Almadies",
    "Ngor",
    "Yoff",
    "Ouakam",
    "Mermoz",
    "Sacré-Cœur",
    "Point E",
    "Fann",
    "Médina",
    "Gueule Tapée",
    "Biscuiterie",
    "Parcelles Assainies",
    "Golf",
    "Maristes",
    "Liberté 6",
    "Pikine",
    "Guédiawaye",
    "Hann Bel-Air",
    "Djirak / Mbao",
    "Rufisque",
    "Thiès",
    "Saint-Louis",
    "Touba",
    "Ziguinchor",
    "Kaolack",
    "Mbour",
    "Saly",
    "Diamniadio",
    "Toubab Dialaw"
]

SECTEURS_DAKAR = {
    "🏗️ BTP & Architecture": [
        "Cabinet d'architecture", "Bureau d'études BTP", "Entreprise de construction",
        "Maçon", "Plombier", "Électricien", "Menuiserie", "Ferronnerie",
        "Peintre bâtiment", "Carreleur", "Faux plafond"
    ],
    "🏠 Immobilier & Promotion": [
        "Agence immobilière", "Promoteur immobilier", "Géomètre expert",
        "Notaire", "Syndic de copropriété"
    ],
    "🚢 Transport & Logistique": [
        "Transitaire", "Commissionnaire en douane", "Agence de fret",
        "Location de véhicule", "Transport de marchandises", "Déménagement"
    ],
    "🏥 Santé & Médical": [
        "Clinique", "Cabinet médical", "Pharmacie", "Dentiste",
        "Gynécologue", "Pédiatre", "Opticien", "Radiologie", "Laboratoire d'analyses"
    ],
    "🏨 Hôtellerie & Tourisme": [
        "Hôtel", "Résidence hôtelière", "Auberge", "Lodge",
        "Agence de voyage", "Tour opérateur", "Restaurant"
    ],
    "⚖️ Juridique & Finance": [
        "Cabinet d'avocat", "Notaire", "Huissier de justice",
        "Cabinet comptable", "Expert-comptable", "Fiduciaire",
        "Bureau de change", "Micro-finance"
    ],
    "💻 Informatique & Télécom": [
        "Société informatique", "Développeur web", "Infographiste",
        "Impression numérique", "Réparation téléphone", "Cybercafé"
    ],
    "🎓 Formation & Éducation": [
        "École privée", "Institut de formation", "Université privée",
        "Centre de langues", "Cours de soutien"
    ],
    "🛒 Commerce & Distribution": [
        "Supermarché", "Grossiste", "Import-Export",
        "Boutique de vêtements", "Matériaux de construction"
    ],
    "🍽️ Restauration": [
        "Restaurant", "Fast-food", "Traiteur", "Boulangerie",
        "Café", "Brasserie"
    ]
}

# Formats de numéros sénégalais pour la détection et le formatage
SN_PHONE_PATTERNS = {
    "Orange SN": r"\+?221\s*7[78]\s*\d{3}\s*\d{2}\s*\d{2}",
    "Free SN": r"\+?221\s*76\s*\d{3}\s*\d{2}\s*\d{2}",
    "Expresso / Promobile": r"\+?221\s*7[05]\s*\d{3}\s*\d{2}\s*\d{2}",
    "Fixe Sonatel / Camtel": r"\+?221\s*33\s*\d{3}\s*\d{2}\s*\d{2}",
}

def format_sn_phone(phone: str) -> str:
    """Nettoie et formate les numéros de téléphone sénégalais."""
    if not phone:
        return phone
    # Supprimer espaces superflus
    clean = re.sub(r"\s+", " ", phone.strip())
    # Ajouter le +221 si manquant et commence par 7 ou 3
    if re.match(r"^[73]\d{7}$", clean.replace(" ", "")):
        clean = "+221 " + clean
    return clean

def detect_operator(phone: str) -> str:
    """Identifie l'opérateur télécom sénégalais."""
    if not phone:
        return ""
    clean = phone.replace(" ", "").replace("+", "").replace("-", "")
    if clean.startswith("221"):
        prefix = clean[3:5]
    else:
        prefix = clean[:2]
    mapping = {
        "77": "🟠 Orange", "78": "🟠 Orange",
        "76": "🔵 Free", "70": "🟣 Expresso",
        "75": "🟣 Promobile", "33": "📞 Fixe"
    }
    return mapping.get(prefix, "")

def whatsapp_link(phone: str) -> str:
    """Génère un lien WhatsApp direct pour un numéro sénégalais."""
    digits = re.sub(r"[^\d]", "", phone)
    if len(digits) >= 9:
        return f"https://wa.me/{digits}"
    return ""

# ---------------------------------------------------------------------------
# CONFIGURATION STREAMLIT
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="LeadScraper Dakar 🇸🇳",
    page_icon="🇸🇳",
    layout="wide",
    initial_sidebar_state="expanded"
)

EXPORTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "exports"))
os.makedirs(EXPORTS_DIR, exist_ok=True)

st.markdown("""
<style>
    .main-header {
        font-size: 2.1rem;
        font-weight: 900;
        background: linear-gradient(90deg, #00853F 0%, #FDEF42 50%, #E31B23 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.15rem;
    }
    .badge {
        display: inline-block;
        background: #00853F;
        color: white;
        font-size: 0.82rem;
        font-weight: 700;
        padding: 0.2rem 0.8rem;
        border-radius: 9999px;
        margin-bottom: 1.4rem;
    }
    .metric-card {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 0.75rem;
        padding: 1rem;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .metric-value { font-size: 1.9rem; font-weight: 800; color: #00853F; }
    .metric-label { font-size: 0.8rem; color: #64748B; text-transform: uppercase; font-weight: 600; }
    .op-badge { font-size: 0.8rem; padding: 0.15rem 0.5rem; border-radius: 0.4rem; }
</style>
""", unsafe_allow_html=True)

# Session state
for key, default in [
    ("scraped_data", []),
    ("is_scraping", False),
    ("stop_requested", False),
    ("logs", []),
    ("last_export_files", None),
]:
    if key not in st.session_state:
        st.session_state[key] = default

# ---------------------------------------------------------------------------
# SIDEBAR — PARAMÈTRES
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown("## 🇸🇳 LeadScraper Dakar")
    st.markdown("---")

    mode = st.radio(
        "Mode de recherche",
        ["🔍 Requête libre", "📍 Par quartier + secteur", "📋 Multi-requêtes (Batch)"],
        help="Choisissez votre façon de rechercher."
    )

    queries = []

    if mode == "🔍 Requête libre":
        q = st.text_input(
            "Terme de recherche",
            value="Agence immobilière Almadies Dakar",
            placeholder="Ex: Clinique Plateau Dakar, Restaurant Mermoz..."
        )
        if q:
            queries = [q.strip()]

    elif mode == "📍 Par quartier + secteur":
        secteur_key = st.selectbox("Secteur d'activité", list(SECTEURS_DAKAR.keys()))
        sous_secteurs = st.multiselect(
            "Choisissez le(s) type(s) d'entreprise",
            SECTEURS_DAKAR[secteur_key],
            default=[SECTEURS_DAKAR[secteur_key][0]]
        )
        commune = st.selectbox("Quartier / Commune", COMMUNES_DAKAR)
        for ss in sous_secteurs:
            queries.append(f"{ss} {commune} Sénégal")
        if queries:
            st.caption(f"**{len(queries)} requête(s) générée(s)** :")
            for q in queries:
                st.caption(f"• {q}")

    else:  # Batch
        batch_text = st.text_area(
            "Requêtes (une par ligne)",
            value="Agence immobilière Almadies Dakar\nCabinet médical Plateau Dakar\nRestaurant Mermoz Dakar",
            height=140
        )
        queries = [l.strip() for l in batch_text.splitlines() if l.strip()]

    st.markdown("---")
    max_results = st.slider("Nombre max de résultats par requête", 5, 100, 20, 5)

    st.subheader("⚙️ Options avancées")
    enrich_emails = st.checkbox("✉️ Enrichir avec emails & réseaux sociaux", value=True)
    headless_mode = st.checkbox("🖥️ Mode silencieux (arrière-plan)", value=True)
    polite_delay = st.slider("Pause anti-blocage (sec)", 0.8, 3.5, 1.3, 0.2)

    st.markdown("---")
    c1, c2 = st.columns(2)
    start_btn = c1.button("🚀 Lancer", type="primary", use_container_width=True, disabled=st.session_state.is_scraping)
    stop_btn = c2.button("🛑 Stop", type="secondary", use_container_width=True, disabled=not st.session_state.is_scraping)
    if stop_btn:
        st.session_state.stop_requested = True

# ---------------------------------------------------------------------------
# EN-TÊTE
# ---------------------------------------------------------------------------

st.markdown('<div class="main-header">🇸🇳 LeadScraper Dakar Pro</div>', unsafe_allow_html=True)
st.markdown('<span class="badge">Sans clé API • Données locales Sénégal • Export Excel & CSV</span>', unsafe_allow_html=True)

tab_results, tab_history, tab_logs, tab_guide = st.tabs([
    "📊 Résultats & Export", "📁 Historique", "🖥️ Logs en direct", "💡 Guide"
])

# ---------------------------------------------------------------------------
# LOGIQUE DE SCRAPING
# ---------------------------------------------------------------------------

if start_btn and queries:
    st.session_state.is_scraping = True
    st.session_state.stop_requested = False
    st.session_state.scraped_data = []
    st.session_state.logs = []

    with tab_results:
        pbar = st.progress(0)
        status_txt = st.empty()
        kpi = st.columns(4)
        kpi_total, kpi_phone, kpi_web, kpi_email = [c.empty() for c in kpi]
        table_ph = st.empty()

        def render_kpis():
            data = st.session_state.scraped_data
            t = len(data)
            p = sum(1 for d in data if d.get("phone"))
            w = sum(1 for d in data if d.get("website"))
            e = sum(1 for d in data if d.get("primary_email") or d.get("emails"))
            kpi_total.markdown(f'<div class="metric-card"><div class="metric-value">{t}</div><div class="metric-label">Entreprises</div></div>', unsafe_allow_html=True)
            kpi_phone.markdown(f'<div class="metric-card"><div class="metric-value">{p}</div><div class="metric-label">Téléphones</div></div>', unsafe_allow_html=True)
            kpi_web.markdown(f'<div class="metric-card"><div class="metric-value">{w}</div><div class="metric-label">Sites Web</div></div>', unsafe_allow_html=True)
            kpi_email.markdown(f'<div class="metric-card"><div class="metric-value">{e}</div><div class="metric-label">Emails</div></div>', unsafe_allow_html=True)

        render_kpis()

        def on_event(event):
            ev_type = event.get("type")
            if ev_type == "log":
                st.session_state.logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] {event.get('message')}")
            elif ev_type == "progress":
                curr = event.get("current", 0)
                tot = max(event.get("total", 1), 1)
                pbar.progress(min(curr / tot, 1.0))
                status_txt.info(event.get("message", ""))
            elif ev_type == "item":
                item = event.get("data", {})
                # Enrichissement numéro sénégalais
                item["phone"] = format_sn_phone(item.get("phone", ""))
                item["operator"] = detect_operator(item.get("phone", ""))
                item["whatsapp"] = whatsapp_link(item.get("phone", ""))
                st.session_state.scraped_data.append(item)
                render_kpis()
                df_tmp = format_records_for_export(st.session_state.scraped_data)
                table_ph.dataframe(df_tmp, use_container_width=True)

        scraper = GoogleMapsScraper(
            headless=headless_mode,
            polite_delay=polite_delay,
            lang="fr",
            enrich_emails=enrich_emails,
            status_callback=on_event,
            should_stop=lambda: st.session_state.stop_requested
        )

        try:
            status_txt.info("Démarrage du navigateur...")
            for idx, q in enumerate(queries, 1):
                if st.session_state.stop_requested:
                    break
                # Forcer le contexte Sénégal si absent
                if "sénégal" not in q.lower() and "dakar" not in q.lower() and "senegal" not in q.lower():
                    q_final = f"{q} Dakar Sénégal"
                else:
                    q_final = q
                st.session_state.logs.append(f"--- Requête {idx}/{len(queries)}: {q_final} ---")
                asyncio.run(scraper.scrape(q_final, max_results=max_results))

            pbar.progress(1.0)
            status_txt.success("✅ Scraping terminé avec succès !")

            if st.session_state.scraped_data:
                tag = queries[0].replace(" ", "_")[:30]
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                files = save_export_files(
                    st.session_state.scraped_data,
                    f"dakar_leads_{tag}_{ts}",
                    output_dir=EXPORTS_DIR
                )
                st.session_state.last_export_files = files

        except Exception as err:
            status_txt.error(f"Erreur : {err}")
            st.session_state.logs.append(f"ERREUR: {err}")
        finally:
            st.session_state.is_scraping = False

# ---------------------------------------------------------------------------
# ONGLET 1 — RÉSULTATS
# ---------------------------------------------------------------------------

with tab_results:
    if not st.session_state.is_scraping:
        data = st.session_state.scraped_data
        t = len(data)
        p = sum(1 for d in data if d.get("phone"))
        w = sum(1 for d in data if d.get("website"))
        e = sum(1 for d in data if d.get("primary_email") or d.get("emails"))

        kpi_c = st.columns(4)
        kpi_c[0].markdown(f'<div class="metric-card"><div class="metric-value">{t}</div><div class="metric-label">Entreprises</div></div>', unsafe_allow_html=True)
        kpi_c[1].markdown(f'<div class="metric-card"><div class="metric-value">{p}</div><div class="metric-label">Téléphones</div></div>', unsafe_allow_html=True)
        kpi_c[2].markdown(f'<div class="metric-card"><div class="metric-value">{w}</div><div class="metric-label">Sites Web</div></div>', unsafe_allow_html=True)
        kpi_c[3].markdown(f'<div class="metric-card"><div class="metric-value">{e}</div><div class="metric-label">Emails</div></div>', unsafe_allow_html=True)

        st.write("")

        if data:
            df_export = format_records_for_export(data)

            # Ajout des colonnes spécifiques Sénégal
            operators = [detect_operator(d.get("phone", "")) for d in data]
            whatsapps = [whatsapp_link(d.get("phone", "")) for d in data]
            df_export.insert(3, "Opérateur", operators)
            df_export.insert(4, "Lien WhatsApp", whatsapps)

            dc1, dc2, dc3 = st.columns([1, 1, 2])
            dc1.download_button(
                "📥 Excel (.xlsx)",
                generate_excel_bytes(df_export),
                f"dakar_leads_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                type="primary", use_container_width=True
            )
            dc2.download_button(
                "📥 CSV (.csv)",
                generate_csv_bytes(df_export),
                f"dakar_leads_{datetime.now().strftime('%Y%m%d_%H%M')}.csv",
                mime="text/csv",
                use_container_width=True
            )

            st.divider()
            fc1, fc2, fc3 = st.columns(3)
            only_phone = fc1.checkbox("Avec téléphone uniquement", False)
            only_email = fc2.checkbox("Avec email uniquement", False)
            search_name = fc3.text_input("🔎 Filtrer par nom", "")

            filtered = df_export.copy()
            if only_phone:
                filtered = filtered[filtered["Téléphone"].str.len() > 0]
            if only_email:
                filtered = filtered[filtered["Email de contact"].str.len() > 0]
            if search_name:
                filtered = filtered[filtered["Nom de l'entreprise"].str.contains(search_name, case=False, na=False)]

            st.dataframe(filtered, use_container_width=True, height=480)
            st.caption(f"{len(filtered)} sur {len(df_export)} résultats affichés.")
        else:
            st.info("🇸🇳 Configurez votre recherche dans la barre latérale et cliquez sur **🚀 Lancer** pour commencer.")
            st.markdown("""
            **Exemples de recherches pour Dakar :**
            - `Agence immobilière Almadies Dakar`
            - `Cabinet médical Plateau Dakar`
            - `Bureau d'études BTP Sacré-Cœur Dakar`
            - `Transitaire port de Dakar`
            - `Restaurant Mermoz Dakar`
            """)

# ---------------------------------------------------------------------------
# ONGLET 2 — HISTORIQUE
# ---------------------------------------------------------------------------

with tab_history:
    st.subheader("📁 Fichiers exportés")
    export_files = sorted(
        [f for f in os.listdir(EXPORTS_DIR) if f.endswith((".xlsx", ".csv"))],
        key=lambda x: os.path.getmtime(os.path.join(EXPORTS_DIR, x)),
        reverse=True
    )
    if export_files:
        rows = []
        for fname in export_files:
            fpath = os.path.join(EXPORTS_DIR, fname)
            rows.append({
                "Fichier": fname,
                "Format": "Excel" if fname.endswith(".xlsx") else "CSV",
                "Taille (Ko)": round(os.path.getsize(fpath) / 1024, 1),
                "Date": datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%d/%m/%Y %H:%M")
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True)
        selected = st.selectbox("Re-télécharger :", export_files)
        if selected:
            fpath = os.path.join(EXPORTS_DIR, selected)
            with open(fpath, "rb") as f:
                content = f.read()
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if selected.endswith(".xlsx") else "text/csv"
            st.download_button(f"💾 Télécharger {selected}", content, selected, mime=mime)
    else:
        st.info("Aucun export généré pour l'instant.")

# ---------------------------------------------------------------------------
# ONGLET 3 — LOGS
# ---------------------------------------------------------------------------

with tab_logs:
    st.subheader("🖥️ Console d'activité")
    if st.session_state.logs:
        st.text_area("Logs", "\n".join(st.session_state.logs), height=400)
    else:
        st.write("Aucune activité.")

# ---------------------------------------------------------------------------
# ONGLET 4 — GUIDE
# ---------------------------------------------------------------------------

with tab_guide:
    st.markdown("""
    ## 💡 Guide LeadScraper Dakar

    ### Comment utiliser l'outil ?

    **Mode "Par quartier + secteur"** (recommandé) :
    1. Sélectionnez un secteur (ex: 🏗️ BTP & Architecture)
    2. Choisissez un ou plusieurs types d'entreprises
    3. Choisissez un quartier de Dakar (Almadies, Plateau, Mermoz...)
    4. Cliquez sur **🚀 Lancer**

    **Mode "Requête libre"** :
    - Tapez exactement ce que vous taperiez sur Google Maps.
    - Ex: `Notaire Dakar Plateau`, `Hôtel Ngor Dakar`

    ---

    ### 📱 Numéros sénégalais détectés automatiquement
    | Préfixe | Opérateur |
    |---|---|
    | +221 77 / 78 | 🟠 Orange Sénégal |
    | +221 76 | 🔵 Free Sénégal |
    | +221 70 / 75 | 🟣 Expresso / Promobile |
    | +221 33 | 📞 Fixe (Sonatel) |

    ### 📲 Colonne "Lien WhatsApp"
    Chaque numéro trouvé génère un lien direct `wa.me/...` — cliquez pour démarrer une conversation WhatsApp instantanément.

    ### 💾 Export des données
    - **Excel (.xlsx)** : fichier professionnel stylisé avec filtres activés.
    - **CSV (.csv)** : compatible Excel FR/Europe (UTF-8 BOM, séparateur `;`).

    ---

    ### 🛡️ Aucune clé API requise
    Ce logiciel utilise l'automatisation de navigateur Chromium et lit directement la version Web publique de Google Maps.
    """)
