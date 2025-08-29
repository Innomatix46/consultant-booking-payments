import React from 'react';
import { PaymentData, PaymentMethod } from './PaymentForm';

interface PaymentConfirmationProps {
  paymentData: PaymentData;
  selectedMethod: PaymentMethod;
  onConfirm: (data: any) => void;
  onBack: () => void;
}

const PaymentConfirmation: React.FC<PaymentConfirmationProps> = ({
  paymentData,
  selectedMethod,
  onConfirm,
  onBack
}) => {
  const methodDisplayName = selectedMethod === 'stripe' ? 'Stripe' : 'Paystack';

  const handleConfirm = () => {
    onConfirm({
      ...paymentData,
      paymentMethod: selectedMethod
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">Confirm Payment</h3>
        <p className="text-gray-600 text-sm mt-1">Please review your payment details</p>
      </div>

      {/* Payment Summary Card */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
            <span className="text-lg font-semibold text-gray-900">Payment Summary</span>
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {methodDisplayName}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Service:</span>
              <span className="font-medium text-gray-900">{paymentData.description}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-700">Customer:</span>
              <span className="font-medium text-gray-900">{paymentData.customerEmail}</span>
            </div>

            {paymentData.customerName && (
              <div className="flex justify-between">
                <span className="text-gray-700">Name:</span>
                <span className="font-medium text-gray-900">{paymentData.customerName}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
              <span className="text-2xl font-bold text-green-600">
                {paymentData.currency} {paymentData.amount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Details */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Payment Method: {methodDisplayName}</h4>
        <div className="text-sm text-gray-600 space-y-1">
          {selectedMethod === 'stripe' ? (
            <>
              <p>• Secure payment processing via Stripe</p>
              <p>• Accepts major credit and debit cards</p>
              <p>• Apple Pay and Google Pay supported</p>
              <p>• 3D Secure authentication for added security</p>
            </>
          ) : (
            <>
              <p>• Secure payment processing via Paystack</p>
              <p>• Bank transfer, cards, and mobile money</p>
              <p>• USSD payments available</p>
              <p>• Optimized for African markets</p>
            </>
          )}
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="terms"
            className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            defaultChecked
          />
          <div>
            <label htmlFor="terms" className="text-sm text-blue-900 font-medium">
              Terms and Conditions
            </label>
            <p className="text-xs text-blue-800 mt-1">
              By proceeding, you agree to our{' '}
              <button className="underline hover:no-underline">Terms of Service</button> and{' '}
              <button className="underline hover:no-underline">Privacy Policy</button>.
              You authorize the charge for this consultation booking.
            </p>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="flex items-center justify-center space-x-6 text-xs text-gray-500">
        <div className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          256-bit SSL
        </div>
        <div className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          PCI Compliant
        </div>
        <div className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verified Secure
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6">
        <button
          type="button"
          onClick={onBack}
          className="bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="bg-green-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors flex items-center"
        >
          Confirm & Pay
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export { PaymentConfirmation };