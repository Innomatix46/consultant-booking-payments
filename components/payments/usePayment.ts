import { useState, useCallback, useEffect } from 'react';
import { PaymentMethod, PaymentSuccessData, PaymentData } from './PaymentForm';
import { validatePaymentForm, generateTransactionId, sanitizePaymentData } from './paymentUtils';

export interface UsePaymentOptions {
  onSuccess?: (data: PaymentSuccessData) => void;
  onError?: (error: string) => void;
  enableLogging?: boolean;
}

export interface UsePaymentReturn {
  // State
  isLoading: boolean;
  error: string | null;
  selectedMethod: PaymentMethod;
  
  // Actions
  setSelectedMethod: (method: PaymentMethod) => void;
  processPayment: (paymentData: PaymentData, method: PaymentMethod) => Promise<void>;
  clearError: () => void;
  
  // Utilities
  validateForm: (formData: any) => { isValid: boolean; errors: Record<string, string> };
}

const usePayment = (options: UsePaymentOptions = {}): UsePaymentReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  
  const { onSuccess, onError, enableLogging = false } = options;

  // Log payment events if enabled
  const logEvent = useCallback((event: string, data?: any) => {
    if (enableLogging) {
      console.log(`[Payment Hook] ${event}:`, sanitizePaymentData(data));
    }
  }, [enableLogging]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Validate payment form data
  const validateForm = useCallback((formData: any) => {
    return validatePaymentForm(formData);
  }, []);

  // Process payment with the selected method
  const processPayment = useCallback(async (paymentData: PaymentData, method: PaymentMethod) => {
    if (!method) {
      const errorMsg = 'No payment method selected';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    logEvent('Payment processing started', { method, amount: paymentData.amount });

    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (method === 'stripe') {
        await processStripePayment(paymentData);
      } else if (method === 'paystack') {
        await processPaystackPayment(paymentData);
      } else {
        throw new Error(`Unsupported payment method: ${method}`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment processing failed';
      setError(errorMessage);
      onError?.(errorMessage);
      logEvent('Payment processing failed', { error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [onError, onSuccess, logEvent]);

  // Stripe payment processing
  const processStripePayment = async (paymentData: PaymentData) => {
    logEvent('Processing Stripe payment', paymentData);
    
    // In a real implementation, this would integrate with Stripe's API
    // For now, we'll simulate the process
    
    if (!window.Stripe) {
      throw new Error('Stripe is not loaded');
    }

    // Simulate successful payment
    const successData: PaymentSuccessData = {
      paymentMethod: 'stripe',
      transactionId: generateTransactionId(),
      amount: paymentData.amount,
      currency: paymentData.currency,
      timestamp: new Date().toISOString()
    };

    logEvent('Stripe payment successful', successData);
    onSuccess?.(successData);
  };

  // Paystack payment processing
  const processPaystackPayment = async (paymentData: PaymentData) => {
    logEvent('Processing Paystack payment', paymentData);
    
    if (!window.PaystackPop) {
      throw new Error('Paystack is not loaded');
    }

    // Simulate successful payment
    const successData: PaymentSuccessData = {
      paymentMethod: 'paystack',
      transactionId: generateTransactionId(),
      amount: paymentData.amount,
      currency: paymentData.currency,
      timestamp: new Date().toISOString()
    };

    logEvent('Paystack payment successful', successData);
    onSuccess?.(successData);
  };

  // Load payment scripts when method is selected
  useEffect(() => {
    if (selectedMethod === 'stripe' && !window.Stripe) {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      document.head.appendChild(script);
    }
    
    if (selectedMethod === 'paystack' && !window.PaystackPop) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, [selectedMethod]);

  return {
    isLoading,
    error,
    selectedMethod,
    setSelectedMethod,
    processPayment,
    clearError,
    validateForm,
  };
};

export default usePayment;