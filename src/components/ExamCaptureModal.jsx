import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import EvidenceIntake, { DEFAULT_MAX_EVIDENCE } from './EvidenceIntake';

const ExamCaptureModal = ({ isOpen, onClose, userId, userEmail }) => {
    const [evidences, setEvidences] = useState([]);
    const [status, setStatus] = useState('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [eventPreview, setEventPreview] = useState(null);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);
    const [eventId, setEventId] = useState('');
    const [formData, setFormData] = useState({ subject: '', exam_date: '', title: '', notes: '' });
    const [events, setEvents] = useState([]);

    const resetState = () => {
        setEvidences([]);
        setStatus('idle');
        setErrorMsg('');
        setEventPreview(null);
        setNeedsConfirmation(false);
        setEventId('');
        setFormData({ subject: '', exam_date: '', title: '', notes: '' });
    };

    const closeModal = () => {
        resetState();
        onClose?.();
    };

    const loadEvents = async () => {
        if (!userId) return;
        try {
            const response = await fetch(`/api/exams/list?user_id=${encodeURIComponent(userId)}`);
            const data = await response.json();
            if (response.ok && data.success) setEvents(data.events || []);
        } catch {
            // silent
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        loadEvents();
    }, [isOpen]);

    const submitIntake = async () => {
        if (!evidences.length) {
            setErrorMsg('Debes agregar al menos una captura.');
            return;
        }
        if (!userId) {
            setErrorMsg('Falta user_id para crear la prueba.');
            return;
        }
        setStatus('submitting');
        setErrorMsg('');
        try {
            const response = await fetch('/api/exams/intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    email: userEmail || '',
                    source_type: 'screenshot',
                    evidences: evidences.map((item, index) => ({
                        image_base64: item.imageBase64,
                        image_mime_type: item.imageMimeType || 'image/jpeg',
                        source_type: item.sourceType || 'screenshot',
                        page_number: index + 1
                    }))
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo crear');

            setEventId(data.event_id);
            setNeedsConfirmation(Boolean(data.needs_confirmation));
            setEventPreview(data.event_preview || null);
            setFormData({
                subject: data.event_preview?.subject || '',
                exam_date: data.event_preview?.exam_date || '',
                title: data.event_preview?.title || '',
                notes: data.event_preview?.notes || ''
            });
            setStatus('done');
            await loadEvents();
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo crear la prueba');
            setStatus('idle');
        }
    };

    const confirmEvent = async () => {
        if (!eventId) return;
        try {
            const response = await fetch('/api/exams/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: eventId,
                    confirm: true,
                    confirmed_data: formData
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo confirmar');
            setNeedsConfirmation(false);
            await loadEvents();
        } catch (error) {
            setErrorMsg(error.message || 'No se pudo confirmar la prueba');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-black text-[#2B2E4A]">Crear prueba</h3>
                    <button onClick={closeModal} className="p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <EvidenceIntake
                            maxEvidence={DEFAULT_MAX_EVIDENCE}
                            value={evidences}
                            onChange={setEvidences}
                            onError={setErrorMsg}
                            showNativeCapture
                            showPasteHint={false}
                            nativeQueueOnly
                        />

                        <button onClick={submitIntake} disabled={status === 'submitting'} className="w-full py-3 rounded-xl bg-[#4D96FF] text-white font-black">
                            {status === 'submitting' ? 'Analizando...' : 'Analizar y crear prueba'}
                        </button>

                        {errorMsg && (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {eventPreview && (
                            <div className="border rounded-2xl p-4 bg-slate-50">
                                <h4 className="font-black text-[#2B2E4A] mb-2">Resultado OCR</h4>
                                <p className="text-sm"><strong>Materia:</strong> {eventPreview.subject || '-'}</p>
                                <p className="text-sm"><strong>Fecha:</strong> {eventPreview.exam_date || '-'}</p>
                                <p className="text-sm"><strong>Prueba:</strong> {eventPreview.title || '-'}</p>
                                <p className="text-sm"><strong>Email apoderado:</strong> {eventPreview.guardian_email || '-'}</p>
                            </div>
                        )}

                        {needsConfirmation && (
                            <div className="border rounded-2xl p-4 bg-amber-50 border-amber-200">
                                <h4 className="font-black text-amber-800 mb-2">Confirmacion requerida</h4>
                                <div className="space-y-2">
                                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Materia" value={formData.subject} onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))} />
                                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Fecha YYYY-MM-DD" value={formData.exam_date} onChange={(e) => setFormData((prev) => ({ ...prev, exam_date: e.target.value }))} />
                                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nombre prueba" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} />
                                    <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notas" value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} />
                                    <button onClick={confirmEvent} className="w-full py-2 rounded-xl bg-amber-600 text-white font-bold">Confirmar y programar recordatorios</button>
                                </div>
                            </div>
                        )}

                        <div className="border rounded-2xl p-4">
                            <h4 className="font-black text-[#2B2E4A] mb-2">Proximos recordatorios</h4>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                                {events.length === 0 && <p className="text-sm text-gray-500">Sin eventos registrados.</p>}
                                {events.map((event) => (
                                    <div key={event.event_id} className="border rounded-xl p-3 text-sm">
                                        <p><strong>{event.subject || 'MATERIA'}</strong> - {event.title || 'Prueba'}</p>
                                        <p>Fecha: {event.exam_date || '-'}</p>
                                        <p>Estado: {event.status}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> D-7:{event.sent_d7 ? 'ok' : 'pend'} | D-2:{event.sent_d2 ? 'ok' : 'pend'} | D-1:{event.sent_d1 ? 'ok' : 'pend'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExamCaptureModal;
