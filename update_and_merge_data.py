import json
import os

def clean_item(item, default_gov):
    coords = item.get('coordinates', {})
    lat = coords.get('lat') if coords.get('lat') is not None else item.get('lat')
    lon = coords.get('lng') if coords.get('lng') is not None else item.get('lon')

    act = item.get('activity_type', '')
    category = item.get('category', '')

    if 'مقهى' in act or 'كافيه' in act or 'مقهى' in category:
        cat = 'مقهى وكافيه (Café & Lounge)'
        icon = '☕'
    elif 'سريعة' in act or 'وجبات' in act or 'سريعة' in category:
        cat = 'وجبات سريعة (Fast Food)'
        icon = '🍔'
    elif 'بيتزا' in act or 'بيتزا' in category:
        cat = 'مطعم بيتزا (Pizzeria)'
        icon = '🍕'
    elif 'حلويات' in act or 'مخبوزات' in act or 'مثلجات' in act or 'حلويات' in category:
        cat = 'حلويات ومخبوزات (Bakery & Sweets)'
        icon = '🍰'
    else:
        cat = item.get('category') or 'مطعم عام (Restaurant)'
        icon = item.get('icon') or '🍽️'

    cuisines = item.get('cuisines') or item.get('cuisine') or []
    if isinstance(cuisines, list):
        cuisine_str = '، '.join(cuisines) if cuisines else 'تونسية وعالمية'
    else:
        cuisine_str = str(cuisines)

    services = item.get('services') or []
    if not isinstance(services, list):
        services = []

    delivery = any('توصيل' in str(s) for s in services) or bool(item.get('delivery_available', False))
    outdoor = any('خارجي' in str(s) or 'جلسات' in str(s) for s in services) or bool(item.get('outdoor_seating', False))

    gov = item.get('governorate') or default_gov
    if 'أريانة' in gov or item.get('governorate_code') == 'ariana':
        gov = 'ولاية أريانة'
    else:
        gov = 'ولاية تونس'

    price_lvl = item.get('price_level', '$$')
    if price_lvl not in ['$', '$$', '$$$']:
        price_lvl = '$$'

    delg = item.get('region') or item.get('delegation') or 'عام'

    lat_val = round(float(lat), 6) if lat else 0.0
    lon_val = round(float(lon), 6) if lon else 0.0

    gmaps_url = f'https://www.google.com/maps/search/?api=1&query={lat_val},{lon_val}'

    return {
        'id': item.get('id'),
        'governorate': gov,
        'name': item.get('name', 'غير مسمى').strip(),
        'category': cat,
        'icon': icon,
        'delegation': delg.strip(),
        'address': item.get('address') or f'{delg}, {gov}',
        'street': item.get('street') or item.get('address') or '',
        'lat': lat_val,
        'lon': lon_val,
        'rating': round(float(item.get('rating') or 4.0), 1),
        'reviews_count': int(item.get('reviews_count') or 10),
        'price_level': price_lvl,
        'cuisine': cuisine_str,
        'phone': item.get('phone') or '',
        'email': item.get('email', ''),
        'opening_hours': item.get('opening_hours') or '08:00 - 23:00 (يومياً)',
        'google_maps_url': gmaps_url,
        'delivery_available': delivery,
        'outdoor_seating': outdoor,
        'website': item.get('website', ''),
        'social_media': item.get('social_media', ''),
        'services': services,
        'is_featured': bool(item.get('is_featured', False))
    }

def process_file(our_path, alk_path, default_gov):
    with open(our_path, 'r', encoding='utf-8') as f:
        our_data = json.load(f)

    alk_data = []
    if os.path.exists(alk_path):
        with open(alk_path, 'r', encoding='utf-8') as f:
            alk_data = json.load(f)

    seen = set()
    merged = []

    # Preserve our existing data first
    for item in our_data:
        cleaned = clean_item(item, default_gov)
        key = (cleaned['name'].lower(), round(cleaned['lat'], 4), round(cleaned['lon'], 4))
        seen.add(key)
        merged.append(cleaned)

    # Add missing entries from alk dataset
    added_count = 0
    for item in alk_data:
        cleaned = clean_item(item, default_gov)
        key = (cleaned['name'].lower(), round(cleaned['lat'], 4), round(cleaned['lon'], 4))
        if key not in seen and cleaned['lat'] != 0.0:
            seen.add(key)
            merged.append(cleaned)
            added_count += 1

    # Re-assign sequential integer numeric IDs for uniformity where applicable or keep string IDs
    for idx, item in enumerate(merged, start=1):
        if not item['id']:
            item['id'] = idx

    print(f"[{default_gov}] Original count: {len(our_data)}, Added: {added_count}, Total merged: {len(merged)}")

    with open(our_path, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    process_file('restaurants.json', '/tmp/alkandeeltn-restaurants/data/ariana_restaurants.json', 'ولاية أريانة')
    process_file('tunis_restaurants.json', '/tmp/alkandeeltn-restaurants/data/tunis_restaurants.json', 'ولاية تونس')
