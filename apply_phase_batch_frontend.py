#!/usr/bin/env python3
# Patches idempotentes para el frontend del flujo "populate_phase_with_images".
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_FILE = os.path.join(ROOT, 'src', 'App.jsx')


def read_file():
    with open(APP_FILE, 'rb') as fh:
        data = fh.read()
    text = data.rstrip(b'\x00').decode('utf-8')
    crlf = '\r\n' in text
    if crlf:
        text = text.replace('\r\n', '\n')
    return text, crlf


def write_file(text, crlf):
    text = text.replace('\x00', '')
    if crlf:
        text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    with open(APP_FILE, 'wb') as fh:
        fh.write(text.encode('utf-8'))


def patch_modal_signature(text):
    if 'onPopulatePhaseWithImages' in text:
        print('[skip] prop onPopulatePhaseWithImages ya existe')
        return text
    needle = '    onUpdateImageGenerationRuntimeConfig\n}) => {'
    if needle not in text:
        raise RuntimeError('No se encontro el cierre del destructuring del modal')
    replacement = '    onUpdateImageGenerationRuntimeConfig,\n    onPopulatePhaseWithImages\n}) => {'
    print('[ok] modal signature patched')
    return text.replace(needle, replacement, 1)


def patch_modal_state(text):
    if 'phaseBatchForm' in text:
        print('[skip] state phaseBatchForm ya existe')
        return text
    anchor = "        question_visual_role: 'required_for_interpretation'\n    });"
    if anchor not in text:
        raise RuntimeError('No se encontro el ancla aiDraftForm useState')
    state_block = anchor + """
    const [phaseBatchForm, setPhaseBatchForm] = useState({
        subject: 'MATEMATICA',
        session: '1',
        phase: '1',
        levelName: 'BASICO',
        count: '15',
        image_cap: '6',
        min_image_score: '5',
        size: '1024x1024'
    });
    const [phaseBatchResult, setPhaseBatchResult] = useState(null);
    const [isRunningPhaseBatch, setIsRunningPhaseBatch] = useState(false);"""
    print('[ok] modal state patched')
    return text.replace(anchor, state_block, 1)


def patch_modal_handler(text):
    if 'handleRunPhaseBatch' in text:
        print('[skip] handler handleRunPhaseBatch ya existe')
        return text
    anchor = "        } finally {\n            setIsGeneratingAiDraft(false);\n        }\n    };\n\n    return ("
    if anchor not in text:
        raise RuntimeError('No se encontro el ancla del return del modal')
    handler_block = """        } finally {
            setIsGeneratingAiDraft(false);
        }
    };

    const handleRunPhaseBatch = async () => {
        if (!onPopulatePhaseWithImages) return;
        const subject = String(phaseBatchForm.subject || 'MATEMATICA').toUpperCase();
        const session = Number(phaseBatchForm.session || 0) || 0;
        const phase = Number(phaseBatchForm.phase || 0) || 0;
        const count = Math.max(3, Math.min(20, Number(phaseBatchForm.count || 15) || 15));
        const cap = Math.max(0, Math.min(15, Number(phaseBatchForm.image_cap || 6) || 6));
        const minScore = Math.max(0, Math.min(10, Number(phaseBatchForm.min_image_score || 5) || 5));
        if (!session || !phase) {
            alert('Indica sesion y fase (numeros enteros)');
            return;
        }
        if (!window.confirm('Vas a generar ' + count + ' preguntas y hasta ' + cap + ' imagenes nuevas para ' + subject + ' sesion ' + session + ' fase ' + phase + '. Esto consume tokens y costo de imagenes. Continuar?')) {
            return;
        }
        setIsRunningPhaseBatch(true);
        setPhaseBatchResult(null);
        try {
            const result = await onPopulatePhaseWithImages({
                subject,
                session,
                phase,
                levelName: phaseBatchForm.levelName,
                count,
                image_cap: cap,
                min_image_score: minScore,
                size: phaseBatchForm.size
            });
            setPhaseBatchResult(result);
            await onRefreshAssets(assetFilters);
        } catch (err) {
            alert('Error en batch de fase: ' + (err && err.message ? err.message : err));
        } finally {
            setIsRunningPhaseBatch(false);
        }
    };

    return ("""
    print('[ok] modal handler patched')
    return text.replace(anchor, handler_block, 1)


def patch_modal_ui(text):
    if 'Generar batch IA por fase' in text:
        print('[skip] UI phase batch ya existe')
        return text
    anchor = '                        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-4">\n                            <div className="flex flex-col md:flex-row gap-3">\n                                <select value={assetFilters.subject}'
    if anchor not in text:
        raise RuntimeError('No se encontro el ancla del bloque de filtros de assets')
    panel = '''                        <div className="bg-white rounded-3xl border border-[#FDE68A] p-5 shadow-sm space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-lg font-black text-[#92400E]">Generar batch IA por fase</h4>
                                    <p className="text-xs font-bold text-[#9094A6] mt-1">La IA crea {phaseBatchForm.count || 15} preguntas para una fase y elige cuales son mas idoneas para acompanar con imagen. Tope: {phaseBatchForm.image_cap || 6} imagenes por fase (suma a las existentes).</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <select value={phaseBatchForm.subject} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, subject: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs">
                                    {['MATEMATICA', 'BIOLOGIA', 'FISICA', 'QUIMICA', 'LENGUAJE', 'HISTORIA'].map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                                <input type="number" min="1" value={phaseBatchForm.session} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, session: e.target.value }))} placeholder="Sesion" className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs" />
                                <input type="number" min="1" max="3" value={phaseBatchForm.phase} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, phase: e.target.value }))} placeholder="Fase" className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs" />
                                <select value={phaseBatchForm.levelName} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, levelName: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs">
                                    {['BASICO', 'INTERMEDIO', 'AVANZADO'].map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <label className="text-[10px] font-black text-[#92400E] flex flex-col gap-1">
                                    PREGUNTAS
                                    <input type="number" min="3" max="20" value={phaseBatchForm.count} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, count: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs text-[#2B2E4A]" />
                                </label>
                                <label className="text-[10px] font-black text-[#92400E] flex flex-col gap-1">
                                    CAP IMAGENES
                                    <input type="number" min="0" max="15" value={phaseBatchForm.image_cap} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, image_cap: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs text-[#2B2E4A]" />
                                </label>
                                <label className="text-[10px] font-black text-[#92400E] flex flex-col gap-1">
                                    SCORE MIN
                                    <input type="number" min="0" max="10" value={phaseBatchForm.min_image_score} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, min_image_score: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs text-[#2B2E4A]" />
                                </label>
                                <label className="text-[10px] font-black text-[#92400E] flex flex-col gap-1">
                                    SIZE
                                    <select value={phaseBatchForm.size} onChange={(e) => setPhaseBatchForm(prev => ({ ...prev, size: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2 font-bold text-xs text-[#2B2E4A]">
                                        {['1024x1024', '1536x1024', '1024x1536'].map((size) => <option key={size} value={size}>{size}</option>)}
                                    </select>
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={handleRunPhaseBatch}
                                disabled={isRunningPhaseBatch}
                                className={`${clayBtnAction} !bg-[#F59E0B] !border-[#D97706] hover:!bg-[#D97706] text-white ${isRunningPhaseBatch ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isRunningPhaseBatch ? 'GENERANDO BATCH (puede tardar 1-2 min)...' : 'GENERAR BATCH PARA FASE'}
                            </button>

                            {phaseBatchResult && (
                                <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 space-y-3">
                                    <div className="flex flex-wrap gap-2 text-[11px] font-black text-[#92400E]">
                                        <span className="px-2 py-1 rounded-full bg-white border border-[#FDE68A]">SUBJECT: {phaseBatchResult.subject}</span>
                                        <span className="px-2 py-1 rounded-full bg-white border border-[#FDE68A]">SESION {phaseBatchResult.session}</span>
                                        <span className="px-2 py-1 rounded-full bg-white border border-[#FDE68A]">FASE {phaseBatchResult.phase}</span>
                                        <span className="px-2 py-1 rounded-full bg-white border border-[#FDE68A]">{phaseBatchResult.levelName}</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                        <div className="rounded-xl bg-white border border-gray-100 p-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Preguntas</p>
                                            <p className="text-lg font-black text-[#2B2E4A]">{phaseBatchResult.saved_count || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-white border border-gray-100 p-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Imagenes</p>
                                            <p className="text-lg font-black text-[#1F9D55]">{phaseBatchResult.images_generated || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-white border border-gray-100 p-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Skip cap</p>
                                            <p className="text-lg font-black text-[#9094A6]">{phaseBatchResult.images_skipped_cap_full || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-white border border-gray-100 p-3">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Cap fase</p>
                                            <p className="text-lg font-black text-[#7C3AED]">{phaseBatchResult.existing_images_in_phase || 0}/{phaseBatchResult.cap_per_phase || 6}</p>
                                        </div>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto space-y-2">
                                        {(phaseBatchResult.items || []).map((item, idx) => (
                                            <div key={item.question_id || idx} className={`rounded-xl border p-3 ${item.had_image_attached ? 'border-[#86EFAC] bg-[#F0FDF4]' : 'border-gray-100 bg-white'}`}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-xs font-black text-[#2B2E4A] flex-1">{item.question}</p>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.had_image_attached ? 'bg-[#1F9D55] text-white' : item.was_image_candidate ? 'bg-[#F59E0B] text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                            {item.had_image_attached ? 'CON IMG' : item.was_image_candidate ? 'CAP LLENO' : 'SIN IMG'}
                                                        </span>
                                                        <span className="text-[10px] font-black text-[#9094A6]">SCORE {item.image_score}</span>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-[#9094A6] mt-1">{item.topic} | {item.image_role}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        ''' + anchor
    print('[ok] modal UI patched')
    return text.replace(anchor, panel, 1)


def patch_parent_helper(text):
    if 'populatePhaseWithImages' in text:
        print('[skip] helper populatePhaseWithImages ya existe')
        return text
    anchor = """    const generatePedagogicalImage = async (payload = {}) => {
        const response = await fetch(activeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'generate_pedagogical_image',
                email: currentUser?.email,
                user_id: USER_ID,
                ...payload
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'No se pudo generar la imagen pedagógica');
        }
        await loadAdminPedagogicalAssets();
        return data.item;
    };"""
    if anchor not in text:
        raise RuntimeError('No se encontro generatePedagogicalImage en el padre')
    new_helper = anchor + """

    const populatePhaseWithImages = async (payload = {}) => {
        const response = await fetch(activeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'populate_phase_with_images',
                email: currentUser?.email,
                user_id: USER_ID,
                ...payload
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'No se pudo generar el batch de fase');
        }
        try { await loadAdminPedagogicalAssets(); } catch (e) { /* noop */ }
        return data;
    };"""
    print('[ok] parent helper patched')
    return text.replace(anchor, new_helper, 1)


def patch_parent_prop_passing(text):
    if 'onPopulatePhaseWithImages={populatePhaseWithImages}' in text:
        print('[skip] prop onPopulatePhaseWithImages ya pasado al modal')
        return text
    anchor = '                    onUpdateImageGenerationRuntimeConfig={updateImageGenerationRuntimeConfig}\n                />'
    if anchor not in text:
        raise RuntimeError('No se encontro el cierre del modal AdminPedagogicalAssetsModal')
    replacement = '                    onUpdateImageGenerationRuntimeConfig={updateImageGenerationRuntimeConfig}\n                    onPopulatePhaseWithImages={populatePhaseWithImages}\n                />'
    print('[ok] parent prop passing patched')
    return text.replace(anchor, replacement, 1)


def main():
    text, crlf = read_file()
    text = patch_modal_signature(text)
    text = patch_modal_state(text)
    text = patch_modal_handler(text)
    text = patch_modal_ui(text)
    text = patch_parent_helper(text)
    text = patch_parent_prop_passing(text)
    write_file(text, crlf)
    print('[done] frontend patched (crlf=' + str(crlf) + '). Lineas:', text.count('\n') + 1)


if __name__ == '__main__':
    main()
