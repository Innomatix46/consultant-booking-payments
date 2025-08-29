import React, { useState, useEffect } from 'react';
import { CONSULTATION_OPTIONS } from './consultationOptions';
import { ConsultationOption } from '../types';
import { BriefcaseIcon, DocumentTextIcon, DocumentPencilIcon, UsersIcon } from './IconComponents';

interface AppointmentTypePickerProps {
    onSelect: (consultation: ConsultationOption, price: number) => void;
    onBack: () => void;
    selectedConsultationId?: string;
}

const serviceIcons: { [key: string]: React.ReactNode } = {
    degree_recognition: <DocumentTextIcon />,
    integration_course: <UsersIcon />,
    study_apprenticeship: <DocumentPencilIcon />,
    visa_extension: <BriefcaseIcon />,
};

const AppointmentTypePicker: React.FC<AppointmentTypePickerProps> = ({ onSelect, onBack, selectedConsultationId }) => {
    const [prices, setPrices] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const storedPrices = localStorage.getItem('consultationPrices');
        const loadedPrices: { [key: string]: string } = storedPrices ? JSON.parse(storedPrices) : {};

        const initialPrices: { [key: string]: string } = {};
        CONSULTATION_OPTIONS.forEach(opt => {
            initialPrices[opt.priceKey] = loadedPrices[opt.priceKey] || opt.defaultPrice;
        });
        setPrices(initialPrices);
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-semibold text-center mb-6">Confirm or Change Your Consultation Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CONSULTATION_OPTIONS.map(option => {
                    const price = prices[option.priceKey] || option.defaultPrice;
                    const isSelected = selectedConsultationId === option.id;

                    return (
                        <div key={option.id} className={`bg-white p-6 rounded-lg shadow-md flex flex-col border-2 transition-all ${isSelected ? 'border-brand-blue shadow-lg' : 'border-gray-200 hover:border-brand-blue/50'}`}>
                            <div className="flex justify-center mb-3 text-brand-blue">{serviceIcons[option.id]}</div>
                            <h4 className="text-lg font-bold text-brand-dark text-center mb-2">{option.title}</h4>
                            <p className="text-gray-600 text-sm mb-4 flex-grow text-center">{option.description}</p>
                            <p className="text-3xl font-extrabold text-brand-dark my-3 text-center">€{price}</p>
                            <button
                                onClick={() => onSelect(option, Number(price))}
                                className={`mt-auto w-full font-bold py-3 px-6 rounded-lg text-md transition-colors shadow-md ${isSelected ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-brand-blue text-white hover:bg-opacity-90'}`}
                            >
                                {isSelected ? 'Confirm Selection' : 'Switch to this'}
                            </button>
                        </div>
                    );
                })}
            </div>
            <div className="mt-8 flex justify-between">
                <button
                    onClick={onBack}
                    className="bg-gray-200 text-gray-800 font-semibold py-2 px-6 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    Back
                </button>
            </div>
        </div>
    );
};

export default AppointmentTypePicker;