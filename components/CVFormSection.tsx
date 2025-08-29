
import React, { useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from './IconComponents';

interface CVFormSectionProps {
  title: string;
  children: React.ReactNode;
  initialOpen?: boolean;
}

const CVFormSection: React.FC<CVFormSectionProps> = ({ title, children, initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        className={`flex justify-between items-center w-full p-4 text-left font-semibold text-brand-dark hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-opacity-75 ${isOpen ? 'rounded-t-lg' : 'rounded-lg'}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-gray-200 bg-gray-50/50 rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  );
};
export default CVFormSection;