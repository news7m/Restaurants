#!/usr/bin/env python3
"""
Smart Data Enrichment & Geo-Grid Deduplicator inspired by google-maps-scraper-kit.
- Extract valid emails and social links (Facebook, Instagram) from venue websites using zero-API HTTP/Regex.
- Filters out framework/tracker emails (e.g., Sentry, Wix, example.com).
- Standardizes social_media, facebook, instagram, email, and contact info.
- Applies Haversine geo-distance & name similarity deduplication to merge duplicate listings.
"""

import json
import math
import re
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
FB_REGEX = re.compile(r'https?://(?:www\.)?facebook\.com/[A-Za-z0-9._%-]+', re.IGNORECASE)
IG_REGEX = re.compile(r'https?://(?:www\.)?instagram\.com/[A-Za-z0-9._%-]+', re.IGNORECASE)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

IGNORED_EMAIL_DOMAINS = [
    'sentry', 'wixpress', 'example.com', 'domain.com', 'schema.org',
    'sentry-next.wixpress.com', 'github.com', 'sentry.io', 'wordpress.org'
]

def is_valid_contact_email(email):
    """Check if email is a legitimate contact email and not an analytics tracker."""
    if not email:
        return False
    email_lower = email.lower()
    if any(domain in email_lower for domain in IGNORED_EMAIL_DOMAINS):
        return False
    if any(email_lower.endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css', '.tf']):
        return False
    return True

def fetch_url_content(url, timeout=4):
    """Fetch website HTML with short timeout to extract email and socials."""
    if not url or not url.startswith('http'):
        return ""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                content_type = response.headers.get('Content-Type', '')
                if 'text/html' in content_type.lower() or 'text/plain' in content_type.lower():
                    return response.read().decode('utf-8', errors='ignore')
    except Exception:
        pass
    return ""

def extract_details_from_html(html, website_url):
    """Extract emails, facebook, and instagram links from page HTML."""
    found_emails = set()
    found_fb = set()
    found_ig = set()

    if not html:
        return found_emails, found_fb, found_ig

    # Find emails
    raw_emails = EMAIL_REGEX.findall(html)
    for em in raw_emails:
        if is_valid_contact_email(em):
            found_emails.add(em.lower())

    # Find Facebook links
    raw_fb = FB_REGEX.findall(html)
    for fb in raw_fb:
        if not any(x in fb.lower() for x in ['/sharer', '/share.php', '/dialog/', '/plugins/', '/tr?']):
            found_fb.add(fb)

    # Find Instagram links
    raw_ig = IG_REGEX.findall(html)
    for ig in raw_ig:
        if not any(x in ig.lower() for x in ['/p/', '/reel/', '/stories/']):
            found_ig.add(ig)

    return found_emails, found_fb, found_ig

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lon points."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def normalize_name(name):
    """Normalize venue name for matching."""
    if not name:
        return ""
    name = name.lower()
    name = re.sub(r'[^\w\s]', '', name)
    return ' '.join(name.split())

def deduplicate_dataset(venues):
    """Deduplicate venues within dataset using Haversine distance and normalized name matching."""
    deduped = []
    seen = set()

    for venue in venues:
        norm_name = normalize_name(venue.get('name', ''))
        lat = venue.get('lat', 0.0)
        lon = venue.get('lon', 0.0)

        is_duplicate = False
        for existing in deduped:
            e_norm_name = normalize_name(existing.get('name', ''))
            e_lat = existing.get('lat', 0.0)
            e_lon = existing.get('lon', 0.0)

            dist = haversine_distance(lat, lon, e_lat, e_lon) if (lat and e_lat) else 999999

            # Match if names are identical and distance < 100 meters OR distance < 15 meters
            if (norm_name and norm_name == e_norm_name and dist < 100) or (dist < 15 and norm_name and e_norm_name and norm_name in e_norm_name):
                # Merge details into existing record
                if not existing.get('email') and venue.get('email'):
                    existing['email'] = venue['email']
                if not existing.get('phone') and venue.get('phone'):
                    existing['phone'] = venue['phone']
                if not existing.get('facebook') and venue.get('facebook'):
                    existing['facebook'] = venue['facebook']
                if not existing.get('instagram') and venue.get('instagram'):
                    existing['instagram'] = venue['instagram']
                if not existing.get('website') and venue.get('website'):
                    existing['website'] = venue['website']
                if not existing.get('social_media') and venue.get('social_media'):
                    existing['social_media'] = venue['social_media']
                is_duplicate = True
                break

        if not is_duplicate:
            deduped.append(venue)

    return deduped

def process_venue(venue):
    """Process single venue: shift social websites, clean invalid emails, parse page if website exists."""
    updated = False

    # Clean existing invalid emails
    if venue.get('email') and not is_valid_contact_email(venue['email']):
        venue['email'] = ''
        updated = True

    website = venue.get('website', '').strip()
    social = venue.get('social_media', '').strip()
    email = venue.get('email', '').strip()
    fb = venue.get('facebook', '').strip()
    ig = venue.get('instagram', '').strip()

    # Shift website to social if it's Facebook or Instagram
    if website and ('facebook.com' in website or 'instagram.com' in website):
        if not social:
            venue['social_media'] = website
            social = website
        if 'facebook.com' in website and not fb:
            venue['facebook'] = website
            fb = website
        elif 'instagram.com' in website and not ig:
            venue['instagram'] = website
            ig = website
        venue['website'] = ''
        website = ''
        updated = True

    # If social_media contains FB or IG, set dedicated fields
    if social:
        if 'facebook.com' in social and not fb:
            venue['facebook'] = social
            fb = social
            updated = True
        elif 'instagram.com' in social and not ig:
            venue['instagram'] = social
            ig = social
            updated = True

    # If valid website exists, crawl website for emails and social links
    if website and website.startswith('http'):
        html = fetch_url_content(website)
        if html:
            emails, fbs, igs = extract_details_from_html(html, website)
            if emails and not email:
                valid_emails = [e for e in emails if is_valid_contact_email(e)]
                if valid_emails:
                    venue['email'] = sorted(valid_emails)[0]
                    updated = True
            if fbs and not fb:
                venue['facebook'] = sorted(list(fbs))[0]
                if not venue.get('social_media'):
                    venue['social_media'] = venue['facebook']
                updated = True
            if igs and not ig:
                venue['instagram'] = sorted(list(igs))[0]
                if not venue.get('social_media'):
                    venue['social_media'] = venue['instagram']
                updated = True

    return venue, updated

def enrich_file(file_path):
    print(f"--- Processing {file_path} ---")
    with open(file_path, 'r', encoding='utf-8') as f:
        venues = json.load(f)

    updated_total = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_idx = {executor.submit(process_venue, v): i for i, v in enumerate(venues)}
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            res_venue, was_updated = future.result()
            venues[idx] = res_venue
            if was_updated:
                updated_total += 1

    # Perform Haversine & Name deduplication
    original_count = len(venues)
    venues = deduplicate_dataset(venues)
    deduped_count = original_count - len(venues)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(venues, f, ensure_ascii=False, indent=2)

    print(f"Finished {file_path}: Total {len(venues)} venues (deduped {deduped_count}), enriched {updated_total} entries.")

if __name__ == '__main__':
    enrich_file('restaurants.json')
    enrich_file('tunis_restaurants.json')
