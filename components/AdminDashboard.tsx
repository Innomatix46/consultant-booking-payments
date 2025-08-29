
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Availability, Booking, RecurringAvailability } from '../types';
import DatePicker from './DatePicker';
import { CONSULTATION_OPTIONS } from './consultationOptions';
import { ChevronDownIcon, ChevronUpIcon, TrashIcon, SparklesIcon } from './IconComponents';
import CVBuilder from './CVBuilder';

const MORNING_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
const AFTERNOON_SLOTS = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

const formatDateToKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

type SortableKeys = 'name' | 'date' | 'consultationTitle';
type SortDirection = 'ascending' | 'descending';
type AdminTab = 'bookings' | 'settings' | 'cv_builder';

interface SortConfig {
    key: SortableKeys;
    direction: SortDirection;
}

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('bookings');
    const [prices, setPrices] = useState<{[key: string]: string}>({});
    const [pricesChanged, setPricesChanged] = useState(false);
    const [availability, setAvailability] = useState<Availability>({}); // Date-specific overrides
    const [recurringAvailability, setRecurringAvailability] = useState<RecurringAvailability>({}); // Recurring schedule
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [notification, setNotification] = useState<string>('');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [activeDayIndex, setActiveDayIndex] = useState<number | null>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

    // State for the new bookings table
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    // State for cancellation modal
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);

    // State for AI Welcome Tips modal
    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
    const [selectedBookingForTips, setSelectedBookingForTips] = useState<Booking | null>(null);
    const [generatedTips, setGeneratedTips] = useState<string>('');
    const [isGeneratingTips, setIsGeneratingTips] = useState(false);

    // State for section visibility
    const [isRecurringScheduleVisible, setIsRecurringScheduleVisible] = useState(true);
    const [isSpecificDatesVisible, setIsSpecificDatesVisible] = useState(true);

    // Refs for auto-saving logic
    const notificationTimer = useRef<number | null>(null);
    const hasLoaded = useRef(false);

    useEffect(() => {
        // Load prices
        const storedPrices = localStorage.getItem('consultationPrices');
        const initialPrices: {[key: string]: string} = storedPrices ? JSON.parse(storedPrices) : {};
        // Ensure all options have a price, using default if not set
        CONSULTATION_OPTIONS.forEach(opt => {
            if (!initialPrices[opt.priceKey]) {
                initialPrices[opt.priceKey] = opt.defaultPrice;
            }
        });
        setPrices(initialPrices);

        // Load availability overrides
        try {
            const storedAvailability = localStorage.getItem('appointmentAvailability');
            if (storedAvailability) setAvailability(JSON.parse(storedAvailability));
        } catch (error) {
            console.error("Failed to parse availability from localStorage", error);
        }

        // Load recurring availability
        try {
            const storedRecurring = localStorage.getItem('recurringAppointmentAvailability');
            if (storedRecurring) setRecurringAvailability(JSON.parse(storedRecurring));
        } catch (error) {
            console.error("Failed to parse recurring availability from localStorage", error);
        }
        
        // Load bookings
        try {
            const storedBookings = localStorage.getItem('confirmedBookings');
            if (storedBookings) setBookings(JSON.parse(storedBookings));
        } catch (error) {
            console.error("Failed to parse bookings from localStorage", error);
        }
        
        const timer = setTimeout(() => {
            hasLoaded.current = true;
        }, 200);
        return () => clearTimeout(timer);
    }, []);
    
    const showNotification = (message: string) => {
        setNotification(message);
        setTimeout(() => setNotification(''), 3000);
    };

    const showDebouncedSaveNotification = useCallback((message: string) => {
        if (notificationTimer.current) {
            clearTimeout(notificationTimer.current);
        }
        notificationTimer.current = window.setTimeout(() => {
            showNotification(message);
        }, 1200);
    }, []);

    const handlePriceChange = (priceKey: string, value: string) => {
        setPrices(prev => ({ ...prev, [priceKey]: value }));
        setPricesChanged(true);
    };

    const handleSavePrices = () => {
        localStorage.setItem('consultationPrices', JSON.stringify(prices));
        setPricesChanged(false);
        showNotification('Prices updated successfully!');
    };

    const handleResetPrices = () => {
        const defaultPrices: { [key: string]: string } = {};
        CONSULTATION_OPTIONS.forEach(opt => {
            defaultPrices[opt.priceKey] = opt.defaultPrice;
        });
        setPrices(defaultPrices);
        setPricesChanged(true);
    };

    useEffect(() => {
        if (!hasLoaded.current) return;
        localStorage.setItem('appointmentAvailability', JSON.stringify(availability));
        showDebouncedSaveNotification('Settings saved!');
    }, [availability, showDebouncedSaveNotification]);

    useEffect(() => {
        if (!hasLoaded.current) return;
        localStorage.setItem('recurringAppointmentAvailability', JSON.stringify(recurringAvailability));
        showDebouncedSaveNotification('Settings saved!');
    }, [recurringAvailability, showDebouncedSaveNotification]);
    
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const getRecurringSlotsForDate = useCallback((date: Date): string[] => {
        const dayOfWeek = date.getDay(); // 0 for Sun, 1 for Mon...
        // Our recurringAvailability is 0=Mon, ..., 6=Sun so we need to map
        const recurringDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
        return recurringAvailability[recurringDayIndex] || [];
    }, [recurringAvailability]);

    const handleSlotToggle = (date: Date, slot: string) => {
        const dateKey = formatDateToKey(date);
        setAvailability(prev => {
            const currentSlots = prev[dateKey] ?? getRecurringSlotsForDate(date);
            const newSlots = currentSlots.includes(slot)
                ? currentSlots.filter(s => s !== slot)
                : [...currentSlots, slot].sort();
            return { ...prev, [dateKey]: newSlots };
        });
    };
    
    const handleRecurringSlotToggle = (dayIndex: number, slot: string) => {
        setRecurringAvailability(prev => {
            const currentSlots = prev[dayIndex] || [];
            const newSlots = currentSlots.includes(slot)
                ? currentSlots.filter(s => s !== slot)
                : [...currentSlots, slot].sort();
            return { ...prev, [dayIndex]: newSlots };
        });
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
    };
    
    const openCancelModal = (booking: Booking) => {
        setBookingToCancel(booking);
        setIsCancelModalOpen(true);
    };

    const closeCancelModal = () => {
        setBookingToCancel(null);
        setIsCancelModalOpen(false);
    };

    const handleDeleteBooking = () => {
        if (!bookingToCancel) return;
        const updatedBookings = bookings.filter(b => !(b.date === bookingToCancel.date && b.time === bookingToCancel.time));
        setBookings(updatedBookings);
        localStorage.setItem('confirmedBookings', JSON.stringify(updatedBookings));
        showNotification(`Booking for ${bookingToCancel.name} on ${bookingToCancel.date} has been canceled.`);
        closeCancelModal();
    };

    const openTipsModal = (booking: Booking) => {
        setSelectedBookingForTips(booking);
        setGeneratedTips(''); // Clear previous tips
        setIsTipsModalOpen(true);
    };

    const closeTipsModal = () => {
        setSelectedBookingForTips(null);
        setIsTipsModalOpen(false);
    };

    const generateWelcomeTips = async () => {
        if (!selectedBookingForTips || !process.env.API_KEY) {
            setGeneratedTips("API Key not configured. Please add your Gemini API key to the .env file.");
            return;
        }
        
        setIsGeneratingTips(true);
        setGeneratedTips('');

        try {
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
            const prompt = `Generate a short, friendly, and personalized welcome message for a client named ${selectedBookingForTips.name} who has booked a "${selectedBookingForTips.consultationTitle}" consultation for Germany. The message should be 2-3 sentences. Mention their appointment on ${selectedBookingForTips.date} at ${selectedBookingForTips.time}. Give one quick tip to prepare, like "think about your main questions" or "have your documents ready to discuss". Keep it encouraging.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            setGeneratedTips(response.text);

        } catch (error) {
            console.error("Error generating welcome tips:", error);
            setGeneratedTips("Sorry, I couldn't generate tips at this moment. Please try again later.");
        } finally {
            setIsGeneratingTips(false);
        }
    };

    const filteredAndSortedBookings = useMemo(() => {
        const filtered = bookings.filter(booking =>
            booking.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            booking.date.includes(searchTerm) ||
            booking.consultationTitle.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.sort((a, b) => {
            if (sortConfig.key === 'date') {
                const dateA = new Date(`${a.date}T${a.time}`);
                const dateB = new Date(`${b.date}T${b.time}`);
                if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            } else { // name or consultationTitle
                const valA = sortConfig.key === 'name' ? a.name : a.consultationTitle;
                const valB = sortConfig.key === 'name' ? b.name : b.consultationTitle;
                if (valA.toLowerCase() < valB.toLowerCase()) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA.toLowerCase() > valB.toLowerCase()) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            }
        });
    }, [bookings, searchTerm, sortConfig]);

    const handleSort = (key: SortableKeys) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const totalPages = Math.ceil(filteredAndSortedBookings.length / ITEMS_PER_PAGE);
    const paginatedBookings = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedBookings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAndSortedBookings, currentPage]);
    

    const selectedDateKey = formatDateToKey(selectedDate);
    const slotsForSelectedDate = availability[selectedDateKey] ?? getRecurringSlotsForDate(selectedDate);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'bookings':
                return (
                    <div className="p-6 sm:p-8 lg:p-10">
                        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                            <h2 className="text-2xl font-bold text-brand-dark mb-4">Confirmed Bookings ({bookings.length})</h2>
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Search by name, service, or date (YYYY-MM-DD)..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                                                Client Name {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('consultationTitle')}>
                                                Service Booked {sortConfig.key === 'consultationTitle' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('date')}>
                                                Date & Time {sortConfig.key === 'date' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paginatedBookings.length > 0 ? paginatedBookings.map((booking, index) => (
                                            <tr key={`${booking.date}-${booking.time}-${index}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.consultationTitle}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.date} at {booking.time}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                    <button onClick={() => openTipsModal(booking)} className="text-purple-600 hover:text-purple-900" title="Generate Welcome Tips"><SparklesIcon /></button>
                                                    <button onClick={() => openCancelModal(booking)} className="text-red-600 hover:text-red-900" title="Cancel Booking"><TrashIcon /></button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No bookings found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex justify-between items-center mt-4">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 disabled:opacity-50">Previous</button>
                                    <span>Page {currentPage} of {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border border-gray-300 disabled:opacity-50">Next</button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'settings':
                return (
                    <div className="p-6 sm:p-8 lg:p-10 space-y-12">
                        <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
                            <h2 className="text-2xl font-bold text-brand-dark mb-4">Consultation Prices (€)</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {CONSULTATION_OPTIONS.map(option => (
                                    <div key={option.id}>
                                        <label htmlFor={option.priceKey} className="block text-sm font-medium text-gray-700">
                                            {option.title}
                                        </label>
                                        <input
                                            type="number"
                                            id={option.priceKey}
                                            value={prices[option.priceKey] || ''}
                                            onChange={(e) => handlePriceChange(option.priceKey, e.target.value)}
                                            className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                                            placeholder={`e.g., ${option.defaultPrice}`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t border-gray-200 gap-4">
                                <button
                                    onClick={handleResetPrices}
                                    className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors w-full sm:w-auto"
                                >
                                    Reset to Defaults
                                </button>
                                <button
                                    onClick={handleSavePrices}
                                    disabled={!pricesChanged}
                                    className="bg-brand-blue text-white font-semibold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
                                >
                                    Save Prices
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-4">
                                Changes to availability are saved automatically. Remember to save any price changes.
                            </p>
                        </div>
                        <div className="space-y-8">
                             <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
                                <button onClick={() => setIsRecurringScheduleVisible(!isRecurringScheduleVisible)} className={`flex justify-between items-center w-full ${isRecurringScheduleVisible ? 'mb-4' : ''}`}>
                                    <h3 className="text-xl font-bold text-brand-dark">Set Your Recurring Weekly Schedule</h3>
                                    {isRecurringScheduleVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                </button>
                                {isRecurringScheduleVisible && (
                                    <div className="animate-fade-in">
                                        <p className="text-sm text-gray-600 mb-4">This is your default availability. You can override specific dates below.</p>
                                        <div className="space-y-2">
                                            {weekDays.map((day, index) => {
                                                const isOpen = activeDayIndex === index;
                                                return (
                                                    <div key={day} className="border border-gray-200 rounded-lg">
                                                        <button
                                                            className={`flex items-center justify-between w-full p-4 text-left font-semibold text-brand-dark transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-opacity-50 ${isOpen ? 'rounded-t-lg bg-sky-50' : 'rounded-lg bg-white'}`}
                                                            onClick={() => setActiveDayIndex(isOpen ? null : index)}
                                                            aria-expanded={isOpen}
                                                            aria-controls={`panel-${index}`}
                                                        >
                                                            <span>{day}</span>
                                                            <ChevronDownIcon className={`w-5 h-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                                        </button>
                                                        {isOpen && (
                                                            <div id={`panel-${index}`} className="p-4 bg-white border-t border-gray-200 rounded-b-lg animate-fade-in">
                                                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                                    {ALL_SLOTS.map(slot => (
                                                                        <button key={slot} onClick={() => handleRecurringSlotToggle(index, slot)} className={`p-2 rounded text-sm font-medium transition-colors ${recurringAvailability[index]?.includes(slot) ? 'bg-brand-blue text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                                                            {slot}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
                                <button onClick={() => setIsSpecificDatesVisible(!isSpecificDatesVisible)} className={`flex justify-between items-center w-full ${isSpecificDatesVisible ? 'mb-4' : ''}`}>
                                    <h3 className="text-xl font-bold text-brand-dark">Override Availability for Specific Dates</h3>
                                    {isSpecificDatesVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                </button>
                                {isSpecificDatesVisible && (
                                    <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="font-semibold text-center mb-2">Select a date</h4>
                                            <DatePicker onDateSelect={handleDateSelect} selectedDate={selectedDate} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-center mb-2">Available slots for <span className="text-brand-blue">{selectedDate.toLocaleDateString()}</span></h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
                                                {ALL_SLOTS.map(slot => (
                                                    <button key={slot} onClick={() => handleSlotToggle(selectedDate, slot)} className={`p-2 rounded text-sm font-medium transition-colors ${slotsForSelectedDate.includes(slot) ? 'bg-brand-blue text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                                        {slot}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">Note: Times shown are based on the recurring schedule. Clicking a time slot will add or remove it as an override for this specific date.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'cv_builder':
                return <CVBuilder />;
            default:
                return null;
        }
    };
    
    const TabButton: React.FC<{ tabName: AdminTab; currentTab: AdminTab; children: React.ReactNode; }> = ({ tabName, currentTab, children }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none ${
                currentTab === tabName
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            aria-current={currentTab === tabName ? 'page' : undefined}
        >
            {children}
        </button>
    );

    return (
        <div>
            {notification && (
                <div className="fixed top-20 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in z-50">
                    {notification}
                </div>
            )}
            
            <div className="border-b border-gray-200 bg-gray-50/80">
                <nav className="-mb-px flex space-x-8 px-8" aria-label="Tabs">
                    <TabButton tabName="bookings" currentTab={activeTab}>Bookings</TabButton>
                    <TabButton tabName="settings" currentTab={activeTab}>Settings</TabButton>
                    <TabButton tabName="cv_builder" currentTab={activeTab}>CV Builder</TabButton>
                </nav>
            </div>

            <div>
                {renderTabContent()}
            </div>
            
            {isCancelModalOpen && bookingToCancel && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold">Confirm Cancellation</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            Are you sure you want to cancel the appointment for <strong>{bookingToCancel.name}</strong> on {bookingToCancel.date} at {bookingToCancel.time}? This action cannot be undone.
                        </p>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={closeCancelModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium">Cancel</button>
                            <button onClick={handleDeleteBooking} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium">Yes, Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isTipsModalOpen && selectedBookingForTips && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                        <h3 className="text-lg font-bold">Generate Welcome Tips for {selectedBookingForTips.name}</h3>
                        <div className="mt-4">
                            <button onClick={generateWelcomeTips} disabled={isGeneratingTips} className="w-full flex justify-center items-center bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400">
                                {isGeneratingTips ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <><SparklesIcon className="mr-2" /> Generate with AI</>
                                )}
                            </button>
                        </div>
                        {generatedTips && (
                            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                                <h4 className="font-semibold text-gray-800">Generated Message:</h4>
                                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{generatedTips}</p>
                            </div>
                        )}
                        <div className="mt-6 flex justify-end">
                            <button onClick={closeTipsModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
