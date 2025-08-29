
import React, { useState, useEffect } from 'react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Hardcoded password for demonstration
    const CORRECT_PASSWORD = 'Jessica96';

    useEffect(() => {
        // Reset state when modal opens
        if (isOpen) {
            setPassword('');
            setError('');
            setIsSubmitting(false);
        }
    }, [isOpen]);
    
    if (!isOpen) {
        return null;
    }

    const handleLoginAttempt = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        
        // Simulate network delay
        setTimeout(() => {
            if (password === CORRECT_PASSWORD) {
                onLoginSuccess();
            } else {
                setError('Incorrect password. Please try again.');
            }
            setIsSubmitting(false);
        }, 500);
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in" 
            onClick={onClose} 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="login-modal-title"
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <h3 id="login-modal-title" className="text-xl font-bold text-gray-800">Consultant Login</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close login modal">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleLoginAttempt} className="mt-4 space-y-4">
                    <div>
                        <label htmlFor="password-input" className="block text-sm font-medium text-gray-700">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${error ? 'border-red-500' : 'border-gray-200'}`}
                            autoFocus
                        />
                        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !password}
                        className="w-full flex justify-center bg-brand-blue text-white font-semibold py-2 px-4 rounded-lg hover:bg-opacity-90 transition-colors disabled:bg-gray-400"
                    >
                        {isSubmitting ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginModal;