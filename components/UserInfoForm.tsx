
import React, { useState } from 'react';
import { AppointmentDetails } from '../types';

interface UserInfoFormProps {
  onSubmit: (details: { name: string; email: string; whatsapp: string }) => void;
  onBack: () => void;
  initialData?: Partial<AppointmentDetails>
}

const UserInfoForm: React.FC<UserInfoFormProps> = ({ onSubmit, onBack, initialData }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || '');
  const [errors, setErrors] = useState({ name: '', email: '', whatsapp: '' });

  const validate = () => {
    const newErrors = { name: '', email: '', whatsapp: '' };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Full Name is required.';
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = 'Email Address is required.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
      isValid = false;
    }

    if (!whatsapp.trim()) {
      newErrors.whatsapp = 'WhatsApp Number is required.';
      isValid = false;
    } else if (!/^\+\d{7,15}$/.test(whatsapp)) {
      newErrors.whatsapp = 'Please enter a valid number in international format (e.g., +4917612345678).';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ name, email, whatsapp });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Full Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${errors.name ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="John Doe"
          aria-invalid={!!errors.name}
          aria-describedby="name-error"
        />
        {errors.name && <p id="name-error" className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${errors.email ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="john.doe@example.com"
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
        />
        {errors.email && <p id="email-error" className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
          WhatsApp Number
        </label>
        <input
          type="tel"
          id="whatsapp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${errors.whatsapp ? 'border-red-500' : 'border-gray-200'}`}
          placeholder="+4917612345678"
          aria-invalid={!!errors.whatsapp}
          aria-describedby="whatsapp-error"
        />
        <p className="mt-2 text-xs text-gray-500">Please enter in international format with no spaces.</p>
        {errors.whatsapp && <p id="whatsapp-error" className="mt-1 text-sm text-red-600">{errors.whatsapp}</p>}
      </div>
      
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="bg-gray-200 text-gray-800 font-semibold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          className="bg-brand-blue text-white font-semibold py-2 px-6 rounded-lg hover:bg-opacity-90 transition-colors disabled:bg-gray-400"
          disabled={!name || !email || !whatsapp}
        >
          Continue to Payment
        </button>
      </div>
    </form>
  );
};

export default UserInfoForm;
