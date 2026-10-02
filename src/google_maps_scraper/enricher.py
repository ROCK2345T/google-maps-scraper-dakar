"""
Module d'enrichissement de données d'entreprises.
Visite le site web officiel pour extraire :
- Adresses email de contact
- Profils sur les réseaux sociaux (LinkedIn, Instagram, Facebook, Twitter/X, YouTube, TikTok)
"""

import asyncio
import re
import urllib.parse
from typing import Dict, List, Set, Any
import httpx
from bs4 import BeautifulSoup

# Regex standard pour la détection d'adresses email
EMAIL_REGEX = re.compile(
    r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+',
    re.IGNORECASE
)

# Extensions et patterns de faux positifs à exclure
IGNORED_EXTENSIONS = (
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.pdf'
)

IGNORED_EMAIL_DOMAINS = (
    'example.com', 'domain.com', 'yourdomain.com', 'sentry.io',
    'wixpress.com', 'cloudflare.com', 'schema.org', 'w3.org',
    'googleapis.com', 'gravatar.com', 'wordpress.org', 'github.com'
)

# Sous-pages fréquentes contenant les coordonnées de contact
CONTACT_KEYWORDS = [
    'contact', 'nous-contacter', 'contact-us', 'contactez-nous',
    'mentions-legales', 'legal', 'mentions', 'a-propos', 'about',
    'qui-sommes-nous', 'coordonnees', 'infos'
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
}

def clean_email(email: str) -> str:
    """Nettoie et normalise une adresse email."""
    if not email:
        return ""
    email = email.strip().lower()
    email = email.rstrip('.,;:!?/\'"')
    email = email.lstrip('.,;:!?/\'"')
    return email

def is_valid_email(email: str) -> bool:
    """Vérifie si une adresse email est syntaxiquement et sémantiquement plausible."""
    if not email or '@' not in email:
        return False
    
    parts = email.split('@')
    if len(parts) != 2:
        return False
    
    user, domain = parts
    if not user or not domain or '.' not in domain:
        return False
        
    tld = domain.split('.')[-1]
    if len(tld) < 2 or not tld.isalpha():
        return False
        
    if any(email.endswith(ext) for ext in IGNORED_EXTENSIONS):
        return False
        
    for bad_domain in IGNORED_EMAIL_DOMAINS:
        if bad_domain in domain:
            return False
            
    return True

def extract_socials_from_soup(soup: BeautifulSoup, socials: Dict[str, str]) -> None:
    """Extrait les liens de réseaux sociaux depuis un objet BeautifulSoup."""
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        href_lower = href.lower()
        
        # Facebook
        if 'facebook.com/' in href_lower and not socials["facebook"]:
            if not any(k in href_lower for k in ['sharer', 'dialog', 'plugins', 'tr?id', 'share.php']):
                socials["facebook"] = href
                
        # Instagram
        elif 'instagram.com/' in href_lower and not socials["instagram"]:
            if not any(k in href_lower for k in ['/p/', '/reel/', '/stories/', 'share']):
                socials["instagram"] = href
                
        # LinkedIn
        elif 'linkedin.com/' in href_lower and not socials["linkedin"]:
            if not any(k in href_lower for k in ['sharing', 'shareArticle', 'mini=true']):
                socials["linkedin"] = href
                
        # Twitter / X
        elif ('twitter.com/' in href_lower or 'x.com/' in href_lower) and not socials["twitter"]:
            if not any(k in href_lower for k in ['intent/tweet', 'share?']):
                socials["twitter"] = href
                
        # YouTube
        elif 'youtube.com/' in href_lower and not socials["youtube"]:
            if not any(k in href_lower for k in ['/watch?', '/embed/']):
                socials["youtube"] = href
                
        # TikTok
        elif 'tiktok.com/' in href_lower and not socials["tiktok"]:
            socials["tiktok"] = href

async def enrich_website(website_url: str, timeout: float = 7.0) -> Dict[str, Any]:
    """
    Explore le site web cible pour collecter les emails et réseaux sociaux.
    
    Retourne:
        dict contenant:
        - emails: list[str]
        - primary_email: str
        - facebook: str
        - instagram: str
        - linkedin: str
        - twitter: str
        - youtube: str
        - tiktok: str
    """
    res: Dict[str, Any] = {
        "emails": [],
        "primary_email": "",
        "facebook": "",
        "instagram": "",
        "linkedin": "",
        "twitter": "",
        "youtube": "",
        "tiktok": ""
    }
    
    if not website_url or not isinstance(website_url, str):
        return res
        
    website_url = website_url.strip()
    if not website_url.startswith(("http://", "https://")):
        website_url = "https://" + website_url

    parsed_url = urllib.parse.urlparse(website_url)
    if not parsed_url.netloc:
        return res
        
    base_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
    found_emails: Set[str] = set()
    subpages_to_crawl: List[str] = []
    visited_urls: Set[str] = set()

    # Priorité aux pages d'accueil et d'origine
    initial_queue = [website_url]
    if base_domain != website_url and base_domain + "/" != website_url:
        initial_queue.append(base_domain)

    async with httpx.AsyncClient(
        headers=HEADERS,
        timeout=httpx.Timeout(5.0, connect=3.0),
        follow_redirects=True,
        verify=False
    ) as client:
        
        # 1ère étape : Analyse des pages d'accueil / initiales
        for current_url in initial_queue:
            if current_url in visited_urls:
                continue
            visited_urls.add(current_url)
            
            try:
                resp = await client.get(current_url)
                if resp.status_code >= 400:
                    continue
                    
                content_type = resp.headers.get("content-type", "")
                if "text/html" not in content_type and "application/xhtml" not in content_type:
                    continue
                    
                html = resp.text
                soup = BeautifulSoup(html, 'html.parser')
                
                # Extraction des liens mailto:
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    if href.lower().startswith('mailto:'):
                        raw_email = href.split(':', 1)[1].split('?')[0]
                        candidate = clean_email(raw_email)
                        if is_valid_email(candidate):
                            found_emails.add(candidate)
                            
                    # Détection sous-pages de contact / mentions légales
                    href_clean = href.strip()
                    href_lower = href_clean.lower()
                    text_lower = (a.get_text() or "").strip().lower()
                    
                    if len(subpages_to_crawl) < 4:
                        if any(kw in href_lower or kw in text_lower for kw in CONTACT_KEYWORDS):
                            full_link = urllib.parse.urljoin(current_url, href_clean)
                            parsed_link = urllib.parse.urlparse(full_link)
                            if parsed_link.netloc == parsed_url.netloc and full_link not in visited_urls and full_link not in subpages_to_crawl:
                                subpages_to_crawl.append(full_link)
                                
                # Extraction réseaux sociaux
                extract_socials_from_soup(soup, res)
                
                # Recherche d'emails dans le texte brut
                for match in EMAIL_REGEX.findall(html):
                    candidate = clean_email(match)
                    if is_valid_email(candidate):
                        found_emails.add(candidate)
                        
            except Exception:
                pass

        # 2ème étape : Si aucun email n'a été trouvé, exploration des sous-pages (contact, mentions)
        if not found_emails and subpages_to_crawl:
            for sub_url in subpages_to_crawl[:2]:
                if sub_url in visited_urls:
                    continue
                visited_urls.add(sub_url)
                
                try:
                    resp = await client.get(sub_url)
                    if resp.status_code < 400:
                        soup = BeautifulSoup(resp.text, 'html.parser')
                        for a in soup.find_all('a', href=True):
                            href = a['href']
                            if href.lower().startswith('mailto:'):
                                raw_email = href.split(':', 1)[1].split('?')[0]
                                candidate = clean_email(raw_email)
                                if is_valid_email(candidate):
                                    found_emails.add(candidate)
                                    
                        extract_socials_from_soup(soup, res)
                        
                        for match in EMAIL_REGEX.findall(resp.text):
                            candidate = clean_email(match)
                            if is_valid_email(candidate):
                                found_emails.add(candidate)
                except Exception:
                    pass

    sorted_emails = sorted(list(found_emails))
    # Préférer contact@, info@, hello@, etc. en tant que primary_email
    preferred_prefixes = ('contact@', 'info@', 'hello@', 'bonjour@', 'accueil@', 'secretariat@')
    primary = ""
    for email in sorted_emails:
        if any(email.startswith(p) for p in preferred_prefixes):
            primary = email
            break
    if not primary and sorted_emails:
        primary = sorted_emails[0]
        
    res["emails"] = sorted_emails
    res["primary_email"] = primary
    return res

def enrich_website_sync(website_url: str, timeout: float = 7.0) -> Dict[str, Any]:
    """Version synchrone utilitaire pour appel simple."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, enrich_website(website_url, timeout)).result()
        else:
            return loop.run_until_complete(enrich_website(website_url, timeout))
    except Exception:
        return asyncio.run(enrich_website(website_url, timeout))
