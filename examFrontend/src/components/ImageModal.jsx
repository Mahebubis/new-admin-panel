import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

const ImageModal = ({ imageUrl, onClose }) => {
    const [scale, setScale] = useState(1);

    const handleZoomIn = () => {
        setScale(prev => Math.min(prev + 0.25, 3));
    };

    const handleZoomOut = () => {
        setScale(prev => Math.max(prev - 0.25, 0.5));
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="relative">
                {/* Zoom Level Indicator */}
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white/10 text-white px-4 py-2 rounded-full backdrop-blur-sm">
                    {Math.round(scale * 100)}%
                </div>

                {/* Image Container with Pan Support */}
                <div className="relative overflow-auto bg-transparent rounded-lg p-4"
                    style={{
                        width: '90vw',
                        height: '70vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                    <div style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.2s ease-out'
                    }}>
                        <img
                            src={imageUrl}
                            alt="Zoomed Question Illustration"
                            className="max-w-full h-auto"
                            style={{
                                maxHeight: '60vh',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                </div>

                {/* Control Buttons Container */}
                <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
                    {/* Zoom Out Button */}
                    <button
                        onClick={handleZoomOut}
                        disabled={scale <= 0.5}
                        className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ZoomOut size={24} />
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
                    >
                        <X size={24} />
                    </button>

                    {/* Zoom In Button */}
                    <button
                        onClick={handleZoomIn}
                        disabled={scale >= 3}
                        className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ZoomIn size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageModal;