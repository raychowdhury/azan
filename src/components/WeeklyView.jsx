import React, { useState } from 'react';
import { formatTime, PRAYERS } from '../utils/prayers';
import { useT } from '../i18n';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const OBLIGATORY = PRAYERS.filter(p => p.obligatory);

export default function WeeklyView({ weeklyData, loading, use24h, onReload }) {
  const { t } = useT();
  const [selectedDay, setSelectedDay] = useState(null);

  if (loading) {
    return (
      <div className="status-msg">
        <div className="spinner" />
        <p>{t('status.loading')}</p>
      </div>
    );
  }

  if (!weeklyData) {
    return (
      <div className="status-msg">
        <p>{t('weekly.empty')}</p>
        {onReload && (
          <button type="button" className="btn btn-search" onClick={onReload} style={{ marginTop: 12 }}>
            {t('weekly.retry')}
          </button>
        )}
      </div>
    );
  }

  // Show only 7 days starting from today
  const todayNum = new Date().getDate();
  const monthData = Array.isArray(weeklyData) ? weeklyData : [];
  const todayIndex = monthData.findIndex(d => parseInt(d.date.gregorian.day) === todayNum);
  const week = monthData.slice(todayIndex >= 0 ? todayIndex : 0, (todayIndex >= 0 ? todayIndex : 0) + 7);

  const focusDay = selectedDay !== null ? week[selectedDay] : null;

  return (
    <div className="weekly-wrap">
      <h2 className="weekly-title">7-Day Schedule</h2>

      {/* Day selector strip */}
      <div className="day-strip">
        {week.map((day, i) => {
          const dateObj = new Date(day.date.gregorian.date.split('-').reverse().join('-'));
          const dayLabel = DAYS[dateObj.getDay()] ?? '–';
          const dayNum = day.date.gregorian.day;
          const isToday = i === 0;
          return (
            <button
              key={i}
              className={`day-btn ${selectedDay === i ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setSelectedDay(selectedDay === i ? null : i)}
            >
              <span className="day-label">{isToday ? 'Today' : dayLabel}</span>
              <span className="day-num">{dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* Expanded day detail */}
      {focusDay && (
        <div className="day-detail-card">
          <div className="day-detail-header">
            <span>{focusDay.date.readable}</span>
            <span className="day-detail-hijri">
              {focusDay.date.hijri.day} {focusDay.date.hijri.month.en} {focusDay.date.hijri.year}
            </span>
          </div>
          <div className="day-detail-prayers">
            {OBLIGATORY.map(p => (
              <div key={p.key} className="day-detail-row">
                <span className="day-detail-icon">{p.icon}</span>
                <span className="day-detail-name">{p.name}</span>
                <span className="day-detail-time">
                  {formatTime(focusDay.timings[p.key], use24h)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="weekly-table-wrap">
        <table className="weekly-table">
          <thead>
            <tr>
              <th>Day</th>
              {OBLIGATORY.map(p => (
                <th key={p.key}>{p.icon} {p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.map((day, i) => {
              const dateObj = new Date(day.date.gregorian.date.split('-').reverse().join('-'));
              const dayLabel = DAYS[dateObj.getDay()] ?? '–';
              const isToday = i === 0;
              return (
                <tr
                  key={i}
                  className={`${isToday ? 'today-row' : ''} ${selectedDay === i ? 'selected-row' : ''}`}
                  onClick={() => setSelectedDay(selectedDay === i ? null : i)}
                >
                  <td className="week-day-cell">
                    <span className="week-day-name">{isToday ? 'Today' : dayLabel}</span>
                    <span className="week-day-date">{day.date.gregorian.day}</span>
                  </td>
                  {OBLIGATORY.map(p => (
                    <td key={p.key} className="week-time-cell">
                      {formatTime(day.timings[p.key], use24h)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
