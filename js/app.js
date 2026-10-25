    let restaurants = [];
    let filteredRestaurants = [];
    let favorites = JSON.parse(localStorage.getItem('ariana_favs') || '[]');
    let customPlaces = JSON.parse(localStorage.getItem('ariana_custom_places') || '[]');
    let showFavsOnly = false;

    let map = null;
    let tileLayer = null;
    let markersCluster = null;
    let userMarker = null;

    const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const TILE_ATTR = '© OpenStreetMap contributors';

    function updateMapTileTheme() {
      if (!map) return;
      if (!tileLayer) {
        tileLayer = L.tileLayer(OSM_TILES, {
          maxZoom: 19,
          attribution: TILE_ATTR
        }).addTo(map);
      }
    }

    // Toast Notification System
    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all transform translate-y-2 opacity-0 ${
        type === 'success' ? 'bg-emerald-600' : type === 'warning' ? 'bg-amber-600' : type === 'danger' ? 'bg-rose-600' : 'bg-slate-800'
      }`;
      toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}"></i> <span>${message}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      }, 10);
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Favorite System
    function toggleFavorite(id) {
      const idx = favorites.indexOf(id);
      const rest = restaurants.find(r => r && String(r.id) === String(id));
      const name = rest ? rest.name : '';
      if (idx > -1) {
        favorites.splice(idx, 1);
        showToast(`تم إزالة ${name} من المفضلة`, 'warning');
      } else {
        favorites.push(id);
        showToast(`تم إضافة ${name} إلى المفضلة`, 'success');
      }
      localStorage.setItem('ariana_favs', JSON.stringify(favorites));
      updateFavsCounter();
      applyFilters();
    }

    function updateFavsCounter() {
      const el = document.getElementById('favs-count');
      if (el) el.innerText = favorites.length;
    }

    function toggleMobileFilters() {
      const container = document.getElementById('filters-grid-container');
      const chevron = document.getElementById('mobile-filter-chevron');
      if (!container) return;

      if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        container.classList.add('grid');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      } else {
        container.classList.add('hidden');
        container.classList.remove('grid');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    }

    function toggleMobileHeaderMenu(event) {
      if (event) event.stopPropagation();
      const menu = document.getElementById('mobile-header-menu');
      if (menu) menu.classList.toggle('hidden');
    }

    function closeMobileHeaderMenu() {
      const menu = document.getElementById('mobile-header-menu');
      if (menu) menu.classList.add('hidden');
    }

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('mobile-header-menu');
      if (menu && !menu.classList.contains('hidden')) {
        if (!e.target.closest('#mobile-header-menu') && !e.target.closest('button[aria-label="خيارات إضافية"]')) {
          closeMobileHeaderMenu();
        }
      }
    });

    function toggleFavsFilter() {
      showFavsOnly = !showFavsOnly;
      const btn = document.getElementById('favs-toggle-btn');
      const icon = document.getElementById('favs-btn-icon');
      if (showFavsOnly) {
        btn.classList.add('bg-rose-600', 'text-white');
        btn.classList.remove('bg-rose-50', 'dark:bg-rose-950/50', 'text-rose-600', 'dark:text-rose-400');
        icon.className = 'fa-solid fa-heart text-sm';
        showToast('عرض الأماكن المفضلة فقط', 'info');
      } else {
        btn.classList.remove('bg-rose-600', 'text-white');
        btn.classList.add('bg-rose-50', 'dark:bg-rose-950/50', 'text-rose-600', 'dark:text-rose-400');
        icon.className = 'fa-regular fa-heart text-sm';
      }
      applyFilters();
    }

    function suggestRandomRestaurant() {
      if (filteredRestaurants.length === 0) {
        showToast('لا توجد مطاعم مطابقة للبحث حالياً للاقتراح منها!', 'warning');
        return;
      }
      const randomItem = filteredRestaurants[Math.floor(Math.random() * filteredRestaurants.length)];
      focusOnRestaurant(randomItem.id);
      openDetailsModal(randomItem.id);
      showToast(`اقترحنا لك: ${randomItem.name} 🎲`, 'success');
    }

    let deferredPrompt = null;

    // DOM Ready Initialization
    document.addEventListener('DOMContentLoaded', async () => {
      initTheme();
      updateFavsCounter();
      registerServiceWorker();
      initOfflineStatusListeners();

      // Defer Map Init to allow immediate DOM rendering and First Contentful Paint
      requestAnimationFrame(() => {
        initMap();
        loadRestaurantsData();
      });
    });

    // Offline / Online Status Listeners
    function initOfflineStatusListeners() {
      const banner = document.getElementById('offline-banner');
      function updateOnlineStatus() {
        if (!navigator.onLine) {
          if (banner) banner.classList.remove('hidden');
          showToast('انقطع الاتصال بالشبكة. التطبيق يعمل في وضع الأوفلاين 📡', 'warning');
        } else {
          if (banner) banner.classList.add('hidden');
          showToast('تم استعادة الاتصال بالإنترنت 🟢', 'success');
        }
      }

      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);

      if (!navigator.onLine && banner) {
        banner.classList.remove('hidden');
      }
    }

    // Arabic Pluralization Helper
    function getArabicPlural(count) {
      if (count === 0) return 'لا توجد أماكن';
      if (count === 1) return 'مكان واحد';
      if (count === 2) return 'مكانيْن';
      if (count >= 3 && count <= 10) return `${count} أماكن`;
      return `${count} مكاناً`;
    }

    // Mobile View Toggle
    let currentMobileView = 'list';
    function setMobileView(view) {
      currentMobileView = view;
      const mapPanel = document.getElementById('map-panel');
      const listPanel = document.getElementById('list-panel');
      const tabList = document.getElementById('mobile-tab-list');
      const tabMap = document.getElementById('mobile-tab-map');

      if (!mapPanel || !listPanel) return;

      if (view === 'map') {
        mapPanel.classList.remove('hidden');
        listPanel.classList.add('hidden');
        if (tabMap && tabList) {
          tabMap.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm';
          tabList.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
        }
        setTimeout(() => {
          if (map) {
            map.invalidateSize();
            if (filteredRestaurants && filteredRestaurants.length > 0) {
              const bounds = filteredRestaurants.map(r => [r.lat, r.lon]);
              map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
            } else {
              map.setView([36.84, 10.22], 11);
            }
          }
        }, 150);
      } else {
        mapPanel.classList.add('hidden');
        listPanel.classList.remove('hidden');
        if (tabMap && tabList) {
          tabList.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm';
          tabMap.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
        }
      }
    }

    // Share Venue helper
    function shareVenue(id) {
      const item = restaurants.find(r => r && String(r.id) === String(id));
      if (!item) return;

      const shareText = `${item.name} - ${item.category || item.activity_type || ''}\nالعنوان: ${item.address}\nالرابط: ${item.google_maps_url}`;
      if (navigator.share) {
        navigator.share({
          title: item.name,
          text: shareText,
          url: item.google_maps_url
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareText)
          .then(() => showToast('تم نسخ تفاصيل المكان للحافظة 📋', 'success'))
          .catch(() => showToast('تعذر النسخ تلقائياً', 'warning'));
      }
    }

    let newWorker = null;

    // PWA Service Worker Registration & Update Handler
    function registerServiceWorker() {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js')
            .then(reg => {
              console.log('[PWA] Service Worker registered successfully:', reg.scope);

              reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    const updateToast = document.getElementById('update-toast');
                    if (updateToast) updateToast.classList.remove('hidden');
                  }
                });
              });
            })
            .catch(err => console.warn('[PWA] Service Worker registration failed:', err));

          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
              refreshing = true;
              window.location.reload();
            }
          });
        });
      }
    }

    function reloadPWAUpdate() {
      if (newWorker) {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    }

    // Capture PWA Installation Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const installBtn = document.getElementById('pwa-install-btn');
      if (installBtn) installBtn.classList.remove('hidden');
    });

    function installPWA() {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
        }
        deferredPrompt = null;
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) installBtn.classList.add('hidden');
      });
    }

    // Dark Mode Handler
    function isDarkMode() {
      return document.documentElement.classList.contains('dark');
    }

    function updateThemeIcons() {
      const darkIcon = document.getElementById('theme-toggle-dark-icon');
      const lightIcon = document.getElementById('theme-toggle-light-icon');
      if (!darkIcon || !lightIcon) return;

      if (document.documentElement.classList.contains('dark')) {
        darkIcon.classList.add('hidden');
        lightIcon.classList.remove('hidden');
      } else {
        darkIcon.classList.remove('hidden');
        lightIcon.classList.add('hidden');
      }
    }

    function initTheme() {
      if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      updateThemeIcons();
    }

    function toggleDarkMode() {
      if (isDarkMode()) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
      updateThemeIcons();
      updateMapTileTheme();
    }

    // Initialize Leaflet Map centered on Greater Tunis (Ariana & Tunis)
    function initMap() {
      map = L.map('map').setView([36.84, 10.22], 11);

      updateMapTileTheme();

      markersCluster = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
      });

      map.addLayer(markersCluster);
    }

    let governorateMeta = {};
    const loadedGovernoratesCache = {};

    // Populate Delegation Options dynamically based on Governorate Selection
    function populateDelegationOptions() {
      const govVal = document.getElementById('governorate-filter').value;
      const delSelect = document.getElementById('delegation-filter');
      const currentVal = delSelect.value;

      let delegations = [];
      if (govVal !== 'ALL' && governorateMeta) {
        const entry = Object.values(governorateMeta).find(v => v.name_ar === govVal || govVal.includes(v.name_ar));
        if (entry && entry.delegations) {
          delegations = entry.delegations;
        }
      }

      if (delegations.length === 0) {
        const availablePlaces = govVal === 'ALL'
          ? restaurants
          : restaurants.filter(r => r && r.governorate === govVal);
        delegations = Array.from(new Set(availablePlaces.map(r => r.delegation || r.region).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));
      }

      delSelect.innerHTML = `<option value="ALL">جميع المناطق والمعتمديات</option>` +
        delegations.map(d => `<option value="${d}">${d}</option>`).join('');

      if (delegations.includes(currentVal)) {
        delSelect.value = currentVal;
      } else {
        delSelect.value = 'ALL';
      }
    }

    async function handleGovernorateChange() {
      const govVal = document.getElementById('governorate-filter').value;
      if (govVal === 'ALL') {
        showToast('جاري تحميل كافة ولايات تونس الـ 24... 🇹🇳', 'info');
        await fetchAllGovernorates();
      } else {
        await fetchGovernorateDataset(govVal);
      }
      populateDelegationOptions();
      updateStats();
      applyFilters(true);
    }

    // Modal Add Place helpers
    let pickerMap = null;
    let pickerMarker = null;

    function initPickerMap() {
      if (pickerMap) return;
      const pickerContainer = document.getElementById('picker-map');
      if (!pickerContainer) return;

      pickerMap = L.map('picker-map', {
        zoomControl: true,
        tap: false
      }).setView([36.866, 10.183], 13);

      L.tileLayer(OSM_TILES, {
        maxZoom: 19,
        attribution: TILE_ATTR
      }).addTo(pickerMap);

      pickerMarker = L.marker([36.866, 10.183], { draggable: true }).addTo(pickerMap);

      pickerMarker.on('dragend', function (e) {
        const coord = pickerMarker.getLatLng();
        setPickerCoordinates(coord.lat, coord.lng, 'تم تحديد الموقع يدوياً بسحب الشارة 📍');
      });

      pickerMap.on('click', function (e) {
        setPickerCoordinates(e.latlng.lat, e.latlng.lng, 'تم تحديد النقطة بالنقر على الخريطة 📍');
      });
    }

    function setPickerCoordinates(lat, lon, statusText = 'تم تحديد الموقع') {
      const roundedLat = roundTo(lat, 6);
      const roundedLon = roundTo(lon, 6);

      document.getElementById('new-lat').value = roundedLat;
      document.getElementById('new-lon').value = roundedLon;

      const coordsReadout = document.getElementById('picker-coords-readout');
      if (coordsReadout) {
        coordsReadout.innerText = `${roundedLat}, ${roundedLon}`;
      }

      const statusEl = document.getElementById('picker-status-text');
      if (statusEl) {
        statusEl.innerText = statusText;
      }

      if (pickerMarker && pickerMap) {
        pickerMarker.setLatLng([roundedLat, roundedLon]);
        pickerMap.panTo([roundedLat, roundedLon]);
      }
    }

    function autoSetCoordinatesFromSelection() {
      const govVal = document.getElementById('new-governorate').value;
      const delVal = document.getElementById('new-delegation').value;

      const matchedPlaces = restaurants.filter(r => r && r.governorate === govVal && (r.delegation === delVal || r.region === delVal));
      if (matchedPlaces.length > 0) {
        const avgLat = matchedPlaces.reduce((sum, r) => sum + (r.lat || r.coordinates?.lat || 0), 0) / matchedPlaces.length;
        const avgLon = matchedPlaces.reduce((sum, r) => sum + (r.lon || r.coordinates?.lng || 0), 0) / matchedPlaces.length;
        setPickerCoordinates(avgLat, avgLon, `الموقع التلقائي لمنطقة: ${delVal}`);
      } else {
        const fallbackLat = govVal === 'ولاية تونس' ? 36.8065 : 36.8665;
        const fallbackLon = govVal === 'ولاية تونس' ? 10.1815 : 10.1835;
        setPickerCoordinates(fallbackLat, fallbackLon, `الموقع التلقائي لـ ${govVal}`);
      }
    }

    function getPickerUserLocation() {
      if (!navigator.geolocation) {
        showToast('خاصية تحديد الموقع غير مدعومة في متصفحك.', 'warning');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setPickerCoordinates(lat, lon, 'تم التقاط موقعك الحالي بنجاح عبر GPS 📍');
          showToast('تم تحديد موقعك الحالي على الخريطة 📍', 'success');
        },
        (err) => {
          showToast('تعذر الوصول إلى موقعك الحالي. يرجى التأكد من السماح بالصلاحيات.', 'warning');
        }
      );
    }

    function openAddPlaceModal() {
      updateNewPlaceDelegations();
      document.getElementById('add-place-modal').classList.remove('hidden');

      setTimeout(() => {
        initPickerMap();
        if (pickerMap) {
          pickerMap.invalidateSize();
        }
        autoSetCoordinatesFromSelection();
      }, 100);
    }

    function closeAddPlaceModal() {
      document.getElementById('add-place-modal').classList.add('hidden');
    }

    function updateNewPlaceDelegations() {
      const govVal = document.getElementById('new-governorate').value;
      const delSelect = document.getElementById('new-delegation');

      let delegations = [];
      if (governorateMeta) {
        const entry = Object.values(governorateMeta).find(v => v.name_ar === govVal || govVal.includes(v.name_ar));
        if (entry && entry.delegations) {
          delegations = entry.delegations;
        }
      }

      if (delegations.length === 0) {
        const availablePlaces = restaurants.filter(r => r && r.governorate === govVal);
        delegations = Array.from(new Set(availablePlaces.map(r => r.delegation || r.region).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));
      }

      delSelect.innerHTML = delegations.map(d => `<option value="${d}">${d}</option>`).join('');
      autoSetCoordinatesFromSelection();
    }

    function roundTo(num, decimals = 6) {
      const parsed = parseFloat(num);
      if (isNaN(parsed) || parsed === null) return 0;
      return Number(Math.round(parsed + "e" + decimals) + "e-" + decimals);
    }

    function handleAddNewPlace(e) {
      e.preventDefault();
      const newGov = document.getElementById('new-governorate').value;
      let latVal = parseFloat(document.getElementById('new-lat').value);
      let lonVal = parseFloat(document.getElementById('new-lon').value);

      if (isNaN(latVal) || isNaN(lonVal) || latVal === 0 || lonVal === 0) {
        latVal = newGov === 'ولاية تونس' ? 36.8065 : 36.8665;
        lonVal = newGov === 'ولاية تونس' ? 10.1815 : 10.1835;
      }

      latVal = roundTo(latVal, 6);
      lonVal = roundTo(lonVal, 6);

      const fbUrl = document.getElementById('new-facebook') ? document.getElementById('new-facebook').value.trim() : '';
      const instaUrl = document.getElementById('new-instagram') ? document.getElementById('new-instagram').value.trim() : '';

      const catVal = document.getElementById('new-category').value;
      const newPlace = {
        id: Date.now(),
        governorate: newGov,
        name: document.getElementById('new-name').value.trim(),
        category: catVal,
        activity_type: catVal.includes('مقهى') ? 'مقهى' : 'مطعم',
        icon: catVal.includes('مقهى') ? '☕' : '🍽️',
        delegation: document.getElementById('new-delegation').value,
        region: document.getElementById('new-delegation').value,
        address: document.getElementById('new-address').value.trim(),
        street: 'غير محدد',
        lat: latVal,
        lon: lonVal,
        coordinates: { lat: latVal, lng: lonVal },
        rating: 5.0,
        reviews_count: 1,
        price_level: '$$',
        cuisine: document.getElementById('new-cuisine').value.trim() || 'تونسية',
        phone: document.getElementById('new-phone').value.trim() || '+216 00 000 000',
        email: document.getElementById('new-email') ? document.getElementById('new-email').value.trim() : '',
        website: document.getElementById('new-website') ? document.getElementById('new-website').value.trim() : '',
        social_media: fbUrl || instaUrl,
        facebook: fbUrl,
        instagram: instaUrl,
        opening_hours: '08:00 - 23:00 (يومياً)',
        google_maps_url: `https://www.google.com/maps/search/?api=1&query=${latVal},${lonVal}`,
        delivery_available: true,
        outdoor_seating: true
      };

      customPlaces.push(newPlace);
      localStorage.setItem('ariana_custom_places', JSON.stringify(customPlaces));
      restaurants.unshift(newPlace);

      closeAddPlaceModal();
      document.getElementById('add-place-form').reset();

      populateDelegationOptions();
      updateStats();
      applyFilters();
      showToast(`تمت إضافة "${newPlace.name}" بنجاح!`, 'success');
    }

    // Helper to get effective social media links and icons
    function getSocialList(item) {
      if (!item) return [];
      const socialList = [];

      let fbUrl = item.facebook ? item.facebook.trim() : '';
      let instaUrl = item.instagram ? item.instagram.trim() : '';

      if (!fbUrl && !instaUrl && item.social_media) {
        const sm = item.social_media.trim();
        if (sm.toLowerCase().includes('instagram.com')) {
          instaUrl = sm;
        } else {
          fbUrl = sm;
        }
      }

      if (!fbUrl && !instaUrl && item.website) {
        const w = item.website.trim();
        if (w.toLowerCase().includes('facebook.com')) {
          fbUrl = w;
        } else if (w.toLowerCase().includes('instagram.com')) {
          instaUrl = w;
        }
      }

      if (fbUrl) {
        if (!fbUrl.startsWith('http://') && !fbUrl.startsWith('https://')) fbUrl = 'https://' + fbUrl;
        socialList.push({
          url: fbUrl,
          iconClass: 'fa-brands fa-facebook text-sky-500',
          title: 'Facebook'
        });
      }

      if (instaUrl) {
        if (!instaUrl.startsWith('http://') && !instaUrl.startsWith('https://')) instaUrl = 'https://' + instaUrl;
        socialList.push({
          url: instaUrl,
          iconClass: 'fa-brands fa-instagram text-rose-500',
          title: 'Instagram'
        });
      }

      return socialList;
    }

    function getSocialInfo(item) {
      const list = getSocialList(item);
      return list.length > 0 ? list[0] : null;
    }

    async function fetchGovernorateDataset(govName) {
      if (!governorateMeta || Object.keys(governorateMeta).length === 0) return;

      const entry = Object.entries(governorateMeta).find(([k, v]) => v.name_ar === govName || govName.includes(v.name_ar));
      if (!entry) return;

      const [key, meta] = entry;
      if (loadedGovernoratesCache[key]) return;

      const filepath = meta.file.startsWith('data/') || meta.file === 'restaurants.json' || meta.file === 'tunis_restaurants.json'
        ? meta.file
        : `data/${meta.file}`;

      try {
        const resp = await fetch(filepath);
        if (resp.ok) {
          const data = await resp.json();
          loadedGovernoratesCache[key] = data;

          const existingIds = new Set(restaurants.filter(Boolean).map(r => String(r.id)));
          const newEntries = data.filter(r => r && !existingIds.has(String(r.id)));
          restaurants = restaurants.concat(newEntries);
        }
      } catch (err) {
        console.warn('Could not load governorate file:', filepath, err);
      }
    }

    async function fetchAllGovernorates() {
      if (!governorateMeta) return;
      const keys = Object.keys(governorateMeta);
      const fetchPromises = keys.map(k => {
        const meta = governorateMeta[k];
        const filepath = meta.file.startsWith('data/') || meta.file === 'restaurants.json' || meta.file === 'tunis_restaurants.json'
          ? meta.file
          : `data/${meta.file}`;
        if (loadedGovernoratesCache[k]) return Promise.resolve(loadedGovernoratesCache[k]);

        return fetch(filepath)
          .then(r => r.json())
          .then(data => {
            loadedGovernoratesCache[k] = data;
            return data;
          })
          .catch(() => []);
      });

      const allData = await Promise.all(fetchPromises);
      let combined = [...customPlaces];
      const seenIds = new Set();
      allData.forEach(dataset => {
        if (Array.isArray(dataset)) {
          dataset.forEach(item => {
            if (item && !seenIds.has(String(item.id))) {
              seenIds.add(String(item.id));
              combined.push(item);
            }
          });
        }
      });
      restaurants = combined;
    }

    // Fetch datasets from restaurants.json and tunis_restaurants.json with LocalStorage offline cache backup
    async function loadRestaurantsData() {
      try {
        try {
          const metaResp = await fetch('data/governorates_meta.json');
          if (metaResp.ok) {
            governorateMeta = await metaResp.json();
          }
        } catch (e) {
          console.warn('Metadata load fallback:', e);
        }

        const [arianaResp, tunisResp] = await Promise.all([
          fetch('restaurants.json'),
          fetch('tunis_restaurants.json')
        ]);

        const arianaData = await arianaResp.json();
        const tunisData = await tunisResp.json();

        loadedGovernoratesCache['ariana'] = arianaData;
        loadedGovernoratesCache['tunis'] = tunisData;

        const formattedAriana = (Array.isArray(arianaData) ? arianaData : []).map(item => ({
          ...item,
          governorate: item.governorate || "ولاية أريانة",
          category: item.category || (item.activity_type ? `${item.activity_type} عام` : "مطعم عام (Restaurant)"),
          delegation: item.delegation || item.region || "أريانة المدينة",
          lat: item.lat || item.coordinates?.lat || 36.866,
          lon: item.lon || item.coordinates?.lng || 10.183
        }));

        const formattedTunis = (Array.isArray(tunisData) ? tunisData : []).map(item => ({
          ...item,
          governorate: item.governorate || "ولاية تونس",
          category: item.category || (item.activity_type ? `${item.activity_type} عام` : "مطعم عام (Restaurant)"),
          delegation: item.delegation || item.region || "وسط المدينة",
          lat: item.lat || item.coordinates?.lat || 36.806,
          lon: item.lon || item.coordinates?.lng || 10.181
        }));

        restaurants = [...customPlaces, ...formattedAriana, ...formattedTunis];
        filteredRestaurants = [...restaurants];

        populateDelegationOptions();
        updateStats();
        applyFilters(true);
      } catch (err) {
        console.error('Error loading restaurant datasets:', err);
        showToast('تعذر تحميل قاعدة البيانات، يرجى إعادة التأكد من الاتصال', 'danger');
      }
    }

    // Update KPI Numbers based on active Governorate Filter
    function updateStats() {
      const govVal = document.getElementById('governorate-filter').value;
      const activeList = govVal === 'ALL'
        ? restaurants
        : restaurants.filter(r => r && r.governorate === govVal);

      document.getElementById('stat-total').innerText = activeList.length;

      const restCount = activeList.filter(r => {
        if (!r) return false;
        const cat = String(r.category || r.activity_type || '');
        return cat.includes('مطعم') || cat.includes('وجبات') || cat.includes('بيتزا') || cat.includes('Restaurant');
      }).length;

      const cafeCount = activeList.filter(r => {
        if (!r) return false;
        const cat = String(r.category || r.activity_type || '');
        return cat.includes('مقهى') || cat.includes('كافيه') || cat.includes('Café') || cat.includes('حلويات');
      }).length;

      const delgSet = new Set(activeList.map(r => r ? (r.delegation || r.region) : null).filter(Boolean));

      document.getElementById('stat-restaurants').innerText = restCount;
      document.getElementById('stat-cafes').innerText = cafeCount;
      document.getElementById('stat-delegations').innerText = delgSet.size;
    }

    function debounce(func, wait = 250) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
    const debouncedApplyFilters = debounce(applyFilters, 250);

    // Apply Search and Multi-Filters
    function applyFilters(shouldFitBounds = false) {
      const searchTerm = document.getElementById('search-input').value.trim().toLowerCase();
      const governorateVal = document.getElementById('governorate-filter').value;
      const delegationVal = document.getElementById('delegation-filter').value;
      const categoryVal = document.getElementById('category-filter').value;
      const serviceVal = document.getElementById('services-filter').value;
      const priceVal = document.getElementById('price-filter') ? document.getElementById('price-filter').value : 'ALL';
      const ratingVal = document.getElementById('rating-filter') ? parseFloat(document.getElementById('rating-filter').value) : 0;
      const sortVal = document.getElementById('sort-option').value;

      // Show/Hide Clear Button
      const clearBtn = document.getElementById('clear-search');
      if (searchTerm.length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }

      // Update active filter pills
      const pillsContainer = document.getElementById('active-filter-pills');
      if (pillsContainer) {
        const activePills = [];
        if (searchTerm) {
          activePills.push(`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">بحث: "${searchTerm}" <button onclick="clearSearch()" class="hover:text-rose-900 dark:hover:text-white mr-1 font-bold">×</button></span>`);
        }
        if (governorateVal !== 'ALL') {
          activePills.push(`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">${governorateVal} <button onclick="document.getElementById('governorate-filter').value='ALL'; handleGovernorateChange();" class="hover:text-indigo-900 dark:hover:text-white mr-1 font-bold">×</button></span>`);
        }
        if (delegationVal !== 'ALL') {
          activePills.push(`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">${delegationVal} <button onclick="document.getElementById('delegation-filter').value='ALL'; applyFilters();" class="hover:text-sky-900 dark:hover:text-white mr-1 font-bold">×</button></span>`);
        }
        if (categoryVal !== 'ALL') {
          activePills.push(`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">${categoryVal.split(' ')[0]} <button onclick="document.getElementById('category-filter').value='ALL'; applyFilters();" class="hover:text-emerald-900 dark:hover:text-white mr-1 font-bold">×</button></span>`);
        }
        if (serviceVal !== 'ALL') {
          const serviceName = serviceVal === 'delivery' ? 'توصيل' : 'جلسات خارجية';
          activePills.push(`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">${serviceName} <button onclick="document.getElementById('services-filter').value='ALL'; applyFilters();" class="hover:text-amber-900 dark:hover:text-white mr-1 font-bold">×</button></span>`);
        }
        if (priceVal !== 'ALL') {
          activePills.push(`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">${priceVal} <button onclick="document.getElementById('price-filter').value='ALL'; applyFilters();" class="hover:text-purple-900 dark:hover:text-white mr-1 font-bold">×</button></span>`);
        }
        if (ratingVal > 0) {
          activePills.push(`<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">⭐ ${ratingVal}+ <button onclick="document.getElementById('rating-filter').value='0'; applyFilters();" class="hover:text-amber-900 dark:hover:text-white mr-1 font-bold">×</button></span>`);
        }

        if (activePills.length > 0) {
          pillsContainer.innerHTML = activePills.join('') + `<button onclick="resetFilters()" class="text-rose-600 dark:text-rose-400 hover:underline font-bold text-[11px] self-center">مسح الكل</button>`;
          pillsContainer.classList.remove('hidden');
          pillsContainer.classList.add('flex');
        } else {
          pillsContainer.innerHTML = '';
          pillsContainer.classList.add('hidden');
          pillsContainer.classList.remove('flex');
        }
      }

      filteredRestaurants = restaurants.filter(item => {
        if (!item) return false;
        const itemGov = item.governorate || '';
        const itemDelg = item.delegation || item.region || '';
        const itemCat = item.category || item.activity_type || '';
        const itemName = item.name || '';
        const itemAddr = item.address || '';
        const itemCuisine = item.cuisine || (Array.isArray(item.cuisines) ? item.cuisines.join(' ') : '');

        // Governorate check
        const matchGov = governorateVal === 'ALL' || itemGov === governorateVal;

        // Search check
        const matchSearch = !searchTerm ||
          itemName.toLowerCase().includes(searchTerm) ||
          itemAddr.toLowerCase().includes(searchTerm) ||
          itemDelg.toLowerCase().includes(searchTerm) ||
          itemGov.toLowerCase().includes(searchTerm) ||
          itemCuisine.toLowerCase().includes(searchTerm);

        // Delegation check
        const matchDelegation = delegationVal === 'ALL' || itemDelg === delegationVal;

        // Category check
        const matchCategory = categoryVal === 'ALL' || itemCat === categoryVal || itemCat.includes(categoryVal.split(' ')[0]);

        // Services check
        let matchService = true;
        if (serviceVal === 'delivery') matchService = !!item.delivery_available;
        if (serviceVal === 'outdoor') matchService = !!item.outdoor_seating;

        // Favorites check
        const matchFav = !showFavsOnly || favorites.some(favId => String(favId) === String(item.id));

        // Price check
        const matchPrice = priceVal === 'ALL' || item.price_level === priceVal;

        // Rating check
        const matchRating = (item.rating || 0) >= ratingVal;

        return matchGov && matchSearch && matchDelegation && matchCategory && matchService && matchFav && matchPrice && matchRating;
      });

      // Sorting
      if (sortVal === 'rating_desc') {
        filteredRestaurants.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sortVal === 'reviews_desc') {
        filteredRestaurants.sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
      } else if (sortVal === 'name_asc') {
        filteredRestaurants.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
      }

      renderList();
      renderMarkers(shouldFitBounds);
    }

    function clearSearch() {
      document.getElementById('search-input').value = '';
      applyFilters(true);
    }

    function resetFilters() {
      document.getElementById('search-input').value = '';
      document.getElementById('governorate-filter').value = 'ALL';
      populateDelegationOptions();
      document.getElementById('category-filter').value = 'ALL';
      document.getElementById('services-filter').value = 'ALL';
      document.getElementById('price-filter').value = 'ALL';
      document.getElementById('rating-filter').value = '0';
      document.getElementById('sort-option').value = 'rating_desc';
      updateStats();
      applyFilters(true);
    }

    let displayedItemsCount = 20;
    const PAGE_SIZE = 20;

    function renderCardHTML(item) {
      if (!item) return '';
      const socialLinks = getSocialList(item);
      const websiteUrl = (item.website && !item.website.includes('facebook.com') && !item.website.includes('instagram.com')) ? item.website : '';
      const phoneDigits = item.phone ? item.phone.replace(/\s+/g, '') : '';
      const displayCategory = item.category || item.activity_type || 'مطعم';
      const displayDelegation = item.delegation || item.region || 'غير محدد';
      const displayIcon = item.icon || '🍽️';
      const displayCuisine = item.cuisine || (Array.isArray(item.cuisines) ? item.cuisines[0] : 'تونسية');

      const socialButtonsHtml = socialLinks.map(s => `
        <a href="${s.url}" target="_blank" aria-label="${s.title}" onclick="event.stopPropagation();" class="touch-target transition" title="${s.title}">
          <i class="${s.iconClass} text-sm"></i>
        </a>
      `).join('');

      return `
        <div onclick="focusOnRestaurant('${item.id}')" class="bg-white dark:bg-slate-800 hover:border-rose-400 dark:hover:border-rose-500 rounded-2xl p-3.5 shadow-sm border border-slate-200/80 dark:border-slate-700/60 transition duration-300 cursor-pointer group relative overflow-hidden">
          <div class="flex items-start justify-between gap-2.5">
            <div class="flex items-start gap-2.5 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                ${displayIcon}
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm group-hover:text-rose-600 dark:group-hover:text-rose-400 transition flex items-center gap-1.5 flex-wrap">
                  <span class="truncate">${item.name || 'مكان'}</span>
                  ${item.is_featured ? '<span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 shrink-0"><i class="fa-solid fa-star text-[9px] ml-0.5"></i>مميز</span>' : ''}
                  <span class="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40 shrink-0">
                    ${item.governorate || 'ولاية أريانة'}
                  </span>
                  <span class="text-[10px] font-normal px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                    ${displayDelegation}
                  </span>
                </h3>
                <p class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">
                  <i class="fa-solid fa-location-dot text-rose-500 ml-1"></i>${item.address || ''}
                </p>
              </div>
            </div>
            <div class="flex flex-col items-end shrink-0">
              <div class="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-lg text-xs font-bold border border-amber-200/60 dark:border-amber-800/40">
                <i class="fa-solid fa-star text-amber-500 text-[10px]"></i>
                <span>${item.rating || '4.5'}</span>
              </div>
              <span class="text-[9px] text-slate-600 dark:text-slate-300 font-medium mt-0.5">(${item.reviews_count || 1} تقييم)</span>
            </div>
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs flex-wrap gap-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px]">
                ${displayCuisine}
              </span>
              ${item.delivery_available ? '<span class="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium"><i class="fa-solid fa-truck-fast ml-0.5"></i>توصيل</span>' : ''}
              ${item.outdoor_seating ? '<span class="text-sky-600 dark:text-sky-400 text-[10px] font-medium"><i class="fa-solid fa-chair ml-0.5"></i>جلسات خارجية</span>' : ''}
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <button onclick="event.stopPropagation(); toggleFavorite('${item.id}')" aria-label="حفظ بالمفضلة" class="touch-target text-slate-500 hover:text-rose-600 transition" title="حفظ بالمفضلة">
                <i class="${favorites.some(favId => String(favId) === String(item.id)) ? 'fa-solid fa-heart text-rose-500' : 'fa-regular fa-heart'} text-sm"></i>
              </button>
              <button onclick="event.stopPropagation(); shareVenue('${item.id}')" aria-label="مشاركة المكان" class="touch-target text-slate-500 hover:text-indigo-600 transition" title="مشاركة المكان">
                <i class="fa-solid fa-share-nodes text-sm"></i>
              </button>
              ${phoneDigits ? `<a href="tel:${phoneDigits}" aria-label="اتصال تلفوني" onclick="event.stopPropagation();" class="touch-target text-emerald-600 hover:text-emerald-700 transition" title="اتصال تلفوني"><i class="fa-solid fa-phone text-sm"></i></a>` : ''}
              ${websiteUrl ? `<a href="${websiteUrl}" target="_blank" aria-label="الموقع الإلكتروني" onclick="event.stopPropagation();" class="touch-target text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition" title="الموقع الإلكتروني"><i class="fa-solid fa-globe text-sm"></i></a>` : ''}
              ${socialButtonsHtml}
              <button onclick="event.stopPropagation(); openDetailsModal('${item.id}')" aria-label="عرض التفاصيل" class="touch-target text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition" title="عرض التفاصيل">
                <i class="fa-solid fa-circle-info text-sm"></i>
              </button>
              <a href="${item.google_maps_url}" target="_blank" aria-label="الاتجاهات عبر Google Maps" onclick="event.stopPropagation();" class="touch-target text-rose-600 hover:text-rose-700 font-bold transition" title="الاتجاهات عبر Google Maps">
                <i class="fa-solid fa-location-arrow text-sm"></i>
              </a>
            </div>
          </div>
        </div>
      `;
    }

    // Render Cards in List Panel with Chunked/Paginated Lazy Loading
    function renderList(resetScroll = true) {
      const container = document.getElementById('restaurants-container');
      const count = filteredRestaurants.length;
      document.getElementById('results-count').innerText = count;
      document.getElementById('results-unit').innerText = count === 1 ? 'مكان' : (count === 2 ? 'مكانيْن' : (count >= 3 && count <= 10 ? 'أماكن' : 'مكاناً'));
      document.getElementById('map-counter').innerText = getArabicPlural(count);

      if (resetScroll) {
        displayedItemsCount = PAGE_SIZE;
        container.scrollTop = 0;
      }

      if (count === 0) {
        container.innerHTML = `
          <div class="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 transition-colors duration-300">
            <i class="fa-solid fa-magnifying-glass-location text-3xl text-slate-300 dark:text-slate-600 mb-2"></i>
            <h3 class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">لا توجد نتائج مطابقة لمحددات البحث</h3>
            <p class="text-[11px] text-slate-400 mb-3">جرب البحث بكلمات أخرى أو تغيير خيارات التصفية.</p>
            <button onclick="resetFilters()" class="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition">
              عرض جميع الأماكن
            </button>
          </div>
        `;
        return;
      }

      const itemsToRender = filteredRestaurants.slice(0, displayedItemsCount);
      let html = itemsToRender.map(item => renderCardHTML(item)).join('');

      if (displayedItemsCount < count) {
        html += `
          <div id="load-more-sentinel" class="text-center py-3">
            <button onclick="loadMoreRestaurants()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition">
              عرض المزيد (${count - displayedItemsCount} المتبقية)
            </button>
          </div>
        `;
      }

      container.innerHTML = html;
      setupContainerScrollListener();
    }

    function loadMoreRestaurants() {
      if (displayedItemsCount >= filteredRestaurants.length) return;
      const container = document.getElementById('restaurants-container');
      const sentinel = document.getElementById('load-more-sentinel');
      if (sentinel) sentinel.remove();

      const prevCount = displayedItemsCount;
      displayedItemsCount += PAGE_SIZE;
      const nextChunk = filteredRestaurants.slice(prevCount, displayedItemsCount);

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = nextChunk.map(item => renderCardHTML(item)).join('');
      while (tempDiv.firstChild) {
        container.appendChild(tempDiv.firstChild);
      }

      if (displayedItemsCount < filteredRestaurants.length) {
        const newSentinel = document.createElement('div');
        newSentinel.id = 'load-more-sentinel';
        newSentinel.className = 'text-center py-3';
        newSentinel.innerHTML = `
          <button onclick="loadMoreRestaurants()" class="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition">
            عرض المزيد (${filteredRestaurants.length - displayedItemsCount} المتبقية)
          </button>
        `;
        container.appendChild(newSentinel);
      }
    }

    function setupContainerScrollListener() {
      const container = document.getElementById('restaurants-container');
      if (!container || container.dataset.scrollAttached) return;
      container.dataset.scrollAttached = 'true';
      container.addEventListener('scroll', () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 150) {
          loadMoreRestaurants();
        }
      });
    }

    // Render Markers on Map with Bulk Batching
    function renderMarkers(shouldFitBounds = false) {
      markersCluster.clearLayers();
      const newMarkers = [];

      filteredRestaurants.forEach(item => {
        if (!item) return;
        const lat = item.lat || item.coordinates?.lat;
        const lon = item.lon || item.coordinates?.lng;
        if (!lat || !lon) return;

        const iconChar = item.icon || '🍽️';
        const customIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #e11d48; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px -1px rgba(0,0,0,0.3); font-size: 13px; border: 2px solid white;">${iconChar}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([lat, lon], { icon: customIcon });

        const social = getSocialInfo(item);
        const websiteUrl = (item.website && !item.website.includes('facebook.com') && !item.website.includes('instagram.com')) ? item.website : '';
        const displayCategory = item.category || item.activity_type || 'مطعم';

        const popupContent = `
          <div dir="rtl" class="text-right font-sans p-1">
            <div class="font-bold text-xs mb-0.5">${item.name || ''}</div>
            <div class="text-[11px] text-rose-600 font-semibold mb-1">${displayCategory} (${item.governorate || 'ولاية أريانة'})</div>
            <div class="text-[11px] text-slate-600 mb-2"><i class="fa-solid fa-location-dot ml-1 text-slate-400"></i>${item.address || ''}</div>
            <div class="flex items-center justify-between pt-1.5 border-t border-slate-200">
              <span class="text-[11px] font-bold text-amber-600">⭐ ${item.rating || '4.5'} (${item.reviews_count || 1})</span>
              <div class="flex items-center gap-1.5">
                ${websiteUrl ? `<a href="${websiteUrl}" target="_blank" class="text-[11px] text-slate-600 hover:text-rose-600" title="الموقع"><i class="fa-solid fa-globe"></i></a>` : ''}
                ${social ? `<a href="${social.url}" target="_blank" class="text-[11px]" title="${social.title}"><i class="${social.iconClass}"></i></a>` : ''}
                <a href="${item.google_maps_url}" target="_blank" class="text-[11px] font-bold text-rose-600 hover:underline">الاتجاهات ↗</a>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        newMarkers.push(marker);
      });

      // Bulk addition to marker cluster for fast rendering
      markersCluster.addLayers(newMarkers);

      if (shouldFitBounds && filteredRestaurants.length > 0) {
        const group = new L.featureGroup(newMarkers);
        if (group.getLayers().length > 0) {
          map.fitBounds(group.getBounds().pad(0.05));
        }
      }
    }

    // Center map on clicked item and open popup
    function focusOnRestaurant(id) {
      const item = restaurants.find(r => r && String(r.id) === String(id));
      if (!item) return;

      const lat = item.lat || item.coordinates?.lat;
      const lon = item.lon || item.coordinates?.lng;
      if (!lat || !lon) return;

      map.setView([lat, lon], 16, { animate: true });

      markersCluster.eachLayer(layer => {
        if (layer.getLatLng().lat === lat && layer.getLatLng().lng === lon) {
          layer.openPopup();
        }
      });
    }

    // Geolocation API - Near Me
    function getUserLocation() {
      if (!navigator.geolocation) {
        showToast('خاصية تحديد الموقع غير مدعومة في متصفحك.', 'warning');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          if (userMarker) {
            map.removeLayer(userMarker);
          }

          userMarker = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: '#3b82f6',
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(map);

          userMarker.bindPopup('<div dir="rtl" class="text-center font-bold text-blue-600 text-xs">موقعك الحالي 📍</div>').openPopup();

          map.setView([lat, lon], 14, { animate: true });

          // Sort restaurants by proximity to user
          filteredRestaurants.sort((a, b) => {
            const latA = a.lat || a.coordinates?.lat || 0;
            const lonA = a.lon || a.coordinates?.lng || 0;
            const latB = b.lat || b.coordinates?.lat || 0;
            const lonB = b.lon || b.coordinates?.lng || 0;
            const distA = Math.hypot(latA - lat, lonA - lon);
            const distB = Math.hypot(latB - lat, lonB - lon);
            return distA - distB;
          });

          renderList();
          showToast('تم ترتيب الأماكن حسب الأقرب لموقعك الحالي 📍', 'success');
        },
        (err) => {
          showToast('تعذر الوصول إلى موقعك الحالي. يرجى السماح بصلاحية الموقع.', 'warning');
        }
      );
    }

    // Modal Details Box
    function openDetailsModal(id) {
      const item = restaurants.find(r => r && String(r.id) === String(id));
      if (!item) return;

      const socialLinks = getSocialList(item);
      const websiteUrl = (item.website && !item.website.includes('facebook.com') && !item.website.includes('instagram.com')) ? item.website : '';
      const displayCategory = item.category || item.activity_type || 'مطعم';
      const displayDelegation = item.delegation || item.region || 'غير محدد';
      const displayIcon = item.icon || '🍽️';

      const servicesHtml = (item.services && item.services.length > 0)
        ? `<div class="pt-2 flex flex-wrap gap-1">
            ${item.services.map(s => `<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-medium"><i class="fa-solid fa-check text-emerald-500 ml-1"></i>${s}</span>`).join('')}
           </div>`
        : '';

      const websiteBtn = websiteUrl ? `
        <a href="${websiteUrl}" target="_blank" class="bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-bold py-2.5 px-3 rounded-xl text-center transition flex items-center justify-center gap-1.5 shrink-0">
          <i class="fa-solid fa-globe"></i>
          الموقع
        </a>
      ` : '';

      const socialRowsHtml = socialLinks.map(s => `
        <p class="flex items-center gap-2">
          <i class="${s.iconClass} w-4"></i>
          <strong>${s.title}:</strong> <a href="${s.url}" target="_blank" class="text-sky-600 dark:text-sky-400 hover:underline">زيارة صفحة ${s.title} ↗</a>
        </p>
      `).join('');

      const socialBtnsHtml = socialLinks.map(s => `
        <a href="${s.url}" target="_blank" class="bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 text-xs font-bold py-2.5 px-3 rounded-xl text-center transition flex items-center justify-center gap-1.5 shrink-0">
          <i class="${s.iconClass}"></i>
          ${s.title}
        </a>
      `).join('');

      const modalContent = document.getElementById('modal-content');
      modalContent.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl shrink-0">
            ${displayIcon}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white">${item.name || ''}</h3>
              ${item.is_featured ? '<span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 shrink-0"><i class="fa-solid fa-star text-[9px] ml-0.5"></i>مميز</span>' : ''}
            </div>
            <span class="text-xs text-rose-600 dark:text-rose-400 font-semibold">${displayCategory} • ${item.governorate || 'ولاية أريانة'}</span>
          </div>
        </div>

        <div class="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p class="flex items-center gap-2">
            <i class="fa-solid fa-map text-rose-500 w-4"></i>
            <strong>الولاية والمعتمدية:</strong> ${item.governorate || 'ولاية أريانة'} - ${displayDelegation}
          </p>
          <p class="flex items-center gap-2">
            <i class="fa-solid fa-location-dot text-rose-500 w-4"></i>
            <strong>العنوان التفصيلي:</strong> ${item.address || ''}
          </p>
          <p class="flex items-center gap-2">
            <i class="fa-solid fa-utensils text-rose-500 w-4"></i>
            <strong>نوع المطبخ:</strong> ${item.cuisine || (Array.isArray(item.cuisines) ? item.cuisines.join(' ') : 'تونسية')}
          </p>
          <p class="flex items-center gap-2">
            <i class="fa-solid fa-clock text-rose-500 w-4"></i>
            <strong>أوقات العمل:</strong> ${item.opening_hours || '08:00 - 23:00 (يومياً)'}
          </p>
          <p class="flex items-center gap-2">
            <i class="fa-solid fa-phone text-rose-500 w-4"></i>
            <strong>الهاتف:</strong> <span dir="ltr">${item.phone || 'غير متوفر'}</span>
          </p>
          ${item.email ? `
          <p class="flex items-center gap-2">
            <i class="fa-solid fa-envelope text-rose-500 w-4"></i>
            <strong>البريد الإلكتروني:</strong> <a href="mailto:${item.email}" class="text-rose-600 dark:text-rose-400 hover:underline" dir="ltr">${item.email}</a>
          </p>
          ` : ''}
          ${socialRowsHtml}
          <p class="flex items-center gap-2">
            <i class="fa-solid fa-star text-amber-500 w-4"></i>
            <strong>التقييم:</strong> ⭐ ${item.rating || '4.5'} من 5 (${item.reviews_count || 1} مراجعة)
          </p>
          ${servicesHtml}
        </div>

        <div class="pt-3 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <a href="${item.google_maps_url}" target="_blank" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl text-center transition flex items-center justify-center gap-1.5 min-w-[140px]">
            <i class="fa-solid fa-map-location-dot"></i>
            الاتجاهات عبر Google Maps
          </a>
          ${websiteBtn}
          ${socialBtnsHtml}
          ${item.phone ? `
          <a href="tel:${item.phone.replace(/\s+/g, '')}" class="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-100 text-xs font-bold py-2.5 px-3 rounded-xl text-center transition flex items-center justify-center gap-1.5 shrink-0">
            <i class="fa-solid fa-phone"></i>
            اتصال
          </a>
          ` : ''}
        </div>
      `;

      document.getElementById('details-modal').classList.remove('hidden');
    }

    function closeModal() {
      document.getElementById('details-modal').classList.add('hidden');
    }

