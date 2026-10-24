#!/usr/bin/env python3
"""
Filter and sanitize helper for venue dataset entries.
Removes any non-food/beverage venues (e.g. hospitals, posts, schools, banks, municipalities, pharmacies, etc.)
"""

import re

NON_RESTAURANT_KEYWORDS = [
    # Arabic keywords
    r'مستشفى', r'مستوصف', r'مصحة', r'عيادة', r'صيدلية', r'بلدية', r'دائرة بلدية',
    r'مدرسة', r'معهد', r'جامعة', r'كلية', r'مكتب بريد', r'بريد', r'قباضة', r'بنك',
    r'مصرف', r'مركز شرطة', r'مركز حرس', r'محكمة', r'مبيت', r'إدارة', r'مغسلة',
    r'حضانة', r'روضة', r'جامع', r'مسجد', r'كنيسة', r'مطار', r'محطة', r'صالة رياضية',
    # French / English keywords
    r'\bposte\b', r'\bmairie\b', r'\bhospital\b', r'\bclinic\b', r'\bpharmacy\b',
    r'\bschool\b', r'\buniversity\b', r'\bbank\b', r'\bpolice\b', r'\bdispensaire\b',
    r'\bcollege\b', r'\blycee\b', r'\bmosque\b', r'\bchurch\b', r'\bgare\b', r'\bstation\b'
]

COMPILED_NON_RESTAURANT_RE = re.compile('|'.join(NON_RESTAURANT_KEYWORDS), re.IGNORECASE)

def is_valid_restaurant_venue(item):
    if not isinstance(item, dict):
        return False

    name = str(item.get('name', '')).strip()
    category = str(item.get('category', '')).strip()
    activity = str(item.get('activity_type', '')).strip()

    # Reject if empty name
    if not name or len(name) < 2:
        return False

    # Check for invalid non-restaurant keywords in name or category/activity
    text_to_check = f"{name} {category} {activity}"
    if COMPILED_NON_RESTAURANT_RE.search(text_to_check):
        return False

    return True
