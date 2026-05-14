import React, { useState } from 'react';
import { submitMosque, isVerifiedDbEnabled } from '../features/mosques/supabase';

const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export default function MosqueSubmitForm({ origin, prefill, onClose, onSubmitted }) {
  const enabled = isVerifiedDbEnabled();
  const [form, setForm] = useState(() => ({
    name: prefill?.name || '',
    address: prefill?.address || '',
    lat: prefill?.coordinates?.lat ?? origin?.lat ?? '',
    lng: prefill?.coordinates?.lng ?? origin?.lng ?? '',
    phone: prefill?.phone || '',
    website: prefill?.website || '',
    iqamah: prefill?.iqamah || { Fajr: '', Dhuhr: '', Asr: '', Maghrib: '', Isha: '' },
    jumuah: prefill?.jumuah?.[0]?.time || '',
    notes: '',
    submitterContact: '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function update(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updateIqamah(key, val) {
    setForm((f) => ({ ...f, iqamah: { ...f.iqamah, [key]: val } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!enabled) return;
    setError(null);
    if (!form.name.trim()) { setError('Mosque name is required.'); return; }
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError('Valid coordinates are required.');
      return;
    }
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      coordinates: { lat, lng },
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      iqamah: Object.fromEntries(
        Object.entries(form.iqamah).filter(([, v]) => String(v).trim()),
      ),
      jumuah: form.jumuah.trim() ? [{ time: form.jumuah.trim() }] : null,
      notes: form.notes.trim() || null,
      submitterContact: form.submitterContact.trim() || null,
    };
    const res = await submitMosque(payload);
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
      onSubmitted?.();
    } else {
      setError(res.error === 'submissions_unavailable'
        ? 'Submissions are not configured yet. Please try again later.'
        : 'Could not submit. Please try again.');
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Submit a mosque</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!enabled && (
          <p className="setting-hint mosque-form-disabled">
            Public submissions are not available in this build yet.
          </p>
        )}

        {done ? (
          <div className="mosque-form-done">
            <p>Thank you. Your submission is queued for review.</p>
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="mosque-form" onSubmit={handleSubmit}>
            <label className="mosque-form-label">
              <span>Mosque name *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
            </label>

            <label className="mosque-form-label">
              <span>Address</span>
              <input
                type="text"
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
              />
            </label>

            <div className="mosque-form-row">
              <label className="mosque-form-label">
                <span>Latitude *</span>
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => update('lat', e.target.value)}
                  required
                />
              </label>
              <label className="mosque-form-label">
                <span>Longitude *</span>
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => update('lng', e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="mosque-form-row">
              <label className="mosque-form-label">
                <span>Phone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </label>
              <label className="mosque-form-label">
                <span>Website</span>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                />
              </label>
            </div>

            <fieldset className="mosque-form-fieldset">
              <legend>Iqamah times</legend>
              <div className="mosque-iqamah-grid">
                {PRAYER_KEYS.map((p) => (
                  <label key={p} className="mosque-form-label">
                    <span>{p}</span>
                    <input
                      type="time"
                      value={form.iqamah[p] || ''}
                      onChange={(e) => updateIqamah(p, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mosque-form-label">
              <span>Jumu'ah time</span>
              <input
                type="time"
                value={form.jumuah}
                onChange={(e) => update('jumuah', e.target.value)}
              />
            </label>

            <label className="mosque-form-label">
              <span>Notes (languages, facilities, parking…)</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
              />
            </label>

            <label className="mosque-form-label">
              <span>Your contact (optional)</span>
              <input
                type="text"
                placeholder="Email or phone for follow-up"
                value={form.submitterContact}
                onChange={(e) => update('submitterContact', e.target.value)}
              />
            </label>

            {error && <p className="mosque-form-error">{error}</p>}

            <div className="mosque-form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-search"
                disabled={!enabled || submitting}
              >
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
