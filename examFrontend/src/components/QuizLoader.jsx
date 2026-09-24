import React from 'react';

const QuizLoader = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-auto text-center">
                {/* Animated loading circle */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                </div>

                {/* Loading text with animated dots */}
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Loading Quiz
                </h2>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full animate-[loadingProgress_2s_ease-in-out_infinite]"></div>
                </div>

                <p className="text-gray-600">
                    Preparing your questions...
                </p>
            </div>

            <style jsx>{`
        @keyframes loadingProgress {
          0% { width: 0%; }
          50% { width: 70%; }
          80% { width: 85%; }
          95% { width: 90%; }
          100% { width: 0%; }
        }
      `}</style>
        </div>
    );
};

export default QuizLoader;