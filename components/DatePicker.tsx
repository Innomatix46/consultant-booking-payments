import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './IconComponents';

interface DatePickerProps {
  onDateSelect: (date: Date) => void;
  selectedDate?: Date;
}

const DatePicker: React.FC<DatePickerProps> = ({ onDateSelect, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const endDate = new Date(endOfMonth);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days: Date[] = [];
  let day = new Date(startDate);
  while (day <= endDate) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const isSelected = (d: Date) => selectedDate && d.toDateString() === selectedDate.toDateString();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const isPast = (d: Date) => d < today;
  const isOtherMonth = (d: Date) => d.getMonth() !== currentMonth.getMonth();

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50" disabled={currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth()}>
          <ChevronLeftIcon />
        </button>
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100">
          <ChevronRightIcon />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="font-medium text-gray-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 mt-2">
        {days.map(d => (
          <button
            key={d.toISOString()}
            onClick={() => onDateSelect(d)}
            disabled={isPast(d) || isOtherMonth(d)}
            className={`
              w-12 h-12 rounded-full transition-colors duration-200
              ${ isPast(d) ? 'text-gray-400 cursor-not-allowed line-through' 
                : isOtherMonth(d) ? 'text-gray-300 cursor-not-allowed'
                : 'hover:bg-brand-blue hover:text-white font-medium'
              }
              ${isSelected(d) ? 'bg-brand-blue text-white font-bold' : ''}
              ${!isSelected(d) && isToday(d) && !isOtherMonth(d) ? 'bg-sky-100 text-brand-blue' : ''}
            `}
          >
            {d.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DatePicker;