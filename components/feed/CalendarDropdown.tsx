'use client';

import { useState } from 'react';

interface CalendarDropdownProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
}

export default function CalendarDropdown({ selectedDate, onDateSelect, minDate }: CalendarDropdownProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = selectedDate || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const today = new Date();
  const minDateValue = minDate || today;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Adjust for Monday as first day (Angular uses startingDay: 1)
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  // Get previous month's last days for padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  const days: (number | null)[] = [];
  
  // Add previous month's trailing days
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    days.push(null);
  }
  
  // Add current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleDateClick = (day: number) => {
    const selected = new Date(year, month, day);
    if (selected >= minDateValue) {
      onDateSelect(selected);
    }
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(year, month, day);
    return date < minDateValue;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const isSelectedDate = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  return (
    <ul
      className="dropdown-menu custom"
      style={{
        display: 'block',
        position: 'absolute',
        top: '18px',
        left: '0',
        width: '252px',
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '10px',
        zIndex: 9999,
        listStyle: 'none',
        margin: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Month/Year header */}
      <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #e0e0e0' }}>
        <button
          type="button"
          onClick={goToPreviousMonth}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
          }}
        >
          ‹
        </button>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px 8px',
          }}
        >
          ›
        </button>
      </li>

      {/* Day names header */}
      <li style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
        {dayNames.map((day) => (
          <div key={day} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#666', padding: '4px 0' }}>
            {day}
          </div>
        ))}
      </li>

      {/* Calendar grid */}
      <li style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} style={{ padding: '8px', textAlign: 'center' }} />;
          }

          const disabled = isDateDisabled(day);
          const selected = isSelectedDate(day);
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

          return (
            <button
              key={day}
              type="button"
              onClick={() => !disabled && handleDateClick(day)}
              disabled={disabled}
              style={{
                padding: '8px',
                textAlign: 'center',
                border: selected ? '2px solid #4183d7' : '1px solid transparent',
                background: selected ? '#4183d7' : isToday ? '#f0f0f0' : 'transparent',
                color: disabled ? '#ccc' : selected ? '#fff' : '#333',
                cursor: disabled ? 'not-allowed' : 'pointer',
                borderRadius: '3px',
                fontSize: '12px',
                minWidth: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !selected) {
                  e.currentTarget.style.background = '#f4f4f4';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled && !selected) {
                  e.currentTarget.style.background = isToday ? '#f0f0f0' : 'transparent';
                }
              }}
            >
              {day}
            </button>
          );
        })}
      </li>
    </ul>
  );
}


