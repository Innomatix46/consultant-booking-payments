import React from 'react';
import PaymentIntegration from './payments/PaymentIntegration';
import { AppointmentDetails } from '../types';

// Legacy Payment component - now uses the enhanced payment system
// This maintains backward compatibility while providing improved functionality

interface PaymentProps {
  onPaymentSuccess: (paymentMethod: string) => void;
  onBack: () => void;
  price: number;
  details: Partial<AppointmentDetails>;
}

const Payment: React.FC<PaymentProps> = ({ onPaymentSuccess, onBack, price, details }) => {
  // Use the new enhanced payment system while maintaining the same interface
  return (
    <PaymentIntegration
      onPaymentSuccess={onPaymentSuccess}
      onBack={onBack}
      price={price}
      details={details}
    />
  );