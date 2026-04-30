import React from 'react';
import { X } from 'lucide-react';
import OracleNotebookExamBuilder from './OracleNotebookExamBuilder';

/**
 * Modal "Crear prueba" — ahora usa el mismo flujo que el Oráculo:
 * subir fotos del cuaderno → analizar → generar preguntas → iniciar quiz.
 */
const ExamCaptureModal = ({
    isOpen,
    onClose,
    userId,
    userEmail,
    defaultSubject = 'MATEMATICA',
    defaultSession = 1,
    questionCount = 15,
    onExamReady
}) => {
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
