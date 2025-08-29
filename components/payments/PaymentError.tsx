import React from 'react';

interface PaymentErrorProps {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

const PaymentError: React.FC<PaymentErrorProps> = ({ message, onRetry, onBack }) => {
  const getErrorIcon = () => {
    return (
      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  };

  const getErrorSuggestions = (errorMessage: string) => {
    const suggestions = [];
    
    if (errorMessage.toLowerCase().includes('card')) {
      suggestions.push('Check your card details and try again');
      suggestions.push('Ensure your card has sufficient funds');
      suggestions.push('Contact your bank if the issue persists');
    }
    
    if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try refreshing the page');
    }
    
    if (errorMessage.toLowerCase().includes('expired') || errorMessage.toLowerCase().includes('timeout')) {
      suggestions.push('The session has expired, please try again');
      suggestions.push('Complete the payment within the time limit');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Please try again or contact support');
      suggestions.push('Check that all required fields are filled correctly');
      suggestions.push('Try using a different payment method');
    }
    
    return suggestions;
  };

  const handleContactSupport = () => {
    window.open('mailto:support@consultation.com?subject=Payment Error&body=' + 
      encodeURIComponent(`I encountered a payment error: ${message}`), '_blank');
  };

  const errorSuggestions = getErrorSuggestions(message);

  return (
    <div className="text-center space-y-6">
      {/* Error Icon */}
      <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
        {getErrorIcon()}
      </div>

      {/* Error Message */}
      <div>
        <h3 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h3>
        <p className="text-gray-600">We couldn't process your payment</p>
      </div>

      {/* Error Details */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="text-left">
            <p className="text-sm font-medium text-red-800">Error Details:</p>
            <p className="text-sm text-red-700 mt-1">{message}</p>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
        <h4 className="font-semibold text-blue-900 mb-2 text-center">What you can do:</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          {errorSuggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start">
              <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold text-blue-800 mr-2 mt-0.5 flex-shrink-0">
                {index + 1}
              </span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Payment Methods Alternative */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Alternative Options:</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Try a different payment method</p>
          <p>• Use a different card or account</p>
          <p>• Contact your bank for authorization</p>
          <p>• Reach out to our support team</p>
        </div>
      </div>

      {/* Support Information */}
      <div className="bg-gray-100 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Need immediate help?</h4>
        <div className="space-y-2">
          <button
            onClick={handleContactSupport}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Support
          </button>
          <p className="text-xs text-gray-500">
            We typically respond within 2 hours during business hours
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 pt-4">
        <button
          onClick={onBack}
          className="bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Change Method
        </button>
        
        <button
          onClick={onRetry}
          className="bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </div>

      {/* Error Reference */}
      <div className="text-xs text-gray-400 pt-4 border-t border-gray-200">
        <p>Error occurred at: {new Date().toLocaleString()}</p>
        <p className="mt-1">Reference ID: ERR-{Date.now().toString(36).toUpperCase()}</p>
      </div>
    </div>
  );
};

export { PaymentError };