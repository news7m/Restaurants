#!/usr/bin/env python3
import json
import os
import glob
import urllib.parse

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

        name = (item.get('name') or '').strip()
        delegation = (item.get('delegation') or item.get('region') or '').strip()

        coords = item.get('coordinates', {})
        lat = item.get('lat') if item.get('lat') is not None else coords.get('lat')
        lon = item.get('lon') if item.get('lon') is not None else coords.get('lng')

        if lat is None or lon is None:
            continue

        lat_rounded = round(float(lat), 6)
        lon_rounded = round(float(lon), 6)

        if delegation:
            query_str = f"{name} {delegation}@{lat_rounded},{lon_rounded}"
        else:
            query_str = f"{name}@{lat_rounded},{lon_rounded}"

        encoded_query = urllib.parse.quote(query_str)
        new_gmaps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_query}"

        if item.get('google_maps_url') != new_gmaps_url:
            item['google_maps_url'] = new_gmaps_url
            updated_count += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Updated {updated_count} entries in {file_path}")

def main():
    target_files = ['restaurants.json', 'tunis_restaurants.json']
    target_files.extend(glob.glob('data/*.json'))

    for filepath in sorted(set(target_files)):
        if filepath == 'data/governorates_meta.json':
            continue
        process_json_file(filepath)

if __name__ == '__main__':
    main()
