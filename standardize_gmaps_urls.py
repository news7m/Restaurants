#!/usr/bin/env python3
import json
import os
import glob
import re
import urllib.parse

def clean_query_text(text):
    if not text:
        return ""
    # Strip parenthetical text e.g. (hamrouni), (سكرة, ولاية أريانة), (حي النصر / المنزه)
    cleaned = re.sub(r'\s*\([^)]*\)', '', text)
    # Strip double and single quotes
    cleaned = cleaned.replace('"', '').replace("'", '')
    return cleaned.strip()

def clean_display_name(name):
    if not name:
        return "مطعم / مقهى"
    cleaned = clean_query_text(name)
    # Handle generic OSM fallback names like "مقهى" or "وجبات"
    if cleaned.lower() in ["مقهى", "مطعم", "وجبات", "وجبات سريعة", "مثلجات", "cafe", "restaurant"]:
        return cleaned
    if not cleaned or len(cleaned) < 2:
        return "مطعم / مقهى"
    return cleaned

def build_gmaps_url(name, delegation, lat, lon):
    c_name = clean_query_text(name)
    c_delg = clean_query_text(delegation)

    lat_rounded = round(float(lat), 6)
    lon_rounded = round(float(lon), 6)

    if c_delg:
        query_str = f"{c_name} {c_delg}@{lat_rounded},{lon_rounded}"
    else:
        query_str = f"{c_name}@{lat_rounded},{lon_rounded}"

    encoded_query = urllib.parse.quote(query_str.strip())
    return f"https://www.google.com/maps/search/?api=1&query={encoded_query}"

def process_json_file(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list):
        print(f"Skipping {file_path}: root element is not a list")
        return

    updated_count = 0
    for item in data:
        if not isinstance(item, dict):
            continue

        orig_name = (item.get('name') or '').strip()
        cleaned_name = clean_display_name(orig_name)
        if orig_name != cleaned_name:
            item['name'] = cleaned_name
            updated_count += 1

        delegation = (item.get('delegation') or item.get('region') or '').strip()

        coords = item.get('coordinates', {})
        lat = item.get('lat') if item.get('lat') is not None else coords.get('lat')
        lon = item.get('lon') if item.get('lon') is not None else coords.get('lng')

        if lat is None or lon is None:
            continue

        new_gmaps_url = build_gmaps_url(cleaned_name, delegation, lat, lon)

        if item.get('google_maps_url') != new_gmaps_url:
            item['google_maps_url'] = new_gmaps_url
            updated_count += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Processed {file_path}: {updated_count} updates made")

def main():
    target_files = ['restaurants.json', 'tunis_restaurants.json']
    target_files.extend(glob.glob('data/*.json'))

    for filepath in sorted(set(target_files)):
        if filepath == 'data/governorates_meta.json':
            continue
        process_json_file(filepath)

if __name__ == '__main__':
    main()
