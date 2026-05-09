const BASE = 'https://api.aladhan.com/v1';
const TIMEOUT_MS = 10000;

async function request(url, errMsg) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${errMsg} (HTTP ${res.status})`);
    const data = await res.json();
    if (data.code !== 200) throw new Error(errMsg);
    return data.data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Network timeout. Check your connection.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchByCity(city, country, method, school = '0') {
  const params = new URLSearchParams({ city, country: country || '', method, school });
  return request(`${BASE}/timingsByCity?${params}`, `City not found: "${city}". Try a different name.`);
}

export async function fetchByCoords(lat, lng, method, school = '0') {
  const params = new URLSearchParams({ latitude: lat, longitude: lng, method, school });
  return request(`${BASE}/timings?${params}`, 'Could not fetch prayer times for your location.');
}

export async function fetchWeeklyByCity(city, country, method, school = '0') {
  const now = new Date();
  const params = new URLSearchParams({
    city,
    country: country || '',
    method,
    school,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return request(`${BASE}/calendarByCity?${params}`, 'Could not fetch weekly prayer times.');
}

export async function fetchWeeklyByCoords(lat, lng, method, school = '0') {
  const now = new Date();
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    method,
    school,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return request(`${BASE}/calendar?${params}`, 'Could not fetch weekly prayer times.');
}

// Nominatim (OpenStreetMap) city autocomplete. Free, no API key.
// Rate-limited to ~1 req/sec — caller should debounce.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export async function searchCities(query, signal) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    'accept-language': 'en',
    limit: '6',
    featuretype: 'city',
  });
  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json
      .map((row) => {
        const a = row.address || {};
        const city = a.city || a.town || a.village || a.municipality || a.hamlet || row.name;
        const region = a.state || a.region || a.county;
        const country = a.country;
        if (!city || !country) return null;
        return {
          city,
          region,
          country,
          countryCode: a.country_code ? String(a.country_code).toUpperCase() : '',
          lat: Number(row.lat),
          lng: Number(row.lon),
          displayName: row.display_name,
        };
      })
      .filter(Boolean);
  } catch (e) {
    if (e.name === 'AbortError') return [];
    return [];
  }
}
