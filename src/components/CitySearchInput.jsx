import React, { useEffect, useRef, useState } from 'react';
import { searchCities } from '../utils/api';

export default function CitySearchInput({
  value,
  onChange,
  onSubmit,
  onPickSuggestion,
  placeholder,
  inputRef,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const wrapRef = useRef(null);

  // Debounce + fetch on value change
  useEffect(() => {
    const q = (value || '').trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      const list = await searchCities(q, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setSuggestions(list);
        setLoading(false);
        setOpen(true);
        setActiveIdx(-1);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(s) {
    setOpen(false);
    setSuggestions([]);
    onPickSuggestion?.(s);
  }

  function onKeyDown(e) {
    if (!open || !suggestions.length) {
      if (e.key === 'Enter') onSubmit?.();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        e.preventDefault();
        pick(suggestions[activeIdx]);
      } else {
        onSubmit?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="city-search-wrap" ref={wrapRef}>
      <div className="search-input-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="address-level2"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          inputMode="search"
          enterKeyHint="search"
        />
        {loading && <span className="city-search-spinner" aria-hidden="true" />}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="city-search-list" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat},${s.lng}`}
              role="option"
              aria-selected={i === activeIdx}
              className={`city-search-item ${i === activeIdx ? 'active' : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              <div className="city-search-primary">
                {s.city}
                {s.region ? <span className="city-search-region">, {s.region}</span> : null}
              </div>
              <div className="city-search-secondary">{s.country}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
