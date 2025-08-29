import React from 'react';
import { PaymentSuccessData } from './PaymentForm';

interface PaymentSuccessProps {
  data: PaymentSuccessData;
}

const PaymentSuccess: React.FC<PaymentSuccessProps> = ({ data }) => {
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleDownloadReceipt = () => {
    const receiptData = {
      transactionId: data.transactionId,
      amount: data.amount,
      currency: data.currency,
      paymentMethod: data.paymentMethod,
      timestamp: data.timestamp,
      status: 'Success'
    };

    const dataStr = JSON.stringify(receiptData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `payment-receipt-${data.transactionId}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="text-center space-y-6">
      {/* Success Icon */}
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* Success Message */}
      <div>
        <h3 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h3>
        <p className="text-gray-600">Your consultation booking has been confirmed</p>
      </div>

      {/* Payment Details Card */}
      <div className="bg-white border border-green-200 rounded-lg p-6 text-left max-w-md mx-auto">
        <div className="space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Payment Receipt</span>
            <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Confirmed
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-mono text-sm font-medium text-gray-900">
                {data.transactionId}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-semibold text-green-600">
                {data.currency} {data.amount}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-medium text-gray-900 capitalize">
                {data.paymentMethod}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Date & Time:</span>
              <span className="font-medium text-gray-900">
                {formatDate(data.timestamp)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">What's Next?</h4>
        <div className="text-sm text-blue-800 space-y-1 text-left">
          <div className="flex items-start">
            <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold text-blue-800 mr-2 mt-0.5">1</span>
            <span>You will receive a confirmation email shortly</span>
          </div>
          <div className="flex items-start">
            <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold text-blue-800 mr-2 mt-0.5">2</span>
            <span>Our team will contact you within 24 hours to schedule your consultation</span>
          </div>
          <div className="flex items-start">
            <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold text-blue-800 mr-2 mt-0.5">3</span>
            <span>Prepare any documents or questions for your consultation</span>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Need Help?</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>If you have any questions about your booking:</p>
          <div className="flex items-center justify-center space-x-4 mt-2">
            <button className="text-blue-600 hover:text-blue-800 font-medium">
              📧 contact@consultation.com
            </button>
            <span className="text-gray-400">|</span>
            <button className="text-blue-600 hover:text-blue-800 font-medium">
              📞 +49 123 456 789
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 pt-4">
        <button
          onClick={handlePrintReceipt}
          className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Receipt
        </button>
        
        <button
          onClick={handleDownloadReceipt}
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Receipt
        </button>
      </div>

      {/* Footer Note */}
      <div className="text-xs text-gray-500 pt-4">
        <p>Thank you for choosing our consultation services!</p>
        <p className="mt-1">Reference: {data.transactionId}</p>
      </div>
    </div>
  );
};

export { PaymentSuccess };