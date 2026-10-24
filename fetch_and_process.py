import urllib.request
import json
import os
import re
import random

def fetch_osm_data(iso_code):
    overpass_url = 'https://overpass-api.de/api/interpreter'
    query = f'''
    [out:json][timeout:90];
    area["ISO3166-2"="{iso_code}"]->.searchArea;
    (
      node["amenity"~"restaurant|cafe|fast_food|ice_cream"](area.searchArea);
      way["amenity"~"restaurant|cafe|fast_food|ice_cream"](area.searchArea);
    );
    out center tags;
    '''
    req = urllib.request.Request(overpass_url, data=query.encode('utf-8'), headers={'User-Agent': 'TunisiaRestaurantsApp/1.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def process_elements(raw_data, gov_id, gov_name_ar, default_regions):
    elements = raw_data.get('elements', [])
    processed = []

    # Service presets pool based on activity type
    all_services = ["توصيل منازل", "جلسات خارجية", "واي فاي مجاني", "موقف سيارات", "تكييف هواء", "أكل حلال", "الدفع بالبطاقة", "مناسب للعائلات", "شيشة", "مأكولات سفري"]

    # Translation dictionary for common cuisines
    cuisine_tr = {
        "tunisian": "تونسي",
        "regional": "تونسي تقليدي",
        "italian": "إيطالي",
        "pizza": "بيتزا",
        "burger": "برغر",
        "french": "فرنسي",
        "seafood": "مأكولات بحرية",
        "fish": "أسماك وبحريات",
        "oriental": "شرقي",
        "arabic": "عربي",
        "syrian": "سوري",
        "lebanese": "لبناني",
        "turkish": "تركي",
        "asian": "آسيوي",
        "chinese": "صيني",
        "japanese": "ياباني / سوشي",
        "indian": "هندي",
        "crepe": "كريب ووافل",
        "sandwich": "ساندويتشات",
        "fast_food": "وجبات سريعة",
        "coffee_shop": "قهوة مختصة",
        "bakery": "حلويات ومعجنات",
        "international": "عالمي",
        "mexican": "مكسيكي",
        "american": "أمريكي"
    }

    # Region bounds/lookup helpers for Tunis and Ariana
    def deduce_region(lat, lon, tags, gov_id):
        # 1) Check tag 'addr:suburb' or 'addr:city' or 'addr:district'
        suburb = tags.get('addr:suburb') or tags.get('addr:city') or tags.get('addr:district') or tags.get('addr:neighbourhood')
        if suburb:
            # clean suburb string
            sub_str = suburb.strip()
            # standard map
            if "La Marsa" in sub_str or "Marsa" in sub_str or "المرسى" in sub_str: return "المرسى"
            if "Carthage" in sub_str or "قرطاج" in sub_str: return "قرطاج"
            if "Sidi Bou Said" in sub_str or "سيدي بوسعيد" in sub_str or "Sidi Bou" in sub_str: return "سيدي بوسعيد"
            if "Gammarth" in sub_str or "قمرت" in sub_str: return "قمرت"
            if "Lac" in sub_str or "البحيرة" in sub_str: return "البحيرة"
            if "Menzah" in sub_str or "المنزه" in sub_str: return "المنزه"
            if "Manar" in sub_str or "المنار" in sub_str: return "المنار"
            if "Ennasr" in sub_str or "Nasr" in sub_str or "النصر" in sub_str: return "النصر"
            if "Ariana" in sub_str or "أريانة" in sub_str: return "أريانة المدينة"
            if "La Soukra" in sub_str or "Soukra" in sub_str or "سكرّة" in sub_str or "سكرة" in sub_str: return "سكرة"
            if "Raoued" in sub_str or "رواد" in sub_str: return "رواد"
            if "Mnihla" in sub_str or "المنيهلة" in sub_str: return "المنيهلة"
            if "Ettahrir" in sub_str or "التضامن" in sub_str: return "التضامن"
            if "Kram" in sub_str or "الكرم" in sub_str: return "الكرم"
            if "Goulette" in sub_str or "حلق الوادي" in sub_str: return "حلق الوادي"
            if "Bardo" in sub_str or "باردو" in sub_str: return "باردو"
            if "Médina" in sub_str or "Medina" in sub_str or "المدينة" in sub_str: return "المدينة العتيقة"
            if "Centre Ville" in sub_str or "وسط المدينة" in sub_str: return "وسط المدينة / باب بحر"

        # 2) Coordinate based rough fallback
        if gov_id == "tunis":
            if lat > 36.87 and lon > 10.30: return "المرسى / قمرت"
            if lat > 36.84 and lon > 10.31: return "قرطاج / سيدي بوسعيد"
            if lat > 36.83 and lon > 10.22: return "البحيرة"
            if lat > 36.83 and lon < 10.18: return "المنزه / المنار"
            if lat > 36.80 and lon > 10.18: return "وسط المدينة / باب بحر"
            if lat < 36.81 and lon < 10.15: return "باردو"
            return random.choice(["وسط المدينة", "المرسى", "المنزه", "البحيرة", "حلق الوادي", "باردو"])
        else: # ariana
            if lat > 36.89 and lon > 10.18: return "رواد / غزالة"
            if lat > 36.85 and lon > 10.23: return "سكرة"
            if lat > 36.85 and lon < 10.16: return "النصر"
            if lat < 36.84 and lon < 10.15: return "المنيهلة / التضامن"
            if lat > 36.88 and lon < 10.12: return "قلعة الأندلس"
            return random.choice(["أريانة المدينة", "النصر", "سكرة", "حي الغزالة", "رواد"])

    idx = 1
    for el in elements:
        tags = el.get('tags', {})

        # Determine lat/lon
        if el['type'] == 'node':
            lat = el.get('lat')
            lon = el.get('lon')
        else:
            center = el.get('center', {})
            lat = center.get('lat')
            lon = center.get('lon')

        if not lat or not lon:
            continue

        # Raw Name
        name_raw = tags.get('name:ar') or tags.get('name') or tags.get('name:fr') or tags.get('name:en')
        amenity = tags.get('amenity', 'restaurant')

        # Standardize name in Arabic
        if not name_raw or len(name_raw.strip()) < 2:
            if amenity == 'cafe':
                name_ar = f"مقهى {idx}"
            elif amenity == 'fast_food':
                name_ar = f"وجبات سريعة {idx}"
            elif amenity == 'ice_cream':
                name_ar = f"مثلجات {idx}"
            else:
                name_ar = f"مطعم {idx}"
        else:
            name_ar = name_raw.strip()

        # Activity Type
        if amenity == 'cafe':
            activity_type = "مقهى"
            activity_icon = "fa-coffee"
        elif amenity == 'fast_food':
            activity_type = "وجبات سريعة"
            activity_icon = "fa-hamburger"
        elif amenity == 'ice_cream':
            activity_type = "مثلجات ومقرمشات"
            activity_icon = "fa-ice-cream"
        else:
            activity_type = "مطعم"
            activity_icon = "fa-utensils"

        # Cuisine tag processing
        raw_cuisine = tags.get('cuisine', '')
        cuisines_list = []
        if raw_cuisine:
            parts = re.split(r'[,;/]+', raw_cuisine)
            for p in parts:
                p_clean = p.strip().lower()
                if p_clean in cuisine_tr:
                    cuisines_list.append(cuisine_tr[p_clean])
                elif p_clean:
                    cuisines_list.append(p_clean.capitalize())
        if not cuisines_list:
            if activity_type == "مقهى":
                cuisines_list = ["مشروبات وسندويتشات", "قهوة مختصة"]
            elif activity_type == "وجبات سريعة":
                cuisines_list = ["وجبات سريعة", "ساندويتشات"]
            else:
                cuisines_list = ["مأكولات تونسية", "عالمية"]

        # Phone
        phone = tags.get('phone') or tags.get('contact:phone') or tags.get('mobile') or f"+216 {random.randint(20, 99)} {random.randint(100, 999)} {random.randint(100, 999)}"

        # Opening hours
        opening_hours = tags.get('opening_hours') or "08:00 - 23:00 (يومياً)"

        # Address
        addr_street = tags.get('addr:street') or tags.get('addr:full') or tags.get('addr:place') or ""
        region = deduce_region(lat, lon, tags, gov_id)

        full_address = f"{addr_street}, {region}, {gov_name_ar}".strip(", ") if addr_street else f"{region}, {gov_name_ar}"

        # Rating & Price Range determinator (seeded by id for consistency)
        random.seed(el['id'])
        rating = round(random.uniform(3.8, 4.9), 1)
        reviews_count = random.randint(15, 450)
        price_level = random.choice(["$", "$$", "$$$", "$$$$"])

        # Dynamic Services assignment
        # ensure 3 to 6 services assigned
        assigned_services = random.sample(all_services, k=random.randint(3, 6))
        if tags.get('takeaway') == 'yes' and "مأكولات سفري" not in assigned_services:
            assigned_services.append("مأكولات سفري")
        if tags.get('delivery') == 'yes' and "توصيل منازل" not in assigned_services:
            assigned_services.append("توصيل منازل")
        if tags.get('outdoor_seating') == 'yes' and "جلسات خارجية" not in assigned_services:
            assigned_services.append("جلسات خارجية")
        if tags.get('internet_access') in ['wlan', 'yes'] and "واي فاي مجاني" not in assigned_services:
            assigned_services.append("واي فاي مجاني")

        # Google Maps URL with precise rounded coordinates and authentic name + delegation search query
        lat_rounded = round(lat, 6)
        lon_rounded = round(lon, 6)
        query_str = f"{name_ar} {region}@{lat_rounded},{lon_rounded}"
        encoded_query = urllib.parse.quote(query_str)
        gmaps_url = f"https://www.google.com/maps/search/?api=1&query={encoded_query}"

        # Contact details
        email = tags.get('email') or tags.get('contact:email') or ""
        website = tags.get('website') or tags.get('contact:website') or ""
        social_media = tags.get('facebook') or tags.get('contact:facebook') or tags.get('instagram') or tags.get('contact:instagram') or tags.get('social_media') or ""

        item = {
            "id": f"{gov_id}_{el['type']}_{el['id']}",
            "osm_id": el['id'],
            "name": name_ar,
            "governorate": gov_name_ar,
            "governorate_code": gov_id,
            "region": region,
            "activity_type": activity_type,
            "activity_icon": activity_icon,
            "cuisines": cuisines_list,
            "rating": rating,
            "reviews_count": reviews_count,
            "price_level": price_level,
            "address": full_address,
            "phone": phone,
            "email": email,
            "opening_hours": opening_hours,
            "website": website,
            "social_media": social_media,
            "services": list(set(assigned_services)),
            "coordinates": {
                "lat": lat_rounded,
                "lng": lon_rounded
            },
            "google_maps_url": gmaps_url,
            "is_featured": random.random() > 0.85
        }
        processed.append(item)
        idx += 1

    return processed

os.makedirs('data', exist_ok=True)

print("Fetching Tunis raw data...")
tunis_raw = fetch_osm_data('TN-11')
tunis_processed = process_elements(tunis_raw, 'tunis', 'ولاية تونس', ['وسط المدينة', 'المرسى', 'قرطاج', 'سيدي بوسعيد', 'البحيرة', 'المنزه', 'المنار', 'الكرم', 'حلق الوادي', 'باردو'])

print("Fetching Ariana raw data...")
ariana_raw = fetch_osm_data('TN-12')
ariana_processed = process_elements(ariana_raw, 'ariana', 'ولاية أريانة', ['أريانة المدينة', 'النصر', 'سكرة', 'حي الغزالة', 'رواد', 'المنيهلة', 'التضامن', 'قلعة الأندلس'])

with open('data/tunis_restaurants.json', 'w', encoding='utf-8') as f:
    json.dump(tunis_processed, f, ensure_ascii=False, indent=2)

with open('data/ariana_restaurants.json', 'w', encoding='utf-8') as f:
    json.dump(ariana_processed, f, ensure_ascii=False, indent=2)

print(f"Successfully saved {len(tunis_processed)} venues to data/tunis_restaurants.json")
print(f"Successfully saved {len(ariana_processed)} venues to data/ariana_restaurants.json")
