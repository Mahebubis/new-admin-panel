import React, { memo } from 'react';

const QuestionModal = memo(({ question, userAnswer, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Question Details</h2>
                {question.question_text && <p className="mb-4">{question.question_text}</p>}
                {question.question_image && (
                    <img
                        src={question.question_image}
                        alt="Question Illustration"
                        className="max-w-full h-auto rounded-lg mb-4"
                    />
                )}
                <div className="space-y-2">
                    {question.options.map((option) => (
                        <div
                            key={option.option_id}
                            className={`flex items-center space-x-2 p-3 rounded ${userAnswer === option.option_id
                                ? 'bg-green-100 border-2 border-green-500'
                                : 'bg-gray-50'
                                }`}
                        >
                            <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${userAnswer === option.option_id
                                    ? 'border-green-500'
                                    : 'border-gray-300'
                                    }`}
                            >
                                {userAnswer === option.option_id && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                )}
                            </div>
                            <span>{option.option_text}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
});

export default QuestionModal;
