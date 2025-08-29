

import React, { useEffect } from 'react';
import { AppointmentDetails, Booking } from '../types';
import { CalendarIcon, ClockIcon, WhatsAppIcon, GoogleCalendarIcon, UserIcon, BriefcaseIcon } from './IconComponents';

interface ConfirmationProps {
  details: AppointmentDetails;
  onRestart: () => void;
}

const Confirmation: React.FC<ConfirmationProps> = ({ details, onRestart }) => {
  useEffect(() => {
    const formatDateToKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const newBooking: Booking = {
        name: details.name,
        date: formatDateToKey(details.date),
        time: details.time,
        consultationTitle: details.consultation.title,
    };

    try {
        const existingBookingsRaw = localStorage.getItem('confirmedBookings');
        const existingBookings: Booking[] = existingBookingsRaw ? JSON.parse(existingBookingsRaw) : [];
        
        // Avoid adding duplicate bookings if user refreshes the page
        const isDuplicate = existingBookings.some(
            b => b.date === newBooking.date && b.time === newBooking.time
        );

        if (!isDuplicate) {
            const updatedBookings = [...existingBookings, newBooking];
            localStorage.setItem('confirmedBookings', JSON.stringify(updatedBookings));
        }

    } catch (error) {
        console.error("Failed to save booking to localStorage", error);
    }
  }, [details]);


  // A placeholder for the consultant's WhatsApp number (must be in international format without '+', spaces, or dashes)
  const consultantWhatsAppNumber = '4917655382575'; 

  const appointmentDate = details.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const appointmentTime = details.time;

  const message = `Hi, I'm confirming my '${details.consultation.title}' consultation for ${appointmentDate} at ${appointmentTime}. My name is ${details.name}.`;
  
  const whatsappUrl = `https://wa.me/${consultantWhatsAppNumber}?text=${encodeURIComponent(message)}`;

  const generateGoogleCalendarLink = () => {
    const [hours, minutes] = details.time.split(':').map(Number);
    
    const startDateTime = new Date(details.date);
    startDateTime.setHours(hours, minutes, 0, 0);

    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);

    const formatDateForGoogle = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d{3}/g, '');
    };

    const googleCalendarTimes = `${formatDateForGoogle(startDateTime)}/${formatDateForGoogle(endDateTime)}`;
    
    const eventTitle = encodeURIComponent(`Consultation: ${details.consultation.title}`);
    const eventDetails = encodeURIComponent(`Your 30-minute consultation call.\nThe consultant will call you via WhatsApp: ${details.whatsapp}`);
    const eventLocation = encodeURIComponent(`WhatsApp Video Call`);
    
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${googleCalendarTimes}&details=${eventDetails}&location=${eventLocation}`;
  };

  return (
    <div className="text-center max-w-lg mx-auto">
        <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      <h2 className="mt-4 text-3xl font-bold text-brand-dark">Appointment Confirmed!</h2>
      <p className="mt-2 text-gray-600">
        Thank you for your booking. Your consultation is scheduled.
      </p>

      <div className="mt-8 text-left bg-gray-50 p-6 rounded-xl border border-gray-200">
        <h3 className="text-xl font-bold text-brand-dark text-center mb-6">Your Appointment Details</h3>
        <div className="space-y-4">
             <div className="bg-white p-4 rounded-lg border border-gray-200 flex items-center">
                <BriefcaseIcon />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Service</p>
                    <p className="text-md font-semibold text-brand-dark">{details.consultation.title}</p>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex items-center">
                <CalendarIcon />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Date</p>
                    <p className="text-md font-semibold text-brand-dark">{appointmentDate}</p>
                </div>
            </div>
             <div className="bg-white p-4 rounded-lg border border-gray-200 flex items-center">
                <ClockIcon />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Time</p>
                    <p className="text-md font-semibold text-brand-dark">{details.time}</p>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex items-center">
                <WhatsAppIcon className="w-6 h-6 text-green-500" />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">WhatsApp Number for Call</p>
                    <p className="text-md font-semibold text-brand-dark">{details.whatsapp}</p>
                </div>
            </div>
             <div className="bg-white p-4 rounded-lg border border-gray-200 flex items-center">
                <UserIcon />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="text-md font-semibold text-brand-dark">{details.name}</p>
                </div>
            </div>
             <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-start">
                    <div className="pt-1 text-green-600">
                        <WhatsAppIcon />
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="font-semibold text-gray-800">Important: Next Step</p>
                        <p className="text-sm text-gray-600 mt-1">
                           Our consultant will call you on the number above at the scheduled time. Please send a quick confirmation message so we have your contact saved.
                        </p>
                        <a 
                            href={whatsappUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-3 bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors text-sm shadow-sm"
                        >
                            <WhatsAppIcon className="w-5 h-5 mr-2"/>
                            <span>Send Confirmation Message</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <div className="border-t border-gray-200 my-6"></div>
        
        <a 
            href={generateGoogleCalendarLink()}
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center bg-white text-brand-dark font-semibold py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-100 hover:border-brand-blue transition-colors text-sm shadow-sm"
        >
            <GoogleCalendarIcon />
            <span>Add to Google Calendar</span>
        </a>
      </div>
      
      <p className="mt-6 text-sm text-gray-500">
        A confirmation email has been sent to {details.email}. Please also check your spam folder.
      </p>

      <div className="mt-10">
        <button
          onClick={onRestart}
          className="bg-brand-blue text-white font-semibold py-3 px-8 rounded-lg hover:bg-opacity-90 transition-colors shadow-md"
        >
          Book Another Appointment
        </button>
      </div>
    </div>
  );
};

export default Confirmation;