import React, { useState } from 'react';
import { formatTime, PRAYERS } from '../utils/prayers';

const OBLIGATORY = PRAYERS.filter(p => p.obligatory);

export default function WeeklyView({ weeklyData, loading, use24h, t }) {
  const [selectedDay, setSelectedDay] = useState(null);

  if (loading) {
    return (
      <div className="status-msg">
        <div className="spinner" />
        <p>{t('weekly.loading')}</p>
      </div>
    );
  }

  if (!weeklyData) {
    return (
      <div className="status-msg">
        <p>{t('weekly.empty')}</p>
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
      <h2 className="weekly-title">{t('weekly.title')}</h2>

      {/* Day selector strip */}
      <div className="day-strip">
        {week.map((day, i) => {
          const dateObj = new Date(day.date.gregorian.date.split('-').reverse().join('-'));
          const dayLabel = t(`weekday.short.${dateObj.getDay()}`);
          const dayNum = day.date.gregorian.day;
          const isToday = i === 0;
          return (
            <button
              key={i}
              className={`day-btn ${selectedDay === i ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setSelectedDay(selectedDay === i ? null : i)}
            >
              <span className="day-label">{isToday ? t('label.today') : dayLabel}</span>
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
                <span className="day-detail-name">{t(`prayer.${p.key}`)}</span>
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
              <th>{t('weekly.day')}</th>
              {OBLIGATORY.map(p => (
                <th key={p.key}>{p.icon} {t(`prayer.${p.key}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.map((day, i) => {
              const dateObj = new Date(day.date.gregorian.date.split('-').reverse().join('-'));
              const dayLabel = t(`weekday.short.${dateObj.getDay()}`);
              const isToday = i === 0;
              return (
                <tr
                  key={i}
                  className={`${isToday ? 'today-row' : ''} ${selectedDay === i ? 'selected-row' : ''}`}
                  onClick={() => setSelectedDay(selectedDay === i ? null : i)}
                >
                  <td className="week-day-cell">
                    <span className="week-day-name">{isToday ? t('label.today') : dayLabel}</span>
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
