const STORAGE_KEY = 'favoriteMosques';
const HOME_KEY = 'homeMosqueId';
const MAX_FAVORITES = 24;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && m.id && m.coordinates);
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_FAVORITES)));
  } catch {}
}

export function loadFavorites() {
  return read();
}

export function isFavorite(id) {
  if (!id) return false;
  return read().some((m) => m.id === id);
}

export function toggleFavorite(mosque) {
  if (!mosque?.id) return read();
  const list = read();
  const idx = list.findIndex((m) => m.id === mosque.id);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    // Strip distance — recomputed each session against the user's current origin.
    const { distanceMiles, ...rest } = mosque;
    list.unshift({ ...rest, savedAt: Date.now() });
  }
  write(list);
  return list;
}

export function removeFavorite(id) {
  const list = read().filter((m) => m.id !== id);
  write(list);
  return list;
}

export function loadHomeMosqueId() {
  try { return localStorage.getItem(HOME_KEY) || null; } catch { return null; }
}

export function setHomeMosqueId(id) {
  try {
    if (id) localStorage.setItem(HOME_KEY, id);
    else localStorage.removeItem(HOME_KEY);
  } catch {}
}
