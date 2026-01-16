import React from 'react';
import { Heart } from 'lucide-react';

const LivesDisplay = ({ lives, maxLives = 5 }) => {
    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md border-2 border-gray-100">
            <span className="font-bold text-sm text-gray-600 mr-1">VIDAS:</span>
            <div className="flex gap-1">
                {[...Array(maxLives)].map((_, index) => (
                    <Heart
                        key={index}
                        className={`w-5 h-5 transition-all duration-300 ${index < lives
                                ? 'fill-red-500 text-red-500 scale-110 animate-pulse'
                                : 'fill-gray-200 text-gray-300 opacity-40'
                            }`}
                        strokeWidth={2}
                    />
                ))}
            </div>
            <span className={`ml-2 font-black text-lg ${lives <= 1 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                {lives}
            </span>
        </div>
    );
};

export default LivesDisplay;
