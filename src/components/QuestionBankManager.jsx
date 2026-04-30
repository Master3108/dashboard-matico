import React, { useEffect, useState } from 'react';
import { BookOpen, Database, Loader } from 'lucide-react';

const SUBJECT_OPTIONS = ['MATEMATICA', 'BIOLOGIA', 'FISICA', 'QUIMICA', 'LENGUAJE', 'HISTORIA'];
const LEVEL_OPTIONS = ['BASICO', 'INTERMEDIO', 'AVANZADO'];
const VISUAL_ROLE_OPTIONS = ['required_for_interpretation', 'supporting'];

const buildEmptyDraft = (selectedAsset = null) => ({
    subject: selectedAsset?.subject || 'MATEMATICA',
    session: '',
    phase: '1',
    levelName: 'BASICO',
    topic: selectedAsset?.topic_tags || selectedAsset?.title || '',
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A',
    explanation: '',
    question_visual_role: 'required_for_interpretation'
});

const QuestionBankManager = ({
    selectedAsset,
    actionButtonClass,
    onSearchQuestionRows,
    onSearchTheoryRows,
    onLinkQuestionAsset,
    onUpdateQuestionVisualRole,
    onLinkTheoryAsset,
    onGenerateQuestionFromAsset,
    onSuggestQuestionMatchesFromAsset,
    onSuggestTheoryMatchesFromAsset,
    onCreateQuestionBankRow
}) => {
    const [questionFilters, setQuestionFilters] = useState({ subject: '', session: '', search: '' });
    const [theoryFilters, setTheoryFilters] = useState({ subject: '', session: '', phase: '', search: '' });
    const [questionRows, setQuestionRows] = useState([]);
    const [theoryRows, setTheoryRows] = useState([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [isLoadingTheory, setIsLoadingTheory] = useState(false);
    const [isSavingQuestion, setIsSavingQuestion] = useState(false);
    const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
    const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = useState(false);
    const [isLoadingAiTheorySuggestions, setIsLoadingAiTheorySuggestions] = useState(false);
    const [aiSuggestedQuestions, setAiSuggestedQuestions] = useState([]);
    const [aiSuggestedTheoryRows, setAiSuggestedTheoryRows] = useState([]);
    const [aiDraft, setAiDraft] = useState(null);
    const [draftForm, setDraftForm] = useState(buildEmptyDraft(selectedAsset));

    useEffect(() => {
        setDraftForm((prev) => ({
            ...prev,
            subject: selectedAsset?.subject || prev.subject || 'MATEMATICA',
            topic: selectedAsset?.topic_tags || selectedAsset?.title || prev.topic
        }));
        setAiSuggestedQuestions([]);
        setAiSuggestedTheoryRows([]);
        setAiDraft(null);
    }, [selectedAsset?.asset_id, selectedAsset?.subject, selectedAsset?.title, selectedAsset?.topic_tags]);

    const refreshQuestions = async () => {
        setIsLoadingQuestions(true);
        try {
            const rows = await onSearchQuestionRows(questionFilters);
            setQuestionRows(rows || []);
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    const refreshTheory = async () => {
        setIsLoadingTheory(true);
        try {
            const rows = await onSearchTheoryRows(theoryFilters);
            setTheoryRows(rows || []);
        } finally {
            setIsLoadingTheory(false);
        }
    };

    const hydrateDraftForm = (draft) => {
        if (!draft) return;
        setAiDraft(draft);
        setDraftForm({
            subject: draft.subject || selectedAsset?.subject || 'MATEMATICA',
            session: draft.session ? String(draft.session) : '',
            phase: draft.phase ? String(draft.phase) : '1',
            levelName: draft.levelName || 'BASICO',
            topic: draft.topic || '',
            question: draft.question || '',
            option_a: draft.options?.A || '',
            option_b: draft.options?.B || '',
            option_c: draft.options?.C || '',
            option_d: draft.options?.D || '',
            correct_answer: draft.correct_answer || 'A',
            explanation: draft.explanation || '',
            question_visual_role: draft.question_visual_role || 'required_for_interpretation'
        });
    };

    const handleGenerateQuestionDraft = async () => {
        if (!selectedAsset) {
            alert('Selecciona un asset primero.');
            return;
        }
        setIsGeneratingDraft(true);
        try {
            const result = await onGenerateQuestionFromAsset(selectedAsset.asset_id, {
                subject: draftForm.subject || selectedAsset.subject,
                session: draftForm.session,
                phase: draftForm.phase,
                levelName: draftForm.levelName
            });
            hydrateDraftForm(result?.ai_draft || null);
        } finally {
            setIsGeneratingDraft(false);
        }
    };

    const handleSuggestMatches = async () => {
        if (!selectedAsset) {
            alert('Selecciona un asset primero.');
            return;
        }
        setIsLoadingAiSuggestions(true);
        try {
            const result = await onSuggestQuestionMatchesFromAsset(selectedAsset.asset_id, {
                subject: draftForm.subject || selectedAsset.subject,
                session: draftForm.session,
                phase: draftForm.phase,
                levelName: draftForm.levelName
            });
            if (result?.ai_draft) hydrateDraftForm(result.ai_draft);
            setAiSuggestedQuestions(result?.items || []);
        } finally {
            setIsLoadingAiSuggestions(false);
        }
    };

    const handleSuggestTheoryMatches = async () => {
        if (!selectedAsset) {
            alert('Selecciona un asset primero.');
            return;
        }
        setIsLoadingAiTheorySuggestions(true);
        try {
            const result = await onSuggestTheoryMatchesFromAsset(selectedAsset.asset_id, {
                subject: theoryFilters.subject || draftForm.subject || selectedAsset.subject,
                session: theoryFilters.session,
                phase: theoryFilters.phase,
                search: theoryFilters.search || `${selectedAsset.topic_tags || ''} ${selectedAsset.caption || ''}`.trim()
            });
            setAiSuggestedTheoryRows(result?.items || []);
        } finally {
            setIsLoadingAiTheorySuggestions(false);
        }
    };

    const handleSaveQuestion = async () => {
        if (!draftForm.question.trim()) {
            alert('La pregunta está vacía.');
            return;
        }
        setIsSavingQuestion(true);
        try {
            const result = await onCreateQuestionBankRow({
                asset_id: selectedAsset?.status === 'approved' ? selectedAsset.asset_id : '',
                subject: draftForm.subject,
                session: draftForm.session,
                phase: draftForm.phase,
                levelName: draftForm.levelName,
                topic: draftForm.topic,
                question: draftForm.question,
                option_a: draftForm.option_a,
                option_b: draftForm.option_b,
                option_c: draftForm.option_c,
                option_d: draftForm.option_d,
                correct_answer: draftForm.correct_answer,
                explanation: draftForm.explanation,
                question_visual_role: draftForm.question_visual_role
            });

            if (result?.item?.question_id) {
                alert(`Pregunta guardada: ${result.item.question_id}`);
                await refreshQuestions();
            }
        } finally {
            setIsSavingQuestion(false);
        }
    };

    const handleLinkSuggestedQuestion = async (questionId) => {
        await onLinkQuestionAsset(questionId, selectedAsset?.asset_id || '');
        await refreshQuestions();
        await handleSuggestMatches();
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h4 className="text-lg font-black text-[#2B2E4A]">QuestionBank Manager</h4>
                        <p className="text-xs font-bold text-[#9094A6]">
                            Crea preguntas nuevas con o sin imagen. Si el asset está aprobado, se adjunta al guardar.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleGenerateQuestionDraft}
                            disabled={!selectedAsset || isGeneratingDraft}
                            className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs ${!selectedAsset ? 'opacity-50 cursor-not-allowed' : '!bg-[#7C3AED] !border-[#6D28D9] text-white'}`}
                        >
                            {isGeneratingDraft ? 'GENERANDO...' : 'BORRADOR IA'}
                        </button>
                        <button
                            onClick={handleSuggestMatches}
                            disabled={!selectedAsset || isLoadingAiSuggestions}
                            className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs ${!selectedAsset ? 'opacity-50 cursor-not-allowed' : '!bg-[#0EA5E9] !border-[#0284C7] text-white'}`}
                        >
                            {isLoadingAiSuggestions ? 'BUSCANDO...' : 'SUGERIR MATCHES'}
                        </button>
                    </div>
                </div>

                {selectedAsset ? (
                    <div className="rounded-2xl border border-[#DCE7FF] bg-[#F8FBFF] p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-[#4D96FF]">Contexto visual activo</p>
                        <p className="mt-1 font-black text-[#2B2E4A]">{selectedAsset.title}</p>
                        <p className="text-xs text-[#9094A6]">{selectedAsset.asset_id} · {selectedAsset.status}</p>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm font-bold text-[#9094A6]">
                        Puedes crear una pregunta manual sin imagen o seleccionar un asset para usar IA y adjuntarlo.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select value={draftForm.subject} onChange={(e) => setDraftForm(prev => ({ ...prev, subject: e.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm">
                        {SUBJECT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <input value={draftForm.session} onChange={(e) => setDraftForm(prev => ({ ...prev, session: e.target.value }))} placeholder="Sesión" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    <input value={draftForm.phase} onChange={(e) => setDraftForm(prev => ({ ...prev, phase: e.target.value }))} placeholder="Fase" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    <select value={draftForm.levelName} onChange={(e) => setDraftForm(prev => ({ ...prev, levelName: e.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm">
                        {LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>

                {aiDraft && (
                    <div className="rounded-2xl border border-[#E9D5FF] bg-[#FAF5FF] p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-[#7C3AED]">Lectura IA de la imagen</p>
                        <p className="mt-2 text-sm font-bold text-[#2B2E4A]">{aiDraft.image_analysis || 'La IA generó un borrador editable para esta imagen.'}</p>
                        {Array.isArray(aiDraft.tags) && aiDraft.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {aiDraft.tags.map((tag) => (
                                    <span key={tag} className="px-2 py-1 rounded-full bg-white border border-[#E9D5FF] text-[11px] font-black text-[#7C3AED]">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input value={draftForm.topic} onChange={(e) => setDraftForm(prev => ({ ...prev, topic: e.target.value }))} placeholder="Tema" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    <select value={draftForm.question_visual_role} onChange={(e) => setDraftForm(prev => ({ ...prev, question_visual_role: e.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm">
                        {VISUAL_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </div>
                <textarea value={draftForm.question} onChange={(e) => setDraftForm(prev => ({ ...prev, question: e.target.value }))} placeholder="Enunciado de la pregunta" rows={3} className="w-full rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm resize-none" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input value={draftForm.option_a} onChange={(e) => setDraftForm(prev => ({ ...prev, option_a: e.target.value }))} placeholder="Opción A" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    <input value={draftForm.option_b} onChange={(e) => setDraftForm(prev => ({ ...prev, option_b: e.target.value }))} placeholder="Opción B" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    <input value={draftForm.option_c} onChange={(e) => setDraftForm(prev => ({ ...prev, option_c: e.target.value }))} placeholder="Opción C" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    <input value={draftForm.option_d} onChange={(e) => setDraftForm(prev => ({ ...prev, option_d: e.target.value }))} placeholder="Opción D" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                    <select value={draftForm.correct_answer} onChange={(e) => setDraftForm(prev => ({ ...prev, correct_answer: e.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm">
                        {['A', 'B', 'C', 'D'].map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <textarea value={draftForm.explanation} onChange={(e) => setDraftForm(prev => ({ ...prev, explanation: e.target.value }))} placeholder="Explicación de la respuesta correcta" rows={3} className="w-full rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm resize-none" />
                </div>
                <button onClick={handleSaveQuestion} disabled={isSavingQuestion} className={`${actionButtonClass} !bg-[#16A34A] !border-[#15803D] hover:!bg-[#15803D] text-white ${isSavingQuestion ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isSavingQuestion ? 'GUARDANDO...' : 'CREAR FILA EN QUESTIONBANK'}
                </button>
                {selectedAsset && selectedAsset.status !== 'approved' && (
                    <p className="text-xs font-black text-[#B45309]">
                        El asset seleccionado aún no está aprobado. La pregunta se guardará, pero sin adjuntar esa imagen.
                    </p>
                )}

                <div className="rounded-2xl border border-gray-100 bg-[#FAFBFF] p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-[#0EA5E9]" />
                        <p className="text-sm font-black text-[#2B2E4A]">Sugerencias IA para preguntas existentes</p>
                    </div>
                    {isLoadingAiSuggestions ? (
                        <div className="py-8 text-center text-[#9094A6]"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />Buscando coincidencias...</div>
                    ) : aiSuggestedQuestions.length === 0 ? (
                        <div className="py-6 text-sm font-bold text-[#9094A6]">Todavía no hay sugerencias. Usa “SUGERIR MATCHES”.</div>
                    ) : (
                        <div className="space-y-3 max-h-[360px] overflow-y-auto">
                            {aiSuggestedQuestions.map((row) => (
                                <div key={`${row.question_id}_${row.suggestion_score}`} className="rounded-2xl border border-gray-100 p-4 bg-white">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-[#0EA5E9]">{row.question_id}</p>
                                            <p className="font-bold text-[#2B2E4A] mt-1 whitespace-pre-wrap">{row.question}</p>
                                            <p className="text-xs text-[#9094A6] mt-2">Sesión {row.session} · Fase {row.phase} · Score IA {row.suggestion_score}</p>
                                        </div>
                                        <button
                                            onClick={() => handleLinkSuggestedQuestion(row.question_id)}
                                            disabled={!selectedAsset || selectedAsset.status !== 'approved'}
                                            className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs ${!selectedAsset || selectedAsset.status !== 'approved' ? 'opacity-50 cursor-not-allowed' : '!bg-[#0EA5E9] !border-[#0284C7] text-white'}`}
                                        >
                                            ASOCIAR ESTA
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-lg font-black text-[#2B2E4A]">Asociar a preguntas del Quiz</h4>
                            <p className="text-xs font-bold text-[#9094A6]">Busca preguntas del QuestionBank y asígnales el asset seleccionado</p>
                        </div>
                        <button onClick={refreshQuestions} className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs`}>BUSCAR</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select value={questionFilters.subject} onChange={(e) => setQuestionFilters(prev => ({ ...prev, subject: e.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm">
                            <option value="">Todas</option>
                            {SUBJECT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input value={questionFilters.session} onChange={(e) => setQuestionFilters(prev => ({ ...prev, session: e.target.value }))} placeholder="Sesión" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                        <input value={questionFilters.search} onChange={(e) => setQuestionFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="Buscar tema o pregunta" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    </div>
                    <div className="max-h-[420px] overflow-y-auto space-y-3">
                        {isLoadingQuestions ? (
                            <div className="py-10 text-center text-[#9094A6]"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />Cargando preguntas...</div>
                        ) : questionRows.length === 0 ? (
                            <div className="py-10 text-center text-[#9094A6]">Busca preguntas para asociar.</div>
                        ) : (
                            questionRows.map((row) => (
                                <div key={row.question_id} className="rounded-2xl border border-gray-100 p-4 bg-[#FAFBFF]">
                                    <p className="text-xs font-black uppercase tracking-widest text-[#4D96FF]">{row.question_id} · {row.subject} · Sesión {row.session} · Fase {row.phase}</p>
                                    <p className="font-bold text-[#2B2E4A] mt-1 whitespace-pre-wrap">{row.question}</p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <button
                                            onClick={() => onLinkQuestionAsset(row.question_id, selectedAsset?.asset_id || '').then(refreshQuestions)}
                                            disabled={!selectedAsset || selectedAsset.status !== 'approved'}
                                            className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs ${!selectedAsset || selectedAsset.status !== 'approved' ? 'opacity-50 cursor-not-allowed' : '!bg-[#4D96FF] !border-[#3B80E6] text-white'}`}
                                        >
                                            {row.prompt_image_asset_id ? 'REEMPLAZAR' : 'ASOCIAR'}
                                        </button>
                                        {row.prompt_image_asset_id && (
                                            <button onClick={() => onLinkQuestionAsset(row.question_id, '').then(refreshQuestions)} className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs !bg-[#FF4B4B] !border-[#D63E3E] text-white`}>
                                                QUITAR
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onUpdateQuestionVisualRole(row.question_id, row.question_visual_role === 'required_for_interpretation' ? 'supporting' : 'required_for_interpretation').then(refreshQuestions)}
                                            className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs !bg-[#7C3AED] !border-[#6D28D9] text-white`}
                                        >
                                            ROLE: {row.question_visual_role || 'supporting'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-[#4D96FF]" />
                                <h4 className="text-lg font-black text-[#2B2E4A]">Asociar a Teoría Lúdica</h4>
                            </div>
                            <p className="text-xs font-bold text-[#9094A6]">Busca filas de teoría y asígnales el asset seleccionado</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={refreshTheory} className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs`}>BUSCAR</button>
                            <button
                                onClick={handleSuggestTheoryMatches}
                                disabled={!selectedAsset || isLoadingAiTheorySuggestions}
                                className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs ${!selectedAsset ? 'opacity-50 cursor-not-allowed' : '!bg-[#0EA5E9] !border-[#0284C7] text-white'}`}
                            >
                                {isLoadingAiTheorySuggestions ? 'BUSCANDO...' : 'SUGERIR IA'}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select value={theoryFilters.subject} onChange={(e) => setTheoryFilters(prev => ({ ...prev, subject: e.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm">
                            <option value="">Todas</option>
                            {SUBJECT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input value={theoryFilters.session} onChange={(e) => setTheoryFilters(prev => ({ ...prev, session: e.target.value }))} placeholder="Sesión" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                        <input value={theoryFilters.phase} onChange={(e) => setTheoryFilters(prev => ({ ...prev, phase: e.target.value }))} placeholder="Fase" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                        <input value={theoryFilters.search} onChange={(e) => setTheoryFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="Buscar tema" className="rounded-2xl border border-gray-200 px-4 py-3 font-bold text-sm" />
                    </div>

                    {aiSuggestedTheoryRows.length > 0 && (
                        <div className="rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] p-4">
                            <p className="text-sm font-black text-[#2B2E4A]">Sugerencias IA para teoría</p>
                            <div className="mt-3 space-y-3 max-h-[220px] overflow-y-auto">
                                {aiSuggestedTheoryRows.map((row) => (
                                    <div key={`${row.rowNumber}_${row.topic}`} className="rounded-2xl border border-[#DBEAFE] bg-white p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-[#0EA5E9]">Fila {row.rowNumber} · Sesión {row.session} · Fase {row.phase}</p>
                                                <p className="font-bold text-[#2B2E4A] mt-1 whitespace-pre-wrap">{row.topic}</p>
                                            </div>
                                            <button
                                                onClick={() => onLinkTheoryAsset(row.rowNumber, selectedAsset?.asset_id || '').then(async () => {
                                                    await refreshTheory();
                                                    await handleSuggestTheoryMatches();
                                                })}
                                                disabled={!selectedAsset || selectedAsset.status !== 'approved'}
                                                className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs ${!selectedAsset || selectedAsset.status !== 'approved' ? 'opacity-50 cursor-not-allowed' : '!bg-[#0EA5E9] !border-[#0284C7] text-white'}`}
                                            >
                                                ASOCIAR ESTA
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="max-h-[420px] overflow-y-auto space-y-3">
                        {isLoadingTheory ? (
                            <div className="py-10 text-center text-[#9094A6]"><Loader className="w-6 h-6 animate-spin mx-auto mb-2" />Cargando teorías...</div>
                        ) : theoryRows.length === 0 ? (
                            <div className="py-10 text-center text-[#9094A6]">Busca teorías para asociar.</div>
                        ) : (
                            theoryRows.map((row) => (
                                <div key={`${row.rowNumber}_${row.timestamp || row.topic}`} className="rounded-2xl border border-gray-100 p-4 bg-[#FAFBFF]">
                                    <p className="text-xs font-black uppercase tracking-widest text-[#4D96FF]">Fila {row.rowNumber} · {row.subject} · Sesión {row.session} · Fase {row.phase}</p>
                                    <p className="font-bold text-[#2B2E4A] mt-1 whitespace-pre-wrap">{row.topic}</p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <button
                                            onClick={() => onLinkTheoryAsset(row.rowNumber, selectedAsset?.asset_id || '').then(refreshTheory)}
                                            disabled={!selectedAsset || selectedAsset.status !== 'approved'}
                                            className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs ${!selectedAsset || selectedAsset.status !== 'approved' ? 'opacity-50 cursor-not-allowed' : '!bg-[#4D96FF] !border-[#3B80E6] text-white'}`}
                                        >
                                            {row.support_image_asset_id ? 'REEMPLAZAR' : 'ASOCIAR'}
                                        </button>
                                        {row.support_image_asset_id && (
                                            <button onClick={() => onLinkTheoryAsset(row.rowNumber, '').then(refreshTheory)} className={`${actionButtonClass} !w-auto !py-2 !px-4 text-xs !bg-[#FF4B4B] !border-[#D63E3E] text-white`}>
                                                QUITAR
                                            </button>
                                        )}
                                    </div>
                                    {row.support_image_url && (
                                        <p className="text-[11px] mt-2 font-bold text-[#16A34A]">Imagen actual: {row.support_image_asset_id || 'Sí'}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionBankManager;
