import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Timer, BookOpen, Lightbulb, ChevronRight } from 'lucide-react';
import MathRenderer from './MathRenderer';

const MiniLesson = ({ question, selectedAnswer, correctAnswer, explanation, onComplete }) => {
    const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
    const [understood, setUnderstood] = useState(false);

    // Timer countdown
    useEffect(() => {
        if (timeLeft <= 0 || understood) {
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, understood]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleUnderstood = () => {
        setUnderstood(true);
        setTimeout(() => {
            onComplete();
        }, 500);
    };

    const progress = ((120 - timeLeft) / 120) * 100;

    // DEBUG: Log received question
    console.log("MiniLesson received question:", question);

    const getQuestionText = (q) => {
        if (!q) return "Pregunta no disponible";
        if (typeof q === 'string') return q;
        return q.question || q.text || q.title || JSON.stringify(q);
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[250] p-4 backdrop-blur-md animate-fadeIn">
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border-4 border-orange-200">

                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-20">
                        <div className="absolute top-2 left-2 w-20 h-20 bg-white rounded-full"></div>
                        <div className="absolute bottom-4 right-8 w-16 h-16 bg-white rounded-full"></div>
                    </div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-white p-3 rounded-2xl shadow-lg">
                                <Lightbulb className="w-8 h-8 text-orange-500 fill-orange-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white drop-shadow-md">Mini Lección</h2>
                                <p className="text-orange-100 font-bold">Aprende de tu error</p>
                            </div>
                        </div>

                        <div className={`bg-white px-5 py-3 rounded-2xl shadow-lg ${timeLeft <= 30 ? 'animate-pulse ring-4 ring-red-400' : ''}`}>
                            <div className="flex items-center gap-2">
                                <Timer className={`w-5 h-5 ${timeLeft <= 30 ? 'text-red-600' : 'text-orange-600'}`} />
                                <span className={`font-mono font-black text-xl ${timeLeft <= 30 ? 'text-red-600' : 'text-gray-800'}`}>
                                    {formatTime(timeLeft)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timer Progress Bar */}
                    <div className="mt-4 h-2 bg-white/30 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${timeLeft <= 30 ? 'bg-red-500' : 'bg-white'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">

                    {/* Original Question */}
                    <div className="bg-white rounded-2xl p-6 shadow-md border-2 border-gray-100">
                        <div className="flex items-center gap-2 text-gray-500 font-bold text-sm mb-3">
                            <BookOpen className="w-4 h-4" />
                            PREGUNTA ORIGINAL
                        </div>
                        <div className="text-lg font-bold text-gray-800 leading-relaxed">
                            <MathRenderer text={getQuestionText(question)} />
                        </div>
                    </div>

                    {/* Your Answer vs Correct Answer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Your Answer */}
                        <div className="bg-red-50 rounded-2xl p-5 border-2 border-red-200">
                            <div className="flex items-center gap-2 mb-3">
                                <X className="w-5 h-5 text-red-600" strokeWidth={3} />
                                <span className="font-black text-red-700 text-sm uppercase">Tu Respuesta</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-md">
                                    {selectedAnswer}
                                </div>
                                <div className="text-gray-700 font-medium flex-1">
                                    <MathRenderer text={question.options?.[selectedAnswer] || selectedAnswer} />
                                </div>
                            </div>
                        </div>

                        {/* Correct Answer */}
                        <div className="bg-green-50 rounded-2xl p-5 border-2 border-green-200">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle className="w-5 h-5 text-green-600" strokeWidth={3} />
                                <span className="font-black text-green-700 text-sm uppercase">Respuesta Correcta</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-md">
                                    {correctAnswer}
                                </div>
                                <div className="text-gray-700 font-medium flex-1">
                                    <MathRenderer text={question.options?.[correctAnswer] || correctAnswer} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Explanation */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 rounded-full opacity-20 -mr-16 -mt-16"></div>
                        <div className="relative z-10">
                            <h3 className="font-black text-blue-900 text-lg mb-4 flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 fill-blue-600 text-blue-600" />
                                ¿Por qué está mal y cómo resolverlo?
                            </h3>
                            <div className="text-gray-700 leading-relaxed space-y-3 font-medium">
                                <MathRenderer text={explanation} />
                            </div>
                        </div>
                    </div>

                    {/* Action Area */}
                    {timeLeft > 0 ? (
                        // STILL READING - No button, just message
                        <div className="text-center py-8">
                            <div className="inline-flex items-center gap-3 bg-blue-50 px-6 py-4 rounded-2xl border-2 border-blue-200">
                                <BookOpen className="w-6 h-6 text-blue-600 animate-pulse" />
                                <div className="text-left">
                                    <p className="font-black text-blue-900 text-lg">
                                        📖 Lee la explicación completa
                                    </p>
                                    <p className="text-blue-600 text-sm font-bold">
                                        Tiempo restante: {formatTime(timeLeft)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // TIMER FINISHED - Show button
                        <button
                            onClick={handleUnderstood}
                            disabled={understood}
                            className={`w-full py-5 rounded-2xl font-black text-xl transition-all duration-300 flex items-center justify-center gap-3 group shadow-lg ${understood
                                ? 'bg-green-500 text-white scale-95'
                                : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:shadow-2xl hover:scale-[1.02] active:scale-95'
                                }`}
                        >
                            {understood ? (
                                <>
                                    <CheckCircle className="w-6 h-6" />
                                    ¡Entendido!
                                </>
                            ) : (
                                <>
                                    He Comprendido
                                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
        </div>
    );
};

export default MiniLesson;
