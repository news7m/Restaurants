#!/usr/bin/env python3
"""
Smart Google Maps URL Standardizer
Updates google_maps_url across all datasets (restaurants.json, tunis_restaurants.json, data/*.json)
to incorporate the authentic real venue name + delegation + coordinates for pinpoint Google Maps card accuracy.
"""

import json
import glob
import os
import urllib.parse

def generate_smart_gmaps_url(name, delegation, governorate, lat, lon):
    clean_name = name.strip()
    clean_delg = delegation.strip() if delegation else ""

    # Construct query string with authentic name, delegation, and coordinates @lat,lon
    query_text = f"{clean_name} {clean_delg}".strip()
    encoded_query = urllib.parse.quote(query_text)

    return f"https://www.google.com/maps/search/?api=1&query={encoded_query}@{lat},{lon}"

def process_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        venues = json.load(f)

    updated_count = 0
    for v in venues:
        name = v.get('name', '')
        delg = v.get('delegation', '')
        gov = v.get('governorate', '')
        lat = v.get('lat', 0.0)
        lon = v.get('lon', 0.0)

        if name and lat and lon:
            v['google_maps_url'] = generate_smart_gmaps_url(name, delg, gov, lat, lon)
            updated_count += 1

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(venues, f, ensure_ascii=False, indent=2)

    print(f"Updated {filepath}: {updated_count} URLs standardized.")

def main():
    files = ['restaurants.json', 'tunis_restaurants.json'] + glob.glob('data/*.json')
    for f in files:
        if 'meta' in f: continue
        process_file(f)

if __name__ == '__main__':
    main()
