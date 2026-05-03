import React, { useState } from 'react';
import { X } from 'lucide-react';
import OracleNotebookExamBuilder from './OracleNotebookExamBuilder';

const QUESTION_COUNT_OPTIONS = [15, 30, 45];

/**
 * Modal "Crear prueba" — idéntico al Oráculo Matico (modo notebook):
 * selector de cantidad + subir fotos → analizar → generar preguntas → iniciar quiz.
 */
const ExamCaptureModal = ({
    isOpen,
    onClose,
    userId,
    userEmail,
    defaultSubject = 'MATEMATICA',
    defaultSession = 1,
    onExamReady
}) => {
    const [questionCount, setQuestionCount] = useState(15);

    if (!isOpen) return null;

    const handleExamReady = (payload) => {
        onExamReady?.(payload);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-black text-[#2B2E4A]">Crear prueba desde fotos</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-[#475569] mb-4">
                    Sube hasta 10 fotos de tu cuaderno o materia. El sistema las analiza, detecta el tema y genera una prueba interactiva.
                </p>

                {/* Selector de cantidad de preguntas — igual que Oráculo */}
                <div className="bg-[#F8FAFF] rounded-2xl p-4 border border-[#E5ECFF] mb-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#9094A6] mb-3">Cantidad de preguntas</h4>
                    <div className="grid grid-cols-3 gap-3">
                        {QUESTION_COUNT_OPTIONS.map((count) => (
                            <button
                                key={count}
                                onClick={() => setQuestionCount(count)}
                                className={`rounded-2xl border-2 px-3 py-3 font-black transition-all ${questionCount === count
                                    ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-md'
                                    : 'bg-white text-[#64748B] border-gray-200 hover:border-[#7C3AED]/40'
                                    }`}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                </div>

                <OracleNotebookExamBuilder
                    defaultSubject={defaultSubject}
                    defaultSession={defaultSession}
                    questionCount={questionCount}
                    userId={userId}
                    userEmail={userEmail}
                    onExamReady={handleExamReady}
                />
            </div>
        </div>
    );
};

export default ExamCaptureModal;
