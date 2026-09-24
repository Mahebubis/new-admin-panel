import React, { memo } from 'react';

const SummaryModal = memo(
    ({
        questions,
        answers,
        markedForReview,
        getQuestionStatus,
        setShowSummaryModal,
        handleEndExam,
        setSelectedQuestionIndex,
    }) => {
        const stats = {
            answered: Object.keys(answers).length,
            reviewed: markedForReview.size,
            unanswered: questions.length - Object.keys(answers).length,
            total: questions.length,
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
                    <h2 className="text-2xl font-bold mb-4">Exam Summary</h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-green-100 p-4 rounded-lg">
                            <p className="text-sm text-green-800">Answered</p>
                            <p className="text-2xl font-bold text-green-800">{stats.answered}</p>
                        </div>
                        <div className="bg-blue-100 p-4 rounded-lg">
                            <p className="text-sm text-blue-800">Marked for Review</p>
                            <p className="text-2xl font-bold text-blue-800">{stats.reviewed}</p>
                        </div>
                        <div className="bg-red-100 p-4 rounded-lg">
                            <p className="text-sm text-red-800">Not Answered</p>
                            <p className="text-2xl font-bold text-red-800">{stats.unanswered}</p>
                        </div>
                        <div className="bg-gray-100 p-4 rounded-lg">
                            <p className="text-sm text-gray-800">Total Questions</p>
                            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto mb-6 pr-2">
                        <h3 className="font-bold mb-2">Question-wise Summary</h3>
                        <div className="space-y-2">
                            {questions.map((question, index) => (
                                <div
                                    key={question.question_id}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer"
                                    onClick={() => setSelectedQuestionIndex(index)}
                                >
                                    <span>Question {index + 1}</span>
                                    <span
                                        className={`px-3 py-1 rounded text-sm ${getQuestionStatus(index) === 'answered'
                                            ? 'bg-green-500 text-white'
                                            : getQuestionStatus(index) === 'review'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-red-500 text-white'
                                            }`}
                                    >
                                        {getQuestionStatus(index) === 'answered'
                                            ? 'Answered'
                                            : getQuestionStatus(index) === 'review'
                                                ? 'Marked for Review'
                                                : 'Not Answered'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <p className="text-gray-700 mb-4">
                            Are you sure you want to submit the exam? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                                Return to Exam
                            </button>
                            <button
                                onClick={handleEndExam}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                            >
                                Confirm Submission
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

export default SummaryModal;
