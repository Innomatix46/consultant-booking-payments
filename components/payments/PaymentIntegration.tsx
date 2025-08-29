import React from 'react';
import PaymentForm from './PaymentForm';
import { AppointmentDetails } from '../../types';

interface PaymentIntegrationProps {
  onPaymentSuccess: (paymentMethod: string) => void;
  onBack: () => void;
  price: number;
  details: Partial<AppointmentDetails>;
}

/**
 * Drop-in replacement for the existing Payment component
 * This component provides the new enhanced payment system while maintaining
 * backward compatibility with the existing interface
 */
const PaymentIntegration: React.FC<PaymentIntegrationProps> = (props) => {
  const handlePaymentSuccess = (paymentData: any) => {
    // Transform new payment data format to legacy format for backward compatibility
    props.onPaymentSuccess(paymentData.paymentMethod);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <PaymentForm
          {...props}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  );
};

export default PaymentIntegration;

/**
 * Usage Example:
 * 
 * // Replace your existing Payment component with this:
 * import PaymentIntegration from './components/payments/PaymentIntegration';
 * 
 * // Use exactly the same as before:
 * <PaymentIntegration
 *   onPaymentSuccess={handlePaymentSuccess}
 *   onBack={handleBack}
 *   price={consultationPrice}
 *   details={appointmentDetails}
 * />
 * 
 * The new system provides:
 * - Enhanced UI/UX with multi-step flow
 * - Better validation and error handling
 * - Improved loading states and feedback
 * - Modular architecture for easy customization
 * - Full backward compatibility with existing code
 */