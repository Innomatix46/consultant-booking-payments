import React from 'react';
import { StripeIcon, PaystackIcon, CreditCardIcon } from '../IconComponents';
import { PaymentMethod } from './PaymentForm';

interface PaymentMethodSelectorProps {
  onMethodSelect: (method: PaymentMethod) => void;
  onBack: () => void;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ 
  onMethodSelect, 
  onBack 
}) => {
  const paymentMethods = [
    {
      id: 'stripe' as PaymentMethod,
      name: 'Stripe',
      description: 'Pay with credit/debit card via Stripe',
      icon: <StripeIcon />,
      availability: 'Global',
      features: ['Credit Cards', 'Debit Cards', 'Apple Pay', 'Google Pay']
    },
    {
      id: 'paystack' as PaymentMethod,
      name: 'Paystack',
      description: 'African payment gateway',
      icon: <PaystackIcon />,
      availability: 'Africa',
      features: ['Bank Transfer', 'Mobile Money', 'USSD', 'Cards']
    }
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Choose Payment Method</h3>
        <p className="text-gray-600 text-sm mt-1">Select your preferred payment option</p>
      </div>

      {paymentMethods.map((method) => (
        <div
          key={method.id}
          onClick={() => onMethodSelect(method.id)}
          className="border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
        >
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 mt-1">
              {method.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600">
                  {method.name}
                </h4>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {method.availability}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-3">{method.description}</p>
              <div className="flex flex-wrap gap-2">
                {method.features.map((feature) => (
                  <span
                    key={feature}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0">
              <CreditCardIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
            </div>
          </div>
        </div>
      ))}

      {/* Security Notice */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">Secure Payment</p>
            <p className="text-xs text-green-700">Your payment information is encrypted and secure</p>
          </div>
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
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-2">Questions about payment?</p>
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export { PaymentMethodSelector };