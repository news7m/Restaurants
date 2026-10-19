import json
import re

known_social_media = {
    "Plan B": "https://www.facebook.com/planb.tunisie",
    "KFC": "https://www.facebook.com/KFCTunisie",
    "دجاج كنتاكي": "https://www.facebook.com/KFCTunisie",
    "Chili's": "https://www.facebook.com/ChilisTunisie",
    "Eric Kayser": "https://www.facebook.com/MaisonKayserTunisie",
    "Frédéric Cassel": "https://www.facebook.com/fredericcasseltunis",
    "Gourmandise": "https://www.facebook.com/MaisonGourmandise",
    "Paul": "https://www.facebook.com/paultunisie",
    "Cosmitto Coffee": "https://www.facebook.com/CosmittoCoffee",
    "Dar El Jeld": "https://www.facebook.com/dareljeld.tunis",
    "Fondouk El Attarine": "https://www.facebook.com/fondoukelattarine",
    "Café des Délices": "https://www.facebook.com/cafedesdelices.official",
    "Café des Nattes": "https://www.facebook.com/cafedesnattes.official",
    "Le Golfe": "https://www.facebook.com/legolfe.lamarsa",
    "Villa Didon": "https://www.facebook.com/villadidoncarthage.official",
    "Maison Zarrouk": "https://www.facebook.com/maisonzarrouk",
    "Origami Sushi Bar": "https://www.facebook.com/OrigamiSushiBarTunisie",
    "Saray Turkish restaurant": "https://www.facebook.com/saray.restaurant.tunisie",
    "Insomnia": "https://www.facebook.com/iloveinsomnia.tn",
    "Le Réservoir Bistro": "https://www.facebook.com/ReservoirBistro",
    "Le Bambou": "https://www.facebook.com/lebamboucuisineasiatique",
    "Tacos Chaneb": "https://www.facebook.com/TacosChaneb",
    "In-n-out": "https://www.facebook.com/innout.tunisie",
    "Master Food": "https://www.facebook.com/MasterFood.Tunisie",
    "Chez Slah": "https://www.facebook.com/chezslah.restaurant",
    "La Spigola": "https://www.facebook.com/laspigola.lagoulette",
    "Le Baroquest": "https://www.facebook.com/lebaroque.elmanar"
}

def enrich_dataset(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated_count = 0
    for r in data:
        name = r.get('name', '')
        website = r.get('website', '').strip()
        social = r.get('social_media', '').strip()

        # If website is a facebook or instagram link, shift to social_media
        if not social and website and ('facebook.com' in website or 'instagram.com' in website):
            r['social_media'] = website
            r['website'] = ''
            social = website
            updated_count += 1

        # Check known social media matching
        if not social:
            for key, url in known_social_media.items():
                if key.lower() in name.lower():
                    r['social_media'] = url
                    social = url
                    updated_count += 1
                    break

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Updated {file_path}: total entries {len(data)}, enriched {updated_count}")

if __name__ == '__main__':
    enrich_dataset('restaurants.json')
    enrich_dataset('tunis_restaurants.json')
