"""
Module principal de scraping Google Maps via Playwright.
Ne nécessite AUCUNE clé API Google Maps payante.
Automatise la recherche, le défilement du flux de résultats,
l'extraction détaillée des informations d'entreprises et l'enrichissement.
"""

import asyncio
import re
import urllib.parse
from typing import List, Dict, Any, Optional, Callable
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from .enricher import enrich_website

# Sélecteurs fréquents pour les bannières de consentement cookies Google
COOKIE_SELECTORS = [
    'button:has-text("Tout accepter")',
    'button:has-text("Accepter tout")',
    'button:has-text("J\'accepte")',
    'button[aria-label*="accepter" i]',
    'form:has-text("Tout accepter") button',
    'button:has-text("Accept all")',
    'button[aria-label*="Accept all" i]',
    'button:has-text("Agree")',
    'button:has-text("Ich stimme zu")'
]

class GoogleMapsScraper:
    def __init__(
        self,
        headless: bool = True,
        polite_delay: float = 1.2,
        lang: str = "fr",
        enrich_emails: bool = True,
        status_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        should_stop: Optional[Callable[[], bool]] = None
    ):
        """
        Initialise le scraper Google Maps.
        
        Args:
            headless: Si True, tourne en arrière-plan sans ouvrir de fenêtre visible.
            polite_delay: Délai en secondes entre actions pour simuler un comportement humain.
            lang: Langue de recherche Google Maps ('fr', 'en', etc.).
            enrich_emails: Si True, visite les sites web trouvés pour récupérer emails et réseaux sociaux.
            status_callback: Fonction de rappel pour diffuser les logs et résultats en temps réel.
            should_stop: Fonction booléenne pour interrompre immédiatement le scraping si demandée.
        """
        self.headless = headless
        self.polite_delay = polite_delay
        self.lang = lang
        self.enrich_emails = enrich_emails
        self.status_callback = status_callback
        self.should_stop = should_stop

    def log(self, message: str, level: str = "info"):
        """Diffuse un message de log vers l'interface."""
        if self.status_callback:
            self.status_callback({
                "type": "log",
                "level": level,
                "message": message
            })

    def emit_progress(self, current: int, total: int, message: str):
        """Diffuse l'avancement chiffré vers l'interface."""
        if self.status_callback:
            self.status_callback({
                "type": "progress",
                "current": current,
                "total": total,
                "message": message
            })

    def emit_item(self, item: Dict[str, Any]):
        """Diffuse une entreprise extraite dès qu'elle est prête."""
        if self.status_callback:
            self.status_callback({
                "type": "item",
                "data": item
            })

    async def _handle_cookie_consent(self, page: Page):
        """Détecte et clique sur le bouton d'acceptation des cookies si présent."""
        for selector in COOKIE_SELECTORS:
            try:
                btn = page.locator(selector).first
                if await btn.is_visible(timeout=1200):
                    self.log(f"Acceptation automatique du bandeau de consentement...", "info")
                    await btn.click()
                    await page.wait_for_timeout(1500)
                    return True
            except Exception:
                pass
        return False

    async def _extract_detail_from_url(self, context: BrowserContext, place_url: str, card_info: Dict[str, Any]) -> Dict[str, Any]:
        """Ouvre la fiche détaillée d'un établissement pour extraire toutes ses coordonnées précises."""
        detail_data = dict(card_info)
        detail_page = None
        
        try:
            detail_page = await context.new_page()
            await detail_page.goto(place_url, wait_until="domcontentloaded", timeout=16000)
            await detail_page.wait_for_timeout(int(self.polite_delay * 1000))
            
            # 1. Nom exact (si h1 présent)
            h1_el = detail_page.locator('h1.DUwDvf').first
            if await h1_el.count() > 0:
                name_text = (await h1_el.inner_text()).strip()
                if name_text:
                    detail_data["name"] = name_text
                    
            # 2. Adresse complète
            addr_el = detail_page.locator('button[data-item-id="address"]').first
            if await addr_el.count() > 0:
                raw_addr = await addr_el.get_attribute("aria-label") or await addr_el.inner_text()
                addr = raw_addr.replace("Adresse: ", "").replace("Address: ", "").strip()
                if addr:
                    detail_data["address"] = addr
                    
            # 3. Numéro de téléphone
            phone_el = detail_page.locator('button[data-item-id*="phone"]').first
            if await phone_el.count() > 0:
                raw_phone = await phone_el.get_attribute("aria-label") or await phone_el.inner_text()
                clean_phone = (
                    raw_phone.replace("Numéro de téléphone: ", "")
                    .replace("Téléphone: ", "")
                    .replace("Phone: ", "")
                    .strip()
                )
                if clean_phone:
                    detail_data["phone"] = clean_phone
                    
            # 4. Site web officiel
            web_el = detail_page.locator('a[data-item-id="authority"]').first
            if await web_el.count() > 0:
                website = await web_el.get_attribute("href")
                if website:
                    detail_data["website"] = website
            else:
                alt_web = detail_page.locator('a[aria-label*="Site Web" i], a[aria-label*="site web" i]').first
                if await alt_web.count() > 0:
                    alt_url = await alt_web.get_attribute("href")
                    if alt_url:
                        detail_data["website"] = alt_url

            # 5. Catégorie
            cat_el = detail_page.locator('button[jsaction*="category"]').first
            if await cat_el.count() > 0:
                cat_text = (await cat_el.inner_text()).strip()
                if cat_text:
                    detail_data["category"] = cat_text
                    
            # 6. Coordonnées GPS (Latitude, Longitude)
            current_url = detail_page.url
            detail_data["maps_url"] = current_url
            coord_match = (
                re.search(r'!3d([-\d.]+)!4d([-\d.]+)', current_url) or
                re.search(r'/@([-\d.]+),([-\d.]+),', current_url)
            )
            if coord_match:
                detail_data["latitude"] = coord_match.group(1)
                detail_data["longitude"] = coord_match.group(2)
                
            # 7. Note et nombre d'avis
            rat_el = detail_page.locator('div.F7nice span[aria-hidden="true"]').first
            if await rat_el.count() > 0:
                rat_text = (await rat_el.inner_text()).strip()
                if rat_text:
                    detail_data["rating"] = rat_text
                    
            rev_el = detail_page.locator('div.F7nice span[aria-label*="avis" i], div.F7nice span[aria-label*="reviews" i]').first
            if await rev_el.count() > 0:
                rev_text = await rev_el.get_attribute("aria-label") or ""
                m = re.search(r'(\d[\d\s\xa0]*)\s*(?:avis|reviews)', rev_text, re.IGNORECASE)
                if m:
                    detail_data["reviews_count"] = m.group(1).replace("\xa0", "").replace(" ", "")

        except Exception as e:
            self.log(f"Notice lors de l'extraction des détails de {card_info.get('name')}: {e}", "warning")
        finally:
            if detail_page:
                try:
                    await detail_page.close()
                except Exception:
                    pass
                    
        # 8. Enrichissement emails et réseaux sociaux si activé et site web présent
        if self.enrich_emails and detail_data.get("website"):
            site = detail_data["website"]
            # Éviter de scraper les plateformes tierces comme Doctolib, PagesJaunes, Facebook si ce n'est pas le site de l'entreprise
            skip_enrichment_domains = ("google.com", "doctolib.fr", "pagesjaunes.fr", "facebook.com", "instagram.com")
            if not any(d in site.lower() for d in skip_enrichment_domains):
                self.log(f"Recherche d'emails sur {site}...", "info")
                try:
                    enrichment = await enrich_website(site, timeout=7.0)
                    detail_data["primary_email"] = enrichment.get("primary_email", "")
                    detail_data["emails"] = enrichment.get("emails", [])
                    detail_data["instagram"] = enrichment.get("instagram", "")
                    detail_data["linkedin"] = enrichment.get("linkedin", "")
                    detail_data["facebook"] = enrichment.get("facebook", "")
                    detail_data["twitter"] = enrichment.get("twitter", "")
                    if detail_data["primary_email"]:
                        self.log(f"Email trouvé : {detail_data['primary_email']}", "success")
                except Exception as ex:
                    self.log(f"Erreur d'enrichissement pour {site}: {ex}", "warning")
                    
        return detail_data

    async def scrape(self, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
        """
        Exécute le scraping pour une requête donnée.
        
        Args:
            query: Terme de recherche (ex: "Boulangerie Paris Bastille", "Plombier Lyon 6").
            max_results: Nombre maximal d'entreprises à extraire.
            
        Returns:
            Liste des dictionnaires contenant les données des entreprises.
        """
        results: List[Dict[str, Any]] = []
        encoded_query = urllib.parse.quote(query)
        search_url = f"https://www.google.com/maps/search/{encoded_query}?hl={self.lang}"
        
        self.log(f"Démarrage de la recherche : '{query}' (cible : {max_results} max)")
        
        async with async_playwright() as p:
            browser: Browser = await p.chromium.launch(
                headless=self.headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-infobars"
                ]
            )
            
            context: BrowserContext = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/130.0.0.0 Safari/537.36"
                ),
                locale=f"{self.lang}-{self.lang.upper()}",
                viewport={"width": 1280, "height": 900}
            )
            
            page: Page = await context.new_page()
            
            try:
                self.log(f"Chargement de Google Maps...")
                await page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(2000)
                
                # Gestion du consentement cookies
                await self._handle_cookie_consent(page)
                
                # Vérifier si la requête aboutit directement à une seule fiche d'entreprise
                if "/maps/place/" in page.url:
                    self.log(f"Une fiche directe unique a été trouvée pour '{query}'.")
                    initial_info = {
                        "name": query,
                        "category": "",
                        "phone": "",
                        "address": "",
                        "website": "",
                        "rating": "",
                        "reviews_count": "",
                        "latitude": "",
                        "longitude": "",
                        "maps_url": page.url,
                        "emails": [],
                        "primary_email": "",
                        "instagram": "",
                        "linkedin": "",
                        "facebook": "",
                        "twitter": ""
                    }
                    single_res = await self._extract_detail_from_url(context, page.url, initial_info)
                    results.append(single_res)
                    self.emit_item(single_res)
                    self.emit_progress(1, 1, "Extraction terminée")
                    await browser.close()
                    return results

                # Recherche du conteneur de flux (feed)
                try:
                    await page.wait_for_selector('div[role="feed"], div.Nv2PK', timeout=10000)
                except Exception:
                    self.log("Aucun résultat trouvé pour cette recherche sur Google Maps.", "warning")
                    await browser.close()
                    return results

                feed = page.locator('div[role="feed"]').first
                cards_locator = page.locator('div.Nv2PK')
                
                # 1ère phase : Défilement pour collecter jusqu'à max_results cartes
                self.log(f"Défilement de la liste des résultats...")
                cards_count = await cards_locator.count()
                consecutive_no_progress = 0
                
                while cards_count < max_results and consecutive_no_progress < 8:
                    if self.should_stop and self.should_stop():
                        self.log("Interruption demandée par l'utilisateur.", "warning")
                        break
                        
                    if await feed.count() > 0:
                        await feed.evaluate('(el) => el.scrollTop = el.scrollHeight')
                    else:
                        await page.mouse.wheel(0, 1000)
                        
                    await page.wait_for_timeout(int(self.polite_delay * 1000) + 500)
                    
                    new_count = await cards_locator.count()
                    if new_count == cards_count:
                        consecutive_no_progress += 1
                        await page.mouse.wheel(0, 800)
                        await page.wait_for_timeout(1000)
                    else:
                        consecutive_no_progress = 0
                        cards_count = new_count
                        self.log(f"{cards_count} établissements repérés...")
                        
                    # Détection fin de liste
                    end_text = page.locator('text="Vous êtes arrivé à la fin de la liste"')
                    if await end_text.count() > 0 and await end_text.is_visible():
                        self.log("Fin des résultats atteinte.")
                        break

                # 2ème phase : Récupération des URLs et métadonnées de base des cartes
                total_to_process = min(cards_count, max_results)
                self.log(f"Préparation de l'extraction détaillée pour {total_to_process} établissements...")
                
                cards_metadata: List[Dict[str, Any]] = []
                for idx in range(total_to_process):
                    if self.should_stop and self.should_stop():
                        break
                    card = cards_locator.nth(idx)
                    
                    # Nom
                    name_el = card.locator('div.qBF1Pd').first
                    name = (await name_el.inner_text()).strip() if await name_el.count() > 0 else f"Entreprise {idx+1}"
                    
                    # Lien de la fiche
                    link_el = card.locator('a.hfpxzc').first
                    href = await link_el.get_attribute("href") if await link_el.count() > 0 else ""
                    
                    # Note & avis préliminaires
                    rat_el = card.locator('span.MW4etd').first
                    rating = (await rat_el.inner_text()).strip() if await rat_el.count() > 0 else ""
                    
                    rev_el = card.locator('span.UY7F9').first
                    rev_text = (await rev_el.inner_text()).strip() if await rev_el.count() > 0 else ""
                    rev_count = re.sub(r'[^\d]', '', rev_text)
                    
                    cards_metadata.append({
                        "name": name,
                        "category": "",
                        "phone": "",
                        "address": "",
                        "website": "",
                        "rating": rating,
                        "reviews_count": rev_count,
                        "latitude": "",
                        "longitude": "",
                        "maps_url": href,
                        "emails": [],
                        "primary_email": "",
                        "instagram": "",
                        "linkedin": "",
                        "facebook": "",
                        "twitter": ""
                    })

                # 3ème phase : Extraction détaillée et enrichissement de chaque établissement
                for idx, item_info in enumerate(cards_metadata, start=1):
                    if self.should_stop and self.should_stop():
                        self.log("Scraping stoppé.", "warning")
                        break
                        
                    name = item_info["name"]
                    place_url = item_info["maps_url"]
                    
                    self.emit_progress(
                        current=idx,
                        total=len(cards_metadata),
                        message=f"Extraction ({idx}/{len(cards_metadata)}) : {name}"
                    )
                    
                    if place_url:
                        full_item = await self._extract_detail_from_url(context, place_url, item_info)
                    else:
                        full_item = item_info
                        
                    results.append(full_item)
                    self.emit_item(full_item)
                    
            except Exception as e:
                self.log(f"Erreur durant le scraping : {e}", "error")
            finally:
                await browser.close()
                
        self.emit_progress(len(results), max_results, f"Scraping achevé ({len(results)} entreprises collectées).")
        self.log(f"Scraping terminé avec succès ! Total : {len(results)} entreprises.", "success")
        return results

    async def scrape_multiple_queries(self, queries: List[str], max_results_per_query: int = 20) -> List[Dict[str, Any]]:
        """Scrape une liste séquentielle de requêtes (ex: batch par ville ou métier)."""
        all_results = []
        for q in queries:
            if self.should_stop and self.should_stop():
                break
            q_clean = q.strip()
            if not q_clean:
                continue
            batch_res = await self.scrape(q_clean, max_results=max_results_per_query)
            all_results.extend(batch_res)
        return all_results
