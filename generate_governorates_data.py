#!/usr/bin/env python3
"""
Generate and update data for all 24 Governorates of Tunisia.
Combines existing Ariana & Tunis data with generated datasets for the remaining 22 governorates.
"""

import json
import os
import random

TUNISIA_GOVERNORATES = {
    "ariana": {
        "name_ar": "ولاية أريانة",
        "file": "restaurants.json",
        "delegations": ["أريانة المدينة", "النصر", "سكرة", "رواد", "حي الغزالة", "المنيهلة", "التضامن", "قلعة الأندلس"]
    },
    "tunis": {
        "name_ar": "ولاية تونس",
        "file": "tunis_restaurants.json",
        "delegations": ["وسط المدينة / باب بحر", "المرسى", "قرطاج", "سيدي بوسعيد", "البحيرة", "المنزه", "المنار", "حلق الوادي", "الكرم", "باردو", "باب سويقة", "الخضراء", "العمران", "سيدي حسين"]
    },
    "ben_arous": {
        "name_ar": "ولاية بن عروس",
        "file": "ben_arous_restaurants.json",
        "delegations": ["بن عروس", "رادس", "حمام الأنف", "الزهراء", "مقرين", "المروج", "فوشانة", "محمدية", "بومهل", "مرناق"],
        "center": (36.7531, 10.2222)
    },
    "manouba": {
        "name_ar": "ولاية منوبة",
        "file": "manouba_restaurants.json",
        "delegations": ["منوبة", "دوار هيشر", "وادي الليل", "طبربة", "الجديدة", "المورناقية", "بطان", "برج العامري"],
        "center": (36.8081, 10.0972)
    },
    "nabeul": {
        "name_ar": "ولاية نابل",
        "file": "nabeul_restaurants.json",
        "delegations": ["نابل", "الحمامات", "قليبية", "منزل تميم", "قرمبالية", "سليمان", "دار شعبان الفهري", "بني خيار", "قربة", "الهوارية"],
        "center": (36.4561, 10.7376)
    },
    "zaghouan": {
        "name_ar": "ولاية زغوان",
        "file": "zaghouan_restaurants.json",
        "delegations": ["زغوان", "الفحص", "بئر مشارقة", "الناظور", "الزريبة", "صواف"],
        "center": (36.4029, 10.1429)
    },
    "bizerte": {
        "name_ar": "ولاية بنزرت",
        "file": "bizerte_restaurants.json",
        "delegations": ["بنزرت الشمالية", "بنزرت الجنوبية", "منزل بورقيبة", "راس الجبل", "ماطر", "جرزونة", "العالية", "غار الملح", "سجنان"],
        "center": (37.2744, 9.8739)
    },
    "beja": {
        "name_ar": "ولاية باجة",
        "file": "beja_restaurants.json",
        "delegations": ["باجة الشمالية", "باجة الجنوبية", "مجاز الباب", "تستور", "تيبار", "عمدون", "قبلاط", "نفزة"],
        "center": (36.7256, 9.1817)
    },
    "jendouba": {
        "name_ar": "ولاية جندوبة",
        "file": "jendouba_restaurants.json",
        "delegations": ["جندوبة", "جندوبة الشمالية", "طبرقة", "عين دراهم", "فرنانة", "غار الدماء", "بوسالم"],
        "center": (36.5011, 8.7803)
    },
    "le_kef": {
        "name_ar": "ولاية الكاف",
        "file": "le_kef_restaurants.json",
        "delegations": ["الكاف الشرقية", "الكاف الغربية", "الدهماني", "تاجروين", "قلعة سنان", "ساقية سيدي يوسف", "نبر", "السرس"],
        "center": (36.1822, 8.7148)
    },
    "siliana": {
        "name_ar": "ولاية سليانة",
        "file": "siliana_restaurants.json",
        "delegations": ["سليانة الشمالية", "سليانة الجنوبية", "قعفور", "مكثر", "بوعرادة", "الكريب", "برقو", "الروحية"],
        "center": (36.0849, 9.3708)
    },
    "sousse": {
        "name_ar": "ولاية سوسة",
        "file": "sousse_restaurants.json",
        "delegations": ["سوسة المدينة", "حمام سوسة", "سهلول", "أكودة", "القنطاوي", "مساكن", "القلعة الكبرى", "القلعة الصغرى", "النفيضة", "بوفيشة", "سيدي بوعلي"],
        "center": (35.8256, 10.6411)
    },
    "monastir": {
        "name_ar": "ولاية المنستير",
        "file": "monastir_restaurants.json",
        "delegations": ["المنستير", "المكنين", "قصر هلال", "جمال", "طبلبة", "البقالطة", "الوردانين", "الساحلين", "زرمدين", "بنبلة"],
        "center": (35.7833, 10.8333)
    },
    "mahdia": {
        "name_ar": "ولاية المهدية",
        "file": "mahdia_restaurants.json",
        "delegations": ["المهدية", "قصور الساف", "الشابة", "الجم", "بومرداس", "شربان", "سيدي علوان", "ملولش"],
        "center": (35.5047, 11.0622)
    },
    "sfax": {
        "name_ar": "ولاية صفاقس",
        "file": "sfax_restaurants.json",
        "delegations": ["صفاقس المدينة", "صفاقس الجنوبية", "صفاقس الغربية", "ساقية الزيت", "ساقية الداير", "طينة", "عقارب", "المحرس", "قرقنة", "جبنيانة"],
        "center": (34.7406, 10.7603)
    },
    "kairouan": {
        "name_ar": "ولاية القيروان",
        "file": "kairouan_restaurants.json",
        "delegations": ["القيروان الشمالية", "القيروان الجنوبية", "بوحجلة", "السبيخة", "حفوز", "وسلاتية", "نصر الله", "شبيكة", "الشاردة"],
        "center": (35.6781, 10.0963)
    },
    "kasserine": {
        "name_ar": "ولاية القصرين",
        "file": "kasserine_restaurants.json",
        "delegations": ["القصرين الشمالية", "القصرين الجنوبية", "سبيطلة", "فريانة", "سبيبة", "تالة", "حيدرة", "ماجل بلعباس"],
        "center": (35.1676, 8.8365)
    },
    "sidi_bouzid": {
        "name_ar": "ولاية سيدي بوزيد",
        "file": "sidi_bouzid_restaurants.json",
        "delegations": ["سيدي بوزيد الشرقية", "سيدي بوزيد الغربية", "المكناسي", "الرقاب", "جلمة", "بئر الحفي", "سيدي علي بن عون", "أولاد حفوز"],
        "center": (35.0382, 9.4849)
    },
    "gabes": {
        "name_ar": "ولاية قابس",
        "file": "gabes_restaurants.json",
        "delegations": ["قابس المدينة", "قابس الجنوبية", "قابس الغربية", "الحامة", "مارث", "مطماطة", "مطماطة الجديدة", "غنوش"],
        "center": (33.8815, 10.0982)
    },
    "medenine": {
        "name_ar": "ولاية مدنين",
        "file": "medenine_restaurants.json",
        "delegations": ["جربة حومة السوق", "جربة ميدون", "جربة أجييم", "مدنين الشمالية", "مدنين الجنوبية", "جرجيس", "بن قردان", "بني خداش"],
        "center": (33.3549, 10.5055)
    },
    "tataouine": {
        "name_ar": "ولاية تطاوين",
        "file": "tataouine_restaurants.json",
        "delegations": ["تطاوين الشمالية", "تطاوين الجنوبية", "غمراسن", "الرمادة", "ذهيبة", "الصمار"],
        "center": (32.9297, 10.4518)
    },
    "gafsa": {
        "name_ar": "ولاية قفصة",
        "file": "gafsa_restaurants.json",
        "delegations": ["قفصة الشمالية", "قفصة الجنوبية", "المتلوي", "الرديف", "أم العرايس", "السناد", "الشبيكة", "القطار"],
        "center": (34.4250, 8.7842)
    },
    "tozeur": {
        "name_ar": "ولاية توزر",
        "file": "tozeur_restaurants.json",
        "delegations": ["توزر", "نفطة", "دقاش", "تمغزة", "حزوة"],
        "center": (33.9197, 8.1336)
    },
    "kebili": {
        "name_ar": "ولاية قبلي",
        "file": "kebili_restaurants.json",
        "delegations": ["قبلي الشمالية", "قبلي الجنوبية", "دوز الشمالية", "دوز الجنوبية", "سوق الأحد", "الفوار"],
        "center": (33.7044, 8.9692)
    }
}

CATEGORIES = [
    ("مطعم عام (Restaurant)", "🍽️", "مأكولات تونسية وعالمية"),
    ("مقهى وكافيه (Café & Lounge)", "☕", "قهوة مختصة ومشروبات"),
    ("وجبات سريعة (Fast Food)", "🍔", "ساندويتشات ووجبات سريعة"),
    ("مطعم بيتزا (Pizzeria)", "🍕", "بيتزا ومأكولات إيطالية"),
    ("حلويات ومخبوزات (Bakery & Sweets)", "🍰", "حلويات تونسية ومخبوزات")
]

PREFIXES = {
    "مطعم عام (Restaurant)": ["مطعم", "شواية", "مأكولات", "Restaurant"],
    "مقهى وكافيه (Café & Lounge)": ["مقهى", "كافيه", "Café", "Lounge"],
    "وجبات سريعة (Fast Food)": ["وجبات سريعة", "ساندويتش", "Fast Food", "Burger"],
    "مطعم بيتزا (Pizzeria)": ["بيتزا", "Pizzeria", "Pizza"],
    "حلويات ومخبوزات (Bakery & Sweets)": ["حلويات", "مخبزة", "Pâtisserie", "Bakery"]
}

NAME_POOL = [
    "البركة", "الوفاء", "الجميل", "السعادة", "الياسمين", "الضيافة", "الأندلس",
    "الشاطئ", "المدينة", "النخيل", "الأحلام", "الأنيق", "الذهبي", "النسيم",
    "الشرق", "الضفاف", "الشلال", "الأطلس", "الأصالة", "الهناء"
]

def generate_governorate_dataset(gov_key, gov_info, count=45):
    random.seed(hash(gov_key))
    gov_name = gov_info["name_ar"]
    delegations = gov_info["delegations"]
    center_lat, center_lon = gov_info["center"]

    venues = []
    for i in range(1, count + 1):
        cat_name, icon, default_cuisine = random.choice(CATEGORIES)
        prefix = random.choice(PREFIXES[cat_name])
        suffix = random.choice(NAME_POOL)
        name = f"{prefix} {suffix}"

        delg = random.choice(delegations)
        # Jitter coordinates around center
        lat = round(center_lat + random.uniform(-0.06, 0.06), 6)
        lon = round(center_lon + random.uniform(-0.06, 0.06), 6)

        rating = round(random.uniform(4.0, 4.9), 1)
        reviews = random.randint(12, 380)
        phone = f"+216 {random.choice([70, 71, 72, 73, 74, 75, 76, 77, 78, 20, 50, 90])} {random.randint(100, 999)} {random.randint(100, 999)}"

        gmaps_url = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"

        venues.append({
            "id": f"{gov_key}_{i}",
            "governorate": gov_name,
            "name": name,
            "category": cat_name,
            "icon": icon,
            "delegation": delg,
            "address": f"{delg}، {gov_name}",
            "street": f"شارع الرئيسي، {delg}",
            "lat": lat,
            "lon": lon,
            "rating": rating,
            "reviews_count": reviews,
            "price_level": random.choice(["$", "$$", "$$$"]),
            "cuisine": default_cuisine,
            "phone": phone,
            "email": "",
            "opening_hours": "08:00 - 23:00 (يومياً)",
            "google_maps_url": gmaps_url,
            "delivery_available": random.choice([True, False]),
            "outdoor_seating": random.choice([True, False]),
            "website": "",
            "social_media": "",
            "facebook": "",
            "instagram": "",
            "services": ["جلسات عائلية", "تكييف"],
            "is_featured": random.random() > 0.8
        })

    return venues

def main():
    os.makedirs('data', exist_ok=True)

    # Make sure ariana and tunis remain intact
    for gov_key, gov_info in TUNISIA_GOVERNORATES.items():
        filename = gov_info["file"]
        filepath = os.path.join('data', filename) if filename not in ['restaurants.json', 'tunis_restaurants.json'] else filename

        if os.path.exists(filepath):
            print(f"Skipping {gov_key} (file {filepath} already exists)")
        else:
            print(f"Generating dataset for {gov_info['name_ar']} ({filepath})...")
            dataset = generate_governorate_dataset(gov_key, gov_info, count=40)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(dataset, f, ensure_ascii=False, indent=2)

    # Save master governorate metadata map
    meta = {}
    for key, info in TUNISIA_GOVERNORATES.items():
        meta[key] = {
            "name_ar": info["name_ar"],
            "file": info["file"],
            "delegations": info["delegations"]
        }

    with open('data/governorates_meta.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("Master governorate metadata written to data/governorates_meta.json")

if __name__ == '__main__':
    main()
