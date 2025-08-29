
import React, { useMemo } from 'react';
import { Booking } from '../types';

interface TimeSlotPickerProps {
  selectedDate: Date;
  selectedTime?: string;
  onTimeSelect: (time: string) => void;
  onBack: () => void;
}

const formatDateToKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getBookedSlotsForDate = (date: Date): string[] => {
    try {
        const storedBookings = localStorage.getItem('confirmedBookings');
        if (!storedBookings) {
            return [];
        }
        const allBookings: Booking[] = JSON.parse(storedBookings);
        const dateKey = formatDateToKey(date);
        return allBookings
            .filter(booking => booking.date === dateKey)
            .map(booking => booking.time);

    } catch (error) {
        console.error("Failed to parse bookings from localStorage", error);
        return [];
    }
};

const getAvailableSlotsFromStorage = (date: Date): string[] => {
    try {
        const storedOverrides = localStorage.getItem('appointmentAvailability');
        const storedRecurring = localStorage.getItem('recurringAppointmentAvailability');
        
        const overrides = storedOverrides ? JSON.parse(storedOverrides) : {};
        const recurring = storedRecurring ? JSON.parse(storedRecurring) : {};
        
        const dateKey = formatDateToKey(date);
        
        // 1. Check for a specific date override first.
        if (overrides[dateKey] !== undefined) {
            return overrides[dateKey];
        }

        // 2. Fallback to the recurring schedule for the corresponding day of the week.
        const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday...
        const recurringDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Map to Mon-Sun (0-6)
        if (recurring[recurringDayIndex]) {
            return recurring[recurringDayIndex];
        }

        // 3. If no availability is set for this date or day of the week, return empty.
        return [];

    } catch (error) {
        console.error("Failed to parse availability from localStorage", error);
        return [];
    }
};


const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({ selectedDate, selectedTime, onTimeSelect, onBack }) => {

  const availableSlots = useMemo(() => {
    const allPossibleSlots = getAvailableSlotsFromStorage(selectedDate);
    const bookedSlots = getBookedSlotsForDate(selectedDate);
    return allPossibleSlots.filter(slot => !bookedSlots.includes(slot));
  }, [selectedDate]);

  return (
    <div className="max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-center mb-4">
        Select a time for: <span className="text-brand-blue">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
      </h3>
      {availableSlots.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {availableSlots.map(time => (
            <button
                key={time}
                onClick={() => onTimeSelect(time)}
                className={`
                p-3 rounded-lg border-2 text-center font-semibold transition-all duration-200
                ${selectedTime === time 
                    ? 'bg-brand-blue text-white border-brand-blue shadow-lg' 
                    : 'bg-white text-brand-blue border-gray-200 hover:border-brand-blue hover:shadow-md'
                }`}
            >
                {time}
            </button>
            ))}
        </div>
      ) : (
          <div className="text-center py-8 px-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600 font-medium">Sorry, no appointments are available for this day.</p>
              <p className="text-sm text-gray-500 mt-1">All slots may be booked or the consultant is unavailable.</p>
          </div>
      )}
      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="bg-gray-200 text-gray-800 font-semibold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default TimeSlotPicker;