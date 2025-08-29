
import React from 'react';

interface HeaderProps {
    isAdmin: boolean;
    onLoginClick: () => void;
    onLogout: () => void;
    onGoHome?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isAdmin, onLoginClick, onLogout, onGoHome }) => {
    const isClickable = !isAdmin && onGoHome;

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div 
          className={`flex items-center rounded-md ${isClickable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue' : ''}`}
          onClick={isClickable ? onGoHome : undefined}
          onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onGoHome?.(); } : undefined}
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : -1}
          aria-label={isClickable ? 'Go to homepage' : undefined}
        >
            <svg className="w-10 h-10 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <h1 className="text-xl md:text-2xl font-bold text-brand-dark ml-3">
              {isAdmin ? 'Admin Dashboard' : 'Germany Immigration Consulting'}
            </h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
            {isAdmin ? (
                <button onClick={onLogout} className="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
                    Logout
                </button>
            ) : (
                <button onClick={onLoginClick} className="bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base">
                    Consultant Login
                </button>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;
