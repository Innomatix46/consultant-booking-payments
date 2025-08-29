import React, { useState, useEffect } from 'react';
import { PaymentData, PaymentSuccessData } from './PaymentForm';
import { LoadingSpinner } from '../LoadingSpinner';

interface StripePaymentFormProps {
  paymentData: PaymentData;
  onSuccess: (data: PaymentSuccessData) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

// This would typically come from environment variables
const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY || 'pk_live_51Rl8nWP0OXBFDAIs5mqRhh9atthTjfxC9DpXPhaQGCzd4LYWxBBqQrmq0kd6orkf8VuiJAzcH0CuRayqzPekdGm900pTg7NIl6';

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  paymentData,
  onSuccess,
  onError,
  onBack
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load Stripe script
    if (!(window as any).Stripe) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => {
        const stripeInstance = (window as any).Stripe(STRIPE_PUBLIC_KEY);
        setStripe(stripeInstance);
        setStripeLoaded(true);
      };
      script.onerror = () => {
        onError('Failed to load Stripe. Please try again.');
      };
      document.head.appendChild(script);
    } else {
      const stripeInstance = (window as any).Stripe(STRIPE_PUBLIC_KEY);
      setStripe(stripeInstance);
      setStripeLoaded(true);
    }
  }, [onError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !stripeLoaded) {
      onError('Payment system not ready. Please try again.');
      return;
    }

    setIsLoading(true);
    setFormErrors({});

    try {
      // Create checkout session on backend
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: paymentData.amount * 100, // Convert to cents
          currency: paymentData.currency.toLowerCase(),
          description: paymentData.description,
          customerEmail: paymentData.customerEmail,
          metadata: paymentData.metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        sessionId: sessionId,
      });

      if (error) {
        throw new Error(error.message);
      }

    } catch (error) {
      console.error('Stripe payment error:', error);
      onError(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckoutRedirect = async () => {
    if (!stripe) {
      onError('Payment system not ready. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      // For demo purposes, we'll simulate the existing redirect flow
      // In production, this would use the backend API
      const result = await stripe.redirectToCheckout({
        lineItems: [{
          price_data: {
            currency: paymentData.currency.toLowerCase(),
            product_data: {
              name: paymentData.description,
            },
            unit_amount: paymentData.amount * 100, // Convert to cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        successUrl: `${window.location.origin}?payment=success&method=stripe`,
        cancelUrl: `${window.location.origin}?payment=cancel`,
        customerEmail: paymentData.customerEmail,
        metadata: paymentData.metadata,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

    } catch (error) {
      console.error('Stripe checkout error:', error);
      onError(error instanceof Error ? error.message : 'Payment failed');
      setIsLoading(false);
    }
  };

  if (!stripeLoaded) {
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
        <h3 className="text-xl font-semibold text-gray-900">Pay with Stripe</h3>
        <p className="text-gray-600 text-sm mt-1">Secure payment via Stripe</p>
      </div>

      {/* Payment Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-blue-800 font-medium">Amount to pay:</span>
          <span className="text-2xl font-bold text-blue-900">
            {paymentData.currency} {paymentData.amount}
          </span>
        </div>
        <div className="text-blue-700 text-sm">
          <p>{paymentData.description}</p>
          <p className="mt-1">Customer: {paymentData.customerEmail}</p>
        </div>
      </div>

      {/* Security Features */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-xs font-medium text-gray-700">SSL Encrypted</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-xs font-medium text-gray-700">PCI Compliant</p>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-3">
            Click the button below to be securely redirected to Stripe's checkout page where you can complete your payment.
          </p>
          <div className="flex items-center text-xs text-gray-600">
            <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Your card details are handled securely by Stripe
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
            onClick={handleCheckoutRedirect}
            disabled={isLoading}
            className="bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="small" className="mr-2" />
                Processing...
              </>
            ) : (
              <>
                Pay €{paymentData.amount}
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export { StripePaymentForm };