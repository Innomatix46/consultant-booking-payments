import React, { useState, useEffect } from 'react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { StripePaymentForm } from './StripePaymentForm';
import { PaystackPaymentForm } from './PaystackPaymentForm';
import { PaymentConfirmation } from './PaymentConfirmation';
import { PaymentSuccess } from './PaymentSuccess';
import { PaymentError } from './PaymentError';
import { LoadingSpinner } from '../LoadingSpinner';
import { AppointmentDetails } from '../../types';

export type PaymentMethod = 'stripe' | 'paystack' | null;
export type PaymentStep = 'select' | 'form' | 'processing' | 'confirmation' | 'success' | 'error';

interface PaymentFormProps {
  onPaymentSuccess: (paymentData: PaymentSuccessData) => void;
  onBack: () => void;
  price: number;
  details: Partial<AppointmentDetails>;
}

export interface PaymentSuccessData {
  paymentMethod: string;
  transactionId: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export interface PaymentData {
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  metadata?: Record<string, any>;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ 
  onPaymentSuccess, 
  onBack, 
  price, 
  details 
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [currentStep, setCurrentStep] = useState<PaymentStep>('select');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successData, setSuccessData] = useState<PaymentSuccessData | null>(null);

  useEffect(() => {
    // Initialize payment data
    setPaymentData({
      amount: price,
      currency: 'EUR',
      description: `Consultation: ${details.consultation?.title || 'Immigration Consultation'}`,
      customerEmail: details.email || '',
      customerName: details.name || '',
      metadata: {
        appointmentType: details.consultation?.title,
        appointmentDate: details.date,
        appointmentTime: details.time,
      }
    });
  }, [price, details]);

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setCurrentStep('form');
    setErrorMessage('');
  };

  const handlePaymentSubmit = async (formData: any) => {
    setCurrentStep('processing');
    setErrorMessage('');

    try {
      // The actual payment processing will be handled by the specific payment form components
      // This is just to track the flow
    } catch (error) {
      console.error('Payment submission error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Payment failed');
      setCurrentStep('error');
    }
  };

  const handlePaymentComplete = (data: PaymentSuccessData) => {
    setSuccessData(data);
    setCurrentStep('success');
    // Delay callback to show success message
    setTimeout(() => {
      onPaymentSuccess(data);
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    setErrorMessage(error);
    setCurrentStep('error');
  };

  const handleRetry = () => {
    setCurrentStep('form');
    setErrorMessage('');
  };

  const handleBackToMethod = () => {
    setCurrentStep('select');
    setSelectedMethod(null);
    setErrorMessage('');
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select':
        return (
          <PaymentMethodSelector
            onMethodSelect={handleMethodSelect}
            onBack={onBack}
          />
        );

      case 'form':
        if (!selectedMethod || !paymentData) return null;
        
        return selectedMethod === 'stripe' ? (
          <StripePaymentForm
            paymentData={paymentData}
            onSuccess={handlePaymentComplete}
            onError={handlePaymentError}
            onBack={handleBackToMethod}
          />
        ) : (
          <PaystackPaymentForm
            paymentData={paymentData}
            onSuccess={handlePaymentComplete}
            onError={handlePaymentError}
            onBack={handleBackToMethod}
          />
        );

      case 'processing':
        return (
          <div className="text-center py-12">
            <LoadingSpinner size="large" />
            <h3 className="text-xl font-semibold mt-4 mb-2">Processing Payment</h3>
            <p className="text-gray-600">Please wait while we process your payment...</p>
            <p className="text-sm text-gray-500 mt-2">Do not refresh or close this page</p>
          </div>
        );

      case 'confirmation':
        return (
          <PaymentConfirmation
            paymentData={paymentData!}
            selectedMethod={selectedMethod!}
            onConfirm={handlePaymentSubmit}
            onBack={handleBackToMethod}
          />
        );

      case 'success':
        return successData ? (
          <PaymentSuccess data={successData} />
        ) : null;

      case 'error':
        return (
          <PaymentError
            message={errorMessage}
            onRetry={handleRetry}
            onBack={handleBackToMethod}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Payment Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Secure Payment</h2>
          <p className="text-gray-600 mt-1">Complete your booking payment</p>
        </div>

        {/* Service Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Service:</span>
            <span className="text-gray-900">{details.consultation?.title}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Duration:</span>
            <span className="text-gray-900">30 minutes</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">Amount:</span>
            <span className="text-2xl font-bold text-green-600">€{price}</span>
          </div>
        </div>

        {/* Payment Content */}
        {renderCurrentStep()}
      </div>
    </div>
  );
};

export default PaymentForm;