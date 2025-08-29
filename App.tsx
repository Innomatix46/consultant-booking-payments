

import React, { useState, useCallback, useEffect } from 'react';
import { Step, AppointmentDetails, ConsultationOption } from './types';
import Header from './components/Header';
import StepIndicator from './components/StepIndicator';
import DatePicker from './components/DatePicker';
import TimeSlotPicker from './components/TimeSlotPicker';
import UserInfoForm from './components/UserInfoForm';
import Payment from './components/Payment';
import Confirmation from './components/Confirmation';
import AdminDashboard from './components/AdminDashboard';
import LandingPage from './components/LandingPage';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import AppointmentTypePicker from './components/AppointmentTypePicker';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>(Step.SELECT_DATE);
  const [appointmentDetails, setAppointmentDetails] = useState<Partial<AppointmentDetails>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const consultationDuration = 30; 

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const checkoutDetailsRaw = localStorage.getItem('checkoutAppointmentDetails');

    if (paymentStatus && checkoutDetailsRaw) {
      try {
        const checkoutDetails = JSON.parse(checkoutDetailsRaw);
        
        if (paymentStatus === 'success') {
          // Add payment method and advance to confirmation
          setAppointmentDetails({ ...checkoutDetails, paymentMethod: 'Stripe' });
          setCurrentStep(Step.CONFIRMATION);
        } else if (paymentStatus === 'cancel') {
          // Restore state and return to payment screen
          setAppointmentDetails(checkoutDetails);
          setCurrentStep(Step.PAYMENT);
        }
      } catch (error) {
        console.error("Failed to parse checkout details from localStorage", error);
        // If parsing fails, restart the booking process to avoid a broken state
        restartBooking();
      } finally {
        localStorage.removeItem('checkoutAppointmentDetails');
        // Clean up URL for a better user experience and to prevent re-triggering
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const restartBooking = useCallback(() => {
    setAppointmentDetails({});
    setCurrentStep(Step.SELECT_DATE);
  }, []);

  const handleOpenLoginModal = () => setIsLoginModalOpen(true);
  const handleLogout = () => setIsAdmin(false);
  const handleLoginSuccess = () => {
    setIsAdmin(true);
    setIsLoginModalOpen(false);
  };

  const handleDateSelect = useCallback((date: Date) => {
    setAppointmentDetails(prev => ({ ...prev, date }));
    setCurrentStep(Step.SELECT_APPOINTMENT_TYPE);
  }, []);

  const handleAppointmentTypeSelect = useCallback((consultation: ConsultationOption, price: number) => {
    setAppointmentDetails(prev => ({ ...prev, consultation, price }));
    setCurrentStep(Step.SELECT_TIME);
  }, []);

  const handleTimeSelect = useCallback((time: string) => {
    setAppointmentDetails(prev => ({ ...prev, time }));
    setCurrentStep(Step.USER_DETAILS);
  }, []);

  const handleUserDetailsSubmit = useCallback((details: { name: string; email: string; whatsapp: string; }) => {
    setAppointmentDetails(prev => ({ ...prev, ...details }));
    setCurrentStep(Step.PAYMENT);
  }, []);

  const handlePaymentSuccess = useCallback((paymentMethod: string) => {
    setAppointmentDetails(prev => ({ ...prev, paymentMethod }));
    setCurrentStep(Step.CONFIRMATION);
  }, []);
  
  const goBack = useCallback(() => {
    setCurrentStep(prev => {
        if (prev === Step.CONFIRMATION) return Step.SELECT_DATE;
        return prev > 0 ? prev - 1 : 0;
    });
  }, []);

  const handleStartBooking = useCallback((consultation: ConsultationOption, price: number) => {
      setAppointmentDetails({ consultation, price });
      setCurrentStep(Step.SELECT_DATE);
  }, []);
  
  const handleStartGenericBooking = useCallback(() => {
    const placeholderConsultation: ConsultationOption = {
        id: 'generic_start',
        title: 'Consultation',
        description: 'Select your consultation type',
        priceKey: '',
        defaultPrice: '0'
    };
    setAppointmentDetails({ consultation: placeholderConsultation, price: 0 });
    setCurrentStep(Step.SELECT_DATE);
  }, []);

  const renderBookingSteps = () => {
    switch (currentStep) {
      case Step.SELECT_DATE:
        return <DatePicker onDateSelect={handleDateSelect} selectedDate={appointmentDetails.date} />;
      case Step.SELECT_APPOINTMENT_TYPE:
        return <AppointmentTypePicker
                onSelect={handleAppointmentTypeSelect}
                onBack={goBack}
                selectedConsultationId={appointmentDetails.consultation?.id}
            />;
      case Step.SELECT_TIME:
        return <TimeSlotPicker 
                    selectedDate={appointmentDetails.date!} 
                    selectedTime={appointmentDetails.time} 
                    onTimeSelect={handleTimeSelect} 
                    onBack={goBack}
                />;
      case Step.USER_DETAILS:
        return <UserInfoForm onSubmit={handleUserDetailsSubmit} onBack={goBack} initialData={appointmentDetails}/>;
      case Step.PAYMENT:
        return <Payment 
                  onPaymentSuccess={handlePaymentSuccess} 
                  onBack={goBack} 
                  price={appointmentDetails.price!} 
                  details={appointmentDetails}
                />;
      case Step.CONFIRMATION:
        return <Confirmation details={appointmentDetails as AppointmentDetails} onRestart={restartBooking} />;
      default:
        return <div>Unknown Step</div>;
    }
  };
  
  const isBookingFlowActive = !!appointmentDetails.consultation;

  return (
    <div className="min-h-screen bg-brand-light text-brand-dark font-sans flex flex-col">
      <Header 
        isAdmin={isAdmin} 
        onLoginClick={handleOpenLoginModal} 
        onLogout={handleLogout} 
        onGoHome={restartBooking}
      />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex-grow w-full">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
             <div className={
                isAdmin ? '' : 
                !isBookingFlowActive ? '' : "p-6 sm:p-8 lg:p-10"
              }>
              {isAdmin ? (
                <AdminDashboard />
              ) : !isBookingFlowActive ? (
                <LandingPage onStartBooking={handleStartBooking} onStartGenericBooking={handleStartGenericBooking} />
              ) : (
                <>
                  {currentStep !== Step.CONFIRMATION && (
                      <div className="mb-8">
                          <h2 className="text-2xl sm:text-3xl font-bold text-center text-brand-dark mb-2">
                            Book: <span className="text-brand-blue">{appointmentDetails.consultation!.title}</span>
                          </h2>
                          <p className="text-center text-gray-500">{consultationDuration}-minute consultation for €{appointmentDetails.price}</p>
                      </div>
                  )}
                  <div className="mb-10">
                      <StepIndicator currentStep={currentStep} />
                  </div>
                  <div className="transition-all duration-500">
                      {renderBookingSteps()}
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">Powered by Gemini Consulting</p>
      </main>
      <Footer />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default App;