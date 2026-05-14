import React, { useMemo, useState } from 'react';
import { toHijri } from '../features/hijri/converter';
import { eventForHijriDate } from '../features/hijri/events';

function buildMonth(offsetDays) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstWeekday = start.getDay();
  const cells = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() - firstWeekday + i);
    const hijri = toHijri(date, offsetDays);
    const event = eventForHijriDate(hijri.month, hijri.day);
    cells.push({
      date,
      hijri,
      event,
      isCurrentMonth: date.getMonth() === today.getMonth(),
      isToday: date.toDateString() === today.toDateString(),
    });
  }

  return cells;
}

export default function HijriCalendar({ offsetDays = 0, onOffsetChange, t }) {
  const [selectedCell, setSelectedCell] = useState(null);
  const cells = useMemo(() => buildMonth(offsetDays), [offsetDays]);
  const todayHijri = toHijri(new Date(), offsetDays);
  const selected = selectedCell?.event ? selectedCell : null;

  return (
    <div className="hijri-wrap">
      <div className="feature-header-row">
        <div>
          <h2 className="weekly-title">{t('hijri.title')}</h2>
          <p className="feature-subtitle">
            {t('hijri.date', { day: todayHijri.day, month: todayHijri.monthNameEn, year: todayHijri.year })}
          </p>
        </div>
        <div className="offset-control" aria-label={t('hijri.offset')}>
          <button onClick={() => onOffsetChange(Math.max(-2, offsetDays - 1))}>−</button>
          <span>{offsetDays > 0 ? `+${offsetDays}` : offsetDays}</span>
          <button onClick={() => onOffsetChange(Math.min(2, offsetDays + 1))}>+</button>
        </div>
      </div>

      <div className="calendar-grid">
        {Array.from({ length: 7 }).map((_, day) => (
          <div key={day} className="calendar-weekday">{t(`weekday.short.${day}`)}</div>
        ))}
        {cells.map((cell, index) => (
          <button
            key={`${cell.date.toISOString()}-${index}`}
            className={`calendar-cell ${cell.isCurrentMonth ? '' : 'muted'} ${cell.isToday ? 'today' : ''} ${cell.event ? 'event' : ''}`}
            onClick={() => setSelectedCell(cell)}
          >
            <span className="gregorian-day">{cell.date.getDate()}</span>
            <span className="hijri-day">{cell.hijri.day}</span>
            {cell.event && <span className="event-dot">{cell.event.icon}</span>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="event-detail-card">
          <div className="event-icon">{selected.event.icon}</div>
          <div>
            <h3>{selected.event.nameEn}</h3>
            <p className="event-ar">{selected.event.nameAr}</p>
            <p className="feature-subtitle">
              {t('hijri.date', { day: selected.hijri.day, month: selected.hijri.monthNameEn, year: selected.hijri.year })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
