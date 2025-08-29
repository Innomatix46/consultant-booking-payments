import React, { useState, useEffect } from 'react';
import { validateCardNumber, validateExpiryDate, validateCVV, validateEmail, formatCardNumber, formatExpiryDate, getCardType } from './paymentUtils';

interface ValidationFieldProps {
  label: string;
  type: 'text' | 'email' | 'tel' | 'card' | 'expiry' | 'cvv';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  maxLength?: number;
}

const ValidationField: React.FC<ValidationFieldProps> = ({
  label,
  type,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  maxLength
}) => {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // Apply formatting based on field type
    switch (type) {
      case 'card':
        newValue = formatCardNumber(newValue);
        if (newValue.replace(/\D/g, '').length <= 19) {
          onChange(newValue);
        }
        break;
      case 'expiry':
        newValue = formatExpiryDate(newValue);
        if (newValue.replace(/\D/g, '').length <= 4) {
          onChange(newValue);
        }
        break;
      case 'cvv':
        newValue = newValue.replace(/\D/g, '');
        if (newValue.length <= 4) {
          onChange(newValue);
        }
        break;
      default:
        onChange(newValue);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    setTouched(true);
  };

  const getFieldIcon = () => {
    switch (type) {
      case 'card':
        const cardType = getCardType(value);
        return (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {cardType === 'visa' && (
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iNCIgZmlsbD0iIzAwNTFBNSIvPgo8cGF0aCBkPSJNMTMuMzc3NiA3LjEzNjcySDEwLjc5NDVMMTIuMjQ0NSAxMi44NjMzSDkuNjYxNDVMMTEuMTExNSA3LjEzNjcySDguNTI4NDVMMTAuMjQ0NSAxNC44NjMzSDEyLjgyNzVMMTEuMzc3NSA5LjEzNjcySDEzLjk2MDVMMTIuNTEwNSAxNC44NjMzSDE1LjA5MzVMMTYuNjExNSA3LjEzNjcySDE0LjAyODVMMTIuNTc4NSAxMi44NjMzSDE1LjE2MTVMMTMuNzA5NSA3LjEzNjcySDE2LjI5MjVMMTQuNTc2NSAxNC44NjMzSDE3LjE1OTVMMTguNjc3NSA3LjEzNjcySDE2LjA5NDVMMTQuNjQ0NSAxMi44NjMzSDE3LjIyNzVMMTUuNzc3NSA3LjEzNjcySDE4LjM2MDVMMTYuNjQ0NSAxNC44NjMzSDE5LjIyNzVMMjAuNzQ1NSA3LjEzNjcySDE4LjE2MjVMMTYuNzEyNSAxMi44NjMzSDE5LjI5NTVMMTcuODQ1NSA3LjEzNjcySDE2LjI5MjVMMTQuNTc2NSAxNC44NjMzSDE3LjE1OTVMMTguNjc3NSA3LjEzNjcySDE2LjA5NDVaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K" alt="Visa" className="w-8 h-5" />
            )}
            {cardType === 'mastercard' && (
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iNCIgZmlsbD0iI0VCMDAxQiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSI2IiBmaWxsPSIjRkY1RjAwIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMTAiIHI9IjYiIGZpbGw9IiNGRkY1RjAiLz4KPC9zdmc+Cg==" alt="Mastercard" className="w-8 h-5" />
            )}
            {cardType === 'amex' && (
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iNCIgZmlsbD0iIzAwNkZDRiIvPgo8dGV4dCB4PSI1IiB5PSIxMyIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iOCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXdlaWdodD0iYm9sZCI+QU1FWDWUDGV4dD4KPC9zdmc+Cg==" alt="American Express" className="w-8 h-5" />
            )}
          </div>
        );
      case 'cvv':
        return (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'email':
        return (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getBorderColor = () => {
    if (error && touched) return 'border-red-500 focus:border-red-500 focus:ring-red-500';
    if (focused) return 'border-blue-500 focus:border-blue-500 focus:ring-blue-500';
    return 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type={type === 'card' || type === 'expiry' || type === 'cvv' ? 'text' : type}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={`
            w-full px-3 py-2 border rounded-md 
            ${getBorderColor()}
            focus:outline-none focus:ring-1
            disabled:bg-gray-50 disabled:cursor-not-allowed
            ${type === 'card' || type === 'cvv' ? 'pr-12' : type === 'email' ? 'pr-12' : 'pr-3'}
          `}
          autoComplete={type === 'card' ? 'cc-number' : 
                       type === 'expiry' ? 'cc-exp' : 
                       type === 'cvv' ? 'cc-csc' :
                       type === 'email' ? 'email' : 'off'}
        />
        {getFieldIcon()}
      </div>
      {error && touched && (
        <p className="text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export { ValidationField };