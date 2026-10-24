#!/usr/bin/env python3
"""
Sanitizes all dataset JSON files in the project.
Filters out any venue entries that are not restaurants/cafes/bakeries/fast food places.
"""

import json
import glob
import os
from clean_dataset_utils import is_valid_restaurant_venue

def sanitize_file(filepath):
    if not os.path.exists(filepath):
        return 0, 0

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            return 0, 0

        initial_count = len(data)
        cleaned_data = [item for item in data if is_valid_restaurant_venue(item)]
        removed_count = initial_count - len(cleaned_data)

        if removed_count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
            print(f"[{filepath}] Cleaned {removed_count} invalid items. ({initial_count} -> {len(cleaned_data)})")

        return initial_count, len(cleaned_data)
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return 0, 0

def main():
    target_files = ['restaurants.json', 'tunis_restaurants.json'] + glob.glob('data/*.json')
    total_before = 0
    total_after = 0

    for filepath in target_files:
        if 'governorates_meta' in filepath:
            continue
        before, after = sanitize_file(filepath)
        total_before += before
        total_after += after

    print(f"\nSanitization complete! Total items before: {total_before}, after: {total_after}, removed: {total_before - total_after}")

if __name__ == '__main__':
    main()
