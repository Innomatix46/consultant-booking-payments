import React, { useState, useEffect } from 'react';
import { PaymentData, PaymentSuccessData } from './PaymentForm';
import { LoadingSpinner } from '../LoadingSpinner';

interface PaystackPaymentFormProps {
  paymentData: PaymentData;
  onSuccess: (data: PaymentSuccessData) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

// Paystack public key - in production this should come from environment variables
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_your_paystack_public_key';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

const PaystackPaymentForm: React.FC<PaystackPaymentFormProps> = ({
  paymentData,
  onSuccess,
  onError,
  onBack
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });

  useEffect(() => {
    // Load Paystack script
    if (!window.PaystackPop) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = () => {
        setPaystackLoaded(true);
      };
      script.onerror = () => {
        onError('Failed to load Paystack. Please try again.');
      };
      document.head.appendChild(script);
    } else {
      setPaystackLoaded(true);
    }

    // Pre-fill form if customer data is available
    if (paymentData.customerName) {
      const nameParts = paymentData.customerName.split(' ');
      setFormData(prev => ({
        ...prev,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || ''
      }));
    }
  }, [onError, paymentData.customerName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const convertCurrencyToKobo = (amount: number, currency: string): number => {
    // Convert EUR to Kobo (NGN smallest unit)
    // In production, you'd use real-time exchange rates
    const exchangeRate = currency === 'EUR' ? 1600 : 1; // Approximate EUR to NGN rate
    return Math.round(amount * exchangeRate * 100); // Convert to kobo
  };

  const handlePayment = () => {
    if (!paystackLoaded || !window.PaystackPop) {
      onError('Payment system not ready. Please try again.');
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      onError('Please fill in your full name.');
      return;
    }

    setIsLoading(true);

    const amountInKobo = convertCurrencyToKobo(paymentData.amount, paymentData.currency);

    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: paymentData.customerEmail,
      amount: amountInKobo,
      currency: 'NGN', // Paystack primarily works with NGN
      firstname: formData.firstName,
      lastname: formData.lastName,
      phone: formData.phone,
      ref: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        ...paymentData.metadata,
        originalAmount: paymentData.amount,
        originalCurrency: paymentData.currency,
        customerName: `${formData.firstName} ${formData.lastName}`,
      },
      callback: function(response: any) {
        setIsLoading(false);
        onSuccess({
          paymentMethod: 'paystack',
          transactionId: response.reference,
          amount: paymentData.amount,
          currency: paymentData.currency,
          timestamp: new Date().toISOString()
        });
      },
      onClose: function() {
        setIsLoading(false);
        // User closed the payment modal
      }
    });

    handler.openIframe();
  };

  if (!paystackLoaded) {
    return (
      <div className="text-center py-8">
        <LoadingSpinner />
        <p className="text-gray-600 mt-2">Loading payment form...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">Pay with Paystack</h3>
        <p className="text-gray-600 text-sm mt-1">African payment gateway</p>
      </div>

      {/* Payment Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-green-800 font-medium">Amount to pay:</span>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-900">
              {paymentData.currency} {paymentData.amount}
            </div>
            <div className="text-sm text-green-700">
              ≈ ₦{Math.round(paymentData.amount * 1600).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="text-green-700 text-sm">
          <p>{paymentData.description}</p>
        </div>
      </div>

      {/* Customer Information Form */}
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handlePayment(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter first name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter last name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={paymentData.customerEmail}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="+234 800 000 0000"
          />
        </div>
      </form>

      {/* Payment Methods Available */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Available Payment Methods:</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Bank Transfer
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Debit/Credit Cards
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Mobile Money
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            USSD
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">Secure Payment</p>
            <p className="text-xs text-blue-700">Protected by Paystack's advanced security</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handlePayment}
          disabled={isLoading || !formData.firstName.trim() || !formData.lastName.trim()}
          className="bg-green-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="small" className="mr-2" />
              Processing...
            </>
          ) : (
            <>
              Pay ₦{Math.round(paymentData.amount * 1600).toLocaleString()}
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export { PaystackPaymentForm };