import React, { useState, useEffect, useRef } from 'react';
import { Check, X, ChevronRight, Trophy, Star, Zap, Brain, Timer, RotateCcw, Heart, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import MathRenderer from './MathRenderer';
import LivesDisplay from './LivesDisplay';
import MiniLesson from './MiniLesson';

// Sound Helper
const playSound = (type) => {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'success') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        } else if (type === 'error') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    } catch (e) {
        console.warn("Audio Context not available", e);
    }
};

const InteractiveQuiz = ({ questions, onComplete, onClose }) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [showExplanation, setShowExplanation] = useState(false);

    // LIVES SYSTEM - 5 hearts
    const [lives, setLives] = useState(5);
    const MAX_LIVES = 5;

    // MINI LESSON STATE
    const [showMiniLesson, setShowMiniLesson] = useState(false);

    // TIMER & ANIMATION STATE
    const [isThinking, setIsThinking] = useState(false);
    const [shake, setShake] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    // DYNAMIC TIMER BASED ON QUESTION NUMBER (PAES LEVELS)
    const getTimeLimit = (questionIndex) => {
        if (questionIndex < 10) return 30;  // Preguntas 1-10: PAES Básico (30s)
        if (questionIndex < 20) return 60;  // Preguntas 11-20: PAES Avanzado (60s)
        return null;                         // Preguntas 21-30: PAES Experto (sin límite)
    };

    // PAES DIFFICULTY LEVEL
    const getDifficultyLevel = (questionIndex) => {
        if (questionIndex < 10) return { name: 'PAES Básico', color: 'bg-blue-500', icon: '🎓' };
        if (questionIndex < 20) return { name: 'PAES Avanzado', color: 'bg-purple-500', icon: '🔥' };
        return { name: 'PAES Experto', color: 'bg-red-500', icon: '💎' };
    };

    const [timeLeft, setTimeLeft] = useState(getTimeLimit(0));
    const difficultyLevel = getDifficultyLevel(currentQuestion);

    const question = questions[currentQuestion];
    const progress = Math.round(((currentQuestion + 1) / questions.length) * 100);

    // TIMER LOGIC - Only runs if timeLeft is not null
    useEffect(() => {
        if (isAnswered || isFinished || timeLeft === null || showMiniLesson) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleTimeOut();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [currentQuestion, isAnswered, isFinished, showMiniLesson]);

    const handleTimeOut = () => {
        playSound('error');
        setShake(true);
        setIsAnswered(true);
        setShowExplanation(true);
        setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
        setTimeout(() => setShake(false), 500);
    };

    const handleAnswerClick = (option) => {
        if (isAnswered) return;

        setSelectedAnswer(option);
        setIsAnswered(true);

        const isCorrect = option === question.correct_answer;

        if (isCorrect) {
            playSound('success');
            setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
            setShowExplanation(true);
            confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#4D96FF', '#6BCB77', '#FFD93D']
            });
        } else {
            playSound('error');
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));

            // LOSE LIFE
            setLives(prev => Math.max(0, prev - 1));

            // SHOW MINI LESSON instead of just explanation
            setShowMiniLesson(true);

            // If no lives left, end quiz
            if (lives <= 1) {
                setTimeout(() => {
                    finishQuiz();
                }, 2000);
            }
        }
    };

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            const nextQuestionIndex = currentQuestion + 1;
            setCurrentQuestion(nextQuestionIndex);
            setSelectedAnswer(null);
            setIsAnswered(false);
            setShowExplanation(false);
            setShowMiniLesson(false);
            // Reset timer based on next question's difficulty
            setTimeLeft(getTimeLimit(nextQuestionIndex));
        } else {
            finishQuiz();
        }
    };

    const finishQuiz = () => {
        setIsFinished(true);
        playSound('success');
        confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.6 }
        });
        onComplete && onComplete(score);
    };

    const getButtonClass = (option) => {
        const baseClass = "w-full p-4 md:p-6 rounded-2xl border-4 text-left transition-all duration-300 transform font-bold text-lg relative overflow-hidden";

        if (!isAnswered) {
            return `${baseClass} border-gray-300 bg-white hover:border-blue-400 hover:shadow-lg active:scale-95 hover:bg-blue-50`;
        }

        const isCorrectOption = option === question.correct_answer;
        const isSelectedOption = option === selectedAnswer;

        if (isCorrectOption) {
            return `${baseClass} border-green-500 bg-green-50 shadow-md scale-[1.02] ring-4 ring-green-200`;
        }

        if (isSelectedOption && !isCorrectOption) {
            return `${baseClass} border-red-500 bg-red-50 opacity-90`;
        }

        return `${baseClass} border-gray-200 bg-gray-50 opacity-50 grayscale`;
    };

    if (isFinished) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-[2rem] max-w-lg w-full p-8 shadow-2xl text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none"></div>

                    <div className="mb-6 flex justify-center">
                        <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                            <Trophy className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    <h2 className="text-4xl font-black text-gray-800 mb-2">¡Quiz Completado!</h2>
                    <p className="text-gray-500 font-medium mb-8">Aquí tienes tu resumen final</p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-100">
                            <p className="text-green-600 font-bold uppercase text-xs mb-1">Correctas</p>
                            <p className="text-4xl font-black text-green-500">{score.correct}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100">
                            <p className="text-red-600 font-bold uppercase text-xs mb-1">Incorrectas</p>
                            <p className="text-4xl font-black text-red-500">{score.incorrect}</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-2xl mb-8">
                        <p className="text-blue-800 font-bold text-lg mb-2">
                            {score.correct === questions.length ? "¡INCREÍBLE! 🌟 Eres un maestro." :
                                score.correct > questions.length / 2 ? "¡Buen trabajo! 👍 Sigue practicando." :
                                    "¡Sigue intentando! 💪 La práctica hace al maestro."}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 transition shadow-lg hover:shadow-xl transform active:scale-95"
                    >
                        Cerrar y Continuar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 bg-black/75 flex items-center justify-center z-[150] p-4 backdrop-blur-sm transition-opacity duration-300 ${shake ? 'animate-shake' : ''}`}>
            <div className={`bg-[#F0F2F5] rounded-[2.5rem] max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden transition-all duration-300 ${shake ? 'ring-4 ring-red-400' : ''}`}>

                {/* Header */}
                <div className="bg-white px-6 py-5 border-b border-gray-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                            <Brain className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-800 leading-tight">Quiz Interactivo</h2>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Matico AI</p>
                        </div>

                        {/* PAES LEVEL BADGE */}
                        <div className={`${difficultyLevel.color} text-white px-4 py-2 rounded-full font-black text-xs flex items-center gap-2 shadow-md`}>
                            <span>{difficultyLevel.icon}</span>
                            <span>{difficultyLevel.name}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* LIVES DISPLAY */}
                        <LivesDisplay lives={lives} maxLives={MAX_LIVES} />

                        {/* TIMER - Only show if not null (PAES Experto has no timer) */}
                        {timeLeft !== null && (
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold text-lg ${timeLeft < 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                                <Timer className="w-5 h-5" />
                                {timeLeft}s
                            </div>
                        )}

                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400 hover:text-gray-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Progress */}
                <div className="h-2 bg-gray-200 w-full">
                    <div
                        className="h-full bg-[#4D96FF] transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <div className="max-w-3xl mx-auto">

                        {/* Question Card */}
                        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border-2 border-gray-100 mb-8 relative">
                            <div className="absolute -left-3 top-8 w-6 h-12 bg-[#4D96FF] rounded-r-lg"></div>
                            <div className="mb-2 text-[#4D96FF] font-black text-sm uppercase tracking-wider">Pregunta {currentQuestion + 1} de {questions.length}</div>
                            <div className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed">
                                <MathRenderer text={question.question} />
                            </div>
                        </div>

                        {/* Options Grid */}
                        <div className="space-y-4">
                            {Object.entries(question.options).map(([key, value]) => (
                                <button
                                    key={key}
                                    onClick={() => handleAnswerClick(key)}
                                    className={getButtonClass(key)}
                                    disabled={isAnswered}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors duration-300 shadow-sm
                                                ${!isAnswered ? 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600' :
                                                    key === question.correct_answer ? 'bg-green-500 text-white shadow-green-200' :
                                                        key === selectedAnswer ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}
                                            `}>
                                                {key}
                                            </div>
                                            <div className="text-gray-700 font-medium">
                                                <MathRenderer text={value} />
                                            </div>
                                        </div>

                                        {/* Status Icon */}
                                        {isAnswered && (
                                            <div className="animate-scale-in">
                                                {key === question.correct_answer && <Check className="w-6 h-6 text-green-600" strokeWidth={3} />}
                                                {key === selectedAnswer && key !== question.correct_answer && <X className="w-6 h-6 text-red-500" strokeWidth={3} />}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Explanation & Next Button */}
                        {showExplanation && (
                            <div className="mt-8 animate-slide-up">
                                <div className={`p-6 rounded-2xl border-l-4 mb-6 shadow-sm ${selectedAnswer === question.correct_answer
                                    ? 'bg-green-50 border-green-500'
                                    : 'bg-white border-orange-400'
                                    }`}>
                                    <div className="flex gap-4">
                                        <div className={`p-3 rounded-full h-fit ${selectedAnswer === question.correct_answer ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-500'
                                            }`}>
                                            {selectedAnswer === question.correct_answer ? <Star className="w-6 h-6" fill="currentColor" /> : <Zap className="w-6 h-6" fill="currentColor" />}
                                        </div>
                                        <div>
                                            <h4 className={`font-black text-lg mb-2 ${selectedAnswer === question.correct_answer ? 'text-green-800' : 'text-gray-800'
                                                }`}>
                                                {selectedAnswer === question.correct_answer ? '¡Respuesta Correcta!' : 'Explicación del Error'}
                                            </h4>
                                            <div className="text-gray-600 leading-relaxed">
                                                <MathRenderer text={question.explanation} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleNext}
                                    className="w-full bg-[#2B2E4A] hover:bg-[#1a1c2e] text-white font-black text-xl py-5 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center gap-3 group"
                                >
                                    {currentQuestion < questions.length - 1 ? 'Siguiente Pregunta' : 'Ver Resultados'}
                                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(0,0,0,0.1);
                    border-radius: 20px;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                .animate-scale-in {
                    animation: scaleIn 0.3s ease-out forwards;
                }
                @keyframes scaleIn {
                    from { transform: scale(0); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slideUp 0.4s ease-out forwards;
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>

            {/* MINI LESSON - Shows when answer is incorrect */}
            {showMiniLesson && (
                <MiniLesson
                    question={question}
                    selectedAnswer={selectedAnswer}
                    correctAnswer={question.correct_answer}
                    explanation={question.explanation}
                    onComplete={handleNext}
                />
            )}
        </div>
    );
};

export default InteractiveQuiz;
