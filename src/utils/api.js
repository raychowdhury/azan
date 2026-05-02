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

export async function fetchByCity(city, country, method) {
  const params = new URLSearchParams({ city, country: country || '', method });
  return request(`${BASE}/timingsByCity?${params}`, `City not found: "${city}". Try a different name.`);
}

export async function fetchByCoords(lat, lng, method) {
  const params = new URLSearchParams({ latitude: lat, longitude: lng, method });
  return request(`${BASE}/timings?${params}`, 'Could not fetch prayer times for your location.');
}

export async function fetchWeeklyByCity(city, country, method) {
  const now = new Date();
  const params = new URLSearchParams({
    city,
    country: country || '',
    method,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return request(`${BASE}/calendarByCity?${params}`, 'Could not fetch weekly prayer times.');
}

export async function fetchWeeklyByCoords(lat, lng, method) {
  const now = new Date();
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    method,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  return request(`${BASE}/calendar?${params}`, 'Could not fetch weekly prayer times.');
}
