const BASE = 'https://api.aladhan.com/v1';

export async function fetchByCity(city, country, method) {
  const params = new URLSearchParams({ city, country: country || '', method });
  const res = await fetch(`${BASE}/timingsByCity?${params}`);
  const data = await res.json();
  if (data.code === 200) return data.data;
  throw new Error(`City not found: "${city}". Try a different name.`);
}

export async function fetchByCoords(lat, lng, method) {
  const params = new URLSearchParams({ latitude: lat, longitude: lng, method });
  const res = await fetch(`${BASE}/timings?${params}`);
  const data = await res.json();
  if (data.code === 200) return data.data;
  throw new Error('Could not fetch prayer times for your location.');
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
  const res = await fetch(`${BASE}/calendarByCity?${params}`);
  const data = await res.json();
  if (data.code === 200) return data.data;
  throw new Error('Could not fetch weekly prayer times.');
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
  const res = await fetch(`${BASE}/calendar?${params}`);
  const data = await res.json();
  if (data.code === 200) return data.data;
  throw new Error('Could not fetch weekly prayer times.');
}
