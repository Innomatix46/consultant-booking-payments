
import React from 'react';
import { InstagramIcon, TikTokIcon } from './IconComponents';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white py-6 px-4 sm:px-6 lg:px-8 border-t border-gray-200">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between">
        <p className="text-sm text-gray-500 mb-4 sm:mb-0">
          Germany Immigration Consulting &copy; {new Date().getFullYear()}
        </p>
        <div className="flex items-center space-x-6">
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-500 transition-colors" aria-label="Follow us on Instagram">
            <InstagramIcon />
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors" aria-label="Follow us on TikTok">
            <TikTokIcon />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;