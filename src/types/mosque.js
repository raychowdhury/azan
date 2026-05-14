/**
 * @typedef {'osm' | 'google_places' | 'verified_db'} MosqueSource
 *
 * @typedef {{ lat: number, lng: number }} GeoPoint
 *
 * @typedef {Object} IqamahTimes
 * @property {string} [Fajr]
 * @property {string} [Dhuhr]
 * @property {string} [Asr]
 * @property {string} [Maghrib]
 * @property {string} [Isha]
 *
 * @typedef {Object} JumuahService
 * @property {string} time     - "13:30"
 * @property {string} [khateeb]
 * @property {string} [language]
 *
 * @typedef {Object} NearbyMosque
 * @property {string} id
 * @property {MosqueSource} source
 * @property {string} name
 * @property {GeoPoint} coordinates
 * @property {number} distanceMiles
 * @property {string} [address]
 * @property {string} [phone]
 * @property {string} [website]
 * @property {string} [sourceUrl]
 * @property {boolean} [verified]
 * @property {IqamahTimes} [iqamah]
 * @property {JumuahService[]} [jumuah]
 * @property {string[]} [languages]
 * @property {string[]} [facilities]
 * @property {string} [submissionId]
 * @property {string} [notes]
 */

export const RADIUS_OPTIONS_MILES = [1, 3, 5, 10];
export const DEFAULT_RADIUS_MILES = 5;
export const MILES_TO_METERS = 1609.344;
export const PROVIDER_TIMEOUT_MS = 15000;        // total budget per provider
export const PER_ENDPOINT_TIMEOUT_MS = 12000;    // per Overpass endpoint attempt (parallel race)
export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

export const MOSQUE_SOURCES = Object.freeze({
  OSM: 'osm',
  GOOGLE_PLACES: 'google_places',
  VERIFIED_DB: 'verified_db',
});
