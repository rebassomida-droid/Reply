import { useEffect, useState, useRef, DragEvent, FormEvent } from 'react';
import {
  Bot, Save, RefreshCw, CheckCircle, AlertCircle,
  Plus, Trash2, Phone, User, ToggleLeft, ToggleRight,
  Pencil, X, Check, Briefcase, BookOpen, Upload, Loader2,
} from 'lucide-react';
import api from '../lib/api';
import DocumentCard from '../components/DocumentCard';

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  name: string;
  persona_prompt: string;
  transfer_number: string;
  transfer_trigger: string;
  language: string;
  voice_id: string;
  first_message: string;
  end_call_message: string;
  vapi_assistant_id?: string;
  // Impostazioni voce avanzate
  voice_speed: number;
  voice_stability: number;
  voice_similarity_boost: number;
  voice_style: number;
  voice_style_degree: number;
  voice_use_speaker_boost: boolean;
}

interface Operator {
  id?: number;
  name: string;
  phone_number: string;
  role: string;
  active: boolean;
}

interface Voice {
  id: string;
  name: string;
  provider: string;
}

interface Document {
  id: number;
  original_name: string;
  file_type: string;
  chunk_count: number;
  file_size: number;
  uploaded_at: string;
}

// ─── Slider helper ───────────────────────────────────────────────────────────

function Slider({
  label, hint, value, min, max, step = 0.01,
  onChange, format,
}: {
  label: string; hint?: string; value: number;
  min: number; max: number; step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  // Converte sempre in numero sicuro (PostgreSQL NUMERIC arriva come stringa)
  const n = isNaN(Number(value)) ? min : Math.min(max, Math.max(min, Number(value)));
  const pct = ((n - min) / (max - min)) * 100;
  const display = format ? format(n) : n.toFixed(2);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600 min-w-[48px] text-center">
          {display}
        </span>
      </div>
      <div className="relative">
        <input
          type="range" min={min} max={max} step={step} value={n}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200"
          style={{
            background: `linear-gradient(to right, #3B82F6 ${pct}%, #E5E7EB ${pct}%)`,
          }}
        />
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── VoiceSettings sub-component ──────────────────────────────────────────────

function VoiceSettings({
  config, setConfig,
}: {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
}) {
  const isElevenLabs = !config.voice_id?.includes('Neural') &&
    !config.voice_id?.match(/^[a-z]{2}-[A-Z]{2}-/);

  function setV(field: keyof AgentConfig) {
    return (val: number) => setConfig((p) => ({ ...p, [field]: val }));
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Impostazioni voce</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {isElevenLabs ? 'ElevenLabs' : 'Azure Neural'}
        </span>
      </div>

      {/* Velocità — universale */}
      <Slider
        label="Velocità"
        hint={isElevenLabs ? "0.7 = lento · 1.0 = normale · 1.2 = veloce" : "0.5 = lento · 1.0 = normale · 2.0 = veloce"}
        value={config.voice_speed}
        min={isElevenLabs ? 0.7 : 0.5}
        max={isElevenLabs ? 1.2 : 2.0}
        step={0.05}
        onChange={setV('voice_speed')}
        format={(v) => `${v.toFixed(2)}×`}
      />

      {/* Azure: Style Degree */}
      {!isElevenLabs && (
        <Slider
          label="Intensità stile"
          hint="Quanto marcato è lo stile espressivo della voce (0.01 = neutro · 2.0 = molto espressivo)"
          value={config.voice_style_degree}
          min={0.01} max={2.0} step={0.01}
          onChange={setV('voice_style_degree')}
        />
      )}

      {/* ElevenLabs: Stability */}
      {isElevenLabs && (
        <>
          <Slider
            label="Stabilità"
            hint="Alto = voce consistente · Basso = più espressiva e variabile"
            value={config.voice_stability}
            min={0} max={1} step={0.01}
            onChange={setV('voice_stability')}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Chiarezza + Somiglianza"
            hint="Quanto la voce somiglia al campione originale"
            value={config.voice_similarity_boost}
            min={0} max={1} step={0.01}
            onChange={setV('voice_similarity_boost')}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Stile"
            hint="Quanto la voce amplifica lo stile (aumenta latenza)"
            value={config.voice_style}
            min={0} max={1} step={0.01}
            onChange={setV('voice_style')}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-700">Speaker Boost</p>
              <p className="text-xs text-gray-400">Aumenta la somiglianza al campione originale</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, voice_use_speaker_boost: !p.voice_use_speaker_boost }))}
              className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center px-0.5 ${config.voice_use_speaker_boost ? 'bg-brand-blue' : 'bg-gray-300'}`}
            >
              <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${config.voice_use_speaker_boost ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const DEFAULT_PROMPT = `Sei Giulia, l'assistente virtuale dello Studio Housetag di Antonino Basso, Perito Industriale iscritto al Collegio di Milano n. 7165, con sede in Via A. Volta 48, Cesano Maderno (MB).

Rispondi in italiano con tono professionale ma cordiale.
Puoi aiutare su: certificazioni energetiche (APE), perizie immobiliari, pratiche urbanistiche e catastali, sicurezza cantieri (PSC/POS), consulenze CTU/CTP al Tribunale di Monza.

Se non conosci la risposta o la richiesta richiede valutazione diretta del professionista, proponi di trasferire la chiamata a un operatore disponibile.

Orari studio: Lun-Ven 9:00-18:00.`;

const EMPTY_OP: Operator = { name: '', phone_number: '', role: '', active: true };

type Tab = 'agent' | 'knowledge';
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

// ─── Componente principale ───────────────────────────────────────────────────

export default function AgentConfig() {
  const [tab, setTab] = useState<Tab>('agent');

  // ── Agente state ──
  const [config, setConfig] = useState<AgentConfig>({
    name: 'Giulia — Assistente Housetag',
    persona_prompt: DEFAULT_PROMPT,
    transfer_number: '',
    transfer_trigger: '',
    language: 'it',
    voice_id: 'it-IT-ElsaNeural',
    first_message: 'Buongiorno, sono Giulia dello Studio Housetag. Come posso aiutarla?',
    end_call_message: 'Grazie per aver contattato lo Studio Housetag. Buona giornata!',
    voice_speed: 1.0,
    voice_stability: 0.5,
    voice_similarity_boost: 0.75,
    voice_style: 0.0,
    voice_style_degree: 1.0,
    voice_use_speaker_boost: true,
  });
  const [operators, setOperators] = useState<Operator[]>([]);
  const [newOp, setNewOp] = useState<Operator>(EMPTY_OP);
  const [showAddOp, setShowAddOp] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Operator>(EMPTY_OP);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ── Knowledge state ──
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Toast ──
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Load ──
  useEffect(() => {
    api.get('/agent').then((r) => {
      const d = r.data;
      // PostgreSQL NUMERIC columns arrive as strings — parse them
      const pf = (v: unknown, fallback: number) => {
        const n = parseFloat(String(v));
        return isNaN(n) ? fallback : n;
      };
      setConfig({
        ...d,
        voice_speed:             pf(d.voice_speed, 1.0),
        voice_stability:         pf(d.voice_stability, 0.5),
        voice_similarity_boost:  pf(d.voice_similarity_boost, 0.75),
        voice_style:             pf(d.voice_style, 0.0),
        voice_style_degree:      pf(d.voice_style_degree, 1.0),
        voice_use_speaker_boost: Boolean(d.voice_use_speaker_boost),
      });
    }).catch(() => {});
    api.get('/vapi/voices').then((r) => setVoices(r.data)).catch(() => {});
    api.get('/operators').then((r) => setOperators(r.data)).catch(() => {});
    loadDocuments();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Agente: handlers
  // ─────────────────────────────────────────────────────────────────────────────

  function set(field: keyof AgentConfig) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setConfig((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/agent', config);
      showToast('success', 'Configurazione salvata');
    } catch {
      showToast('error', 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await api.put('/agent', config);
      const res = await api.post('/agent/sync');
      const opCount = res.data.operators_synced ?? 0;
      showToast('success', `Sincronizzato su Vapi — ${opCount} operator${opCount === 1 ? 'e' : 'i'}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Errore';
      showToast('error', msg);
    } finally {
      setSyncing(false);
    }
  }

  // Operatori
  async function addOperator() {
    if (!newOp.name.trim() || !newOp.phone_number.trim()) return;
    try {
      const res = await api.post('/operators', newOp);
      setOperators((prev) => [...prev, res.data]);
      setNewOp(EMPTY_OP);
      setShowAddOp(false);
      showToast('success', `Operatore "${res.data.name}" aggiunto`);
    } catch { showToast('error', 'Errore aggiunta operatore'); }
  }

  async function toggleOperator(op: Operator) {
    if (!op.id) return;
    try {
      const res = await api.put(`/operators/${op.id}`, { active: !op.active });
      setOperators((prev) => prev.map((o) => (o.id === op.id ? res.data : o)));
    } catch { showToast('error', 'Errore aggiornamento'); }
  }

  function startEdit(op: Operator) {
    setEditingId(op.id ?? null);
    setEditDraft({ ...op });
    setShowAddOp(false);
  }

  async function saveEdit(id: number) {
    if (!editDraft.name.trim() || !editDraft.phone_number.trim()) return;
    try {
      const res = await api.put(`/operators/${id}`, editDraft);
      setOperators((prev) => prev.map((o) => (o.id === id ? res.data : o)));
      setEditingId(null);
      showToast('success', 'Operatore aggiornato');
    } catch { showToast('error', 'Errore salvataggio'); }
  }

  async function deleteOperator(id: number) {
    try {
      await api.delete(`/operators/${id}`);
      setOperators((prev) => prev.filter((o) => o.id !== id));
      showToast('success', 'Operatore rimosso');
    } catch { showToast('error', 'Errore eliminazione'); }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Knowledge: handlers
  // ─────────────────────────────────────────────────────────────────────────────

  function loadDocuments() {
    api.get('/documents').then((r) => setDocuments(r.data)).catch(() => {});
  }

  async function uploadFile(file: File) {
    const isAllowed = file.name.match(/\.(pdf|docx|txt)$/i);
    if (!isAllowed) {
      setUploadState('error');
      setUploadMessage('Tipo file non supportato. Usa PDF, DOCX o TXT.');
      return;
    }
    setUploadState('uploading');
    setUploadMessage(`Elaborazione ${file.name}…`);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadState('success');
      setUploadMessage(`"${res.data.original_name}" caricato — ${res.data.chunk_count} chunk`);
      loadDocuments();
      setTimeout(() => setUploadState('idle'), 4000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Errore caricamento';
      setUploadState('error');
      setUploadMessage(msg);
      setTimeout(() => setUploadState('idle'), 4000);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminare questo documento dalla knowledge base?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert("Errore durante l'eliminazione");
    } finally {
      setDeletingId(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: riga operatore editing
  // ─────────────────────────────────────────────────────────────────────────────

  function renderEditRow(op: Operator) {
    return (
      <div key={op.id} className="border border-brand-blue/40 bg-blue-50/50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-brand-blue">Modifica operatore</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Nome</label>
            <div className="relative">
              <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-7 py-1.5 text-sm" value={editDraft.name}
                onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label text-xs">Telefono</label>
            <div className="relative">
              <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-7 py-1.5 text-sm" value={editDraft.phone_number}
                onChange={(e) => setEditDraft((p) => ({ ...p, phone_number: e.target.value }))} />
            </div>
          </div>
        </div>
        <div>
          <label className="label text-xs">Ruolo / Reparto</label>
          <div className="relative">
            <Briefcase size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-7 py-1.5 text-sm" placeholder="es. Ufficio Amministrativo…"
              value={editDraft.role}
              onChange={(e) => setEditDraft((p) => ({ ...p, role: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-3 flex items-center gap-1">
            <X size={13} /> Annulla
          </button>
          <button type="button" onClick={() => op.id && saveEdit(op.id)}
            disabled={!editDraft.name.trim() || !editDraft.phone_number.trim()}
            className="btn-primary text-xs py-1 px-3 flex items-center gap-1 disabled:opacity-50">
            <Check size={13} /> Salva
          </button>
        </div>
      </div>
    );
  }

  function renderRow(op: Operator) {
    return (
      <div key={op.id}
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${op.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${op.active ? 'bg-green-100' : 'bg-gray-100'}`}>
          <User size={15} className={op.active ? 'text-green-600' : 'text-gray-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{op.name}</p>
          <p className="text-xs text-gray-500 font-mono">{op.phone_number}</p>
          {op.role && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-brand-blue bg-blue-50 px-1.5 py-0.5 rounded">
              <Briefcase size={10} />{op.role}
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${op.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {op.active ? 'Attivo' : 'Disattivo'}
        </span>
        <button type="button" onClick={() => startEdit(op)} className="text-gray-300 hover:text-brand-blue transition-colors p-1" title="Modifica">
          <Pencil size={14} />
        </button>
        <button type="button" onClick={() => toggleOperator(op)} className="text-gray-400 hover:text-brand-blue transition-colors p-1" title={op.active ? 'Disattiva' : 'Attiva'}>
          {op.active ? <ToggleRight size={20} className="text-brand-blue" /> : <ToggleLeft size={20} />}
        </button>
        <button type="button" onClick={() => op.id && deleteOperator(op.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1" title="Elimina">
          <Trash2 size={15} />
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render principale
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-blue/10 rounded-xl flex items-center justify-center">
            <Bot size={18} className="text-brand-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Agente AI</h1>
            <p className="text-gray-500 text-xs mt-0.5">Configurazione e knowledge base dell'assistente vocale</p>
          </div>
        </div>
        {config.vapi_assistant_id && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
            Vapi: {config.vapi_assistant_id.substring(0, 8)}…
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setTab('agent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'agent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Bot size={15} />
          Configurazione
        </button>
        <button
          onClick={() => setTab('knowledge')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'knowledge' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BookOpen size={15} />
          Knowledge Base
          {documents.length > 0 && (
            <span className="bg-brand-blue text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {documents.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB: Configurazione ── */}
      {tab === 'agent' && (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Identità */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Identità agente</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nome agente</label>
                <input className="input" value={config.name} onChange={set('name')} />
              </div>
              <div>
                <label className="label">Lingua</label>
                <select className="input" value={config.language} onChange={set('language')}>
                  <option value="it">Italiano</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Voce</label>
              <select className="input" value={config.voice_id} onChange={set('voice_id')}>
                {voices.length > 0 ? voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                )) : (
                  <>
                    <option value="it-IT-ElsaNeural">Elsa — Italiano F (Azure)</option>
                    <option value="it-IT-IsabellaNeural">Isabella — Italiano F (Azure)</option>
                    <option value="it-IT-DiegoNeural">Diego — Italiano M (Azure)</option>
                    <option value="it-IT-BenignoNeural">Benigno — Italiano M (Azure)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Impostazioni Voce */}
          <VoiceSettings config={config} setConfig={setConfig} />

          {/* Prompt */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Prompt di sistema</h2>
            <textarea className="input min-h-[220px] resize-y font-mono text-xs"
              value={config.persona_prompt} onChange={set('persona_prompt')}
              placeholder="Descrivi chi è l'assistente e come deve comportarsi…" />
          </div>

          {/* Messaggi */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Messaggi predefiniti</h2>
            <div>
              <label className="label">Messaggio di benvenuto</label>
              <input className="input" value={config.first_message} onChange={set('first_message')} />
            </div>
            <div>
              <label className="label">Messaggio di chiusura</label>
              <input className="input" value={config.end_call_message} onChange={set('end_call_message')} />
            </div>
          </div>

          {/* Operatori */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Operatori umani — Deviazione chiamata</h2>
                <p className="text-xs text-gray-400 mt-0.5">L'AI instrada la chiamata all'operatore corretto in base al ruolo</p>
              </div>
              <button type="button" onClick={() => { setShowAddOp((v) => !v); setEditingId(null); }}
                className="flex items-center gap-1.5 bg-brand-blue text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={14} /> Aggiungi operatore
              </button>
            </div>

            {showAddOp && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-blue-700">Nuovo operatore</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Nome</label>
                    <div className="relative">
                      <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-7" placeholder="es. Antonino Basso" value={newOp.name}
                        onChange={(e) => setNewOp((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label text-xs">Numero di telefono</label>
                    <div className="relative">
                      <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-7" placeholder="+39 02 12345678" value={newOp.phone_number}
                        onChange={(e) => setNewOp((p) => ({ ...p, phone_number: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label text-xs">Ruolo / Reparto <span className="text-gray-400 font-normal">(opzionale)</span></label>
                  <div className="relative">
                    <Briefcase size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-7" placeholder="es. Ufficio Amministrativo, Direzione…" value={newOp.role}
                      onChange={(e) => setNewOp((p) => ({ ...p, role: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowAddOp(false); setNewOp(EMPTY_OP); }} className="btn-secondary text-xs py-1.5 px-3">
                    Annulla
                  </button>
                  <button type="button" onClick={addOperator}
                    disabled={!newOp.name.trim() || !newOp.phone_number.trim()}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-50">
                    <Plus size={13} /> Aggiungi
                  </button>
                </div>
              </div>
            )}

            {operators.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Phone size={28} className="mx-auto mb-2 opacity-30" />
                Nessun operatore configurato.<br />
                <span className="text-xs">Aggiungi il primo con il pulsante qui sopra.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {operators.map((op) => editingId === op.id ? renderEditRow(op) : renderRow(op))}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>Dopo aver modificato operatori o ruoli, clicca <strong>Sincronizza su Vapi</strong>.</span>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              <Save size={16} />
              {saving ? 'Salvataggio…' : 'Salva configurazione'}
            </button>
            <button type="button" onClick={handleSync} disabled={syncing} className="btn-secondary">
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizzazione…' : 'Salva e sincronizza su Vapi'}
            </button>
          </div>

          {/* Toast — vicino ai pulsanti di salvataggio */}
          {toast && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${toast.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {toast.msg}
            </div>
          )}
        </form>
      )}

      {/* ── TAB: Knowledge Base ── */}
      {tab === 'knowledge' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => uploadState === 'idle' && inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-brand-blue bg-blue-50' :
              uploadState === 'uploading' ? 'border-blue-300 bg-blue-50 cursor-not-allowed' :
              'border-gray-200 hover:border-brand-blue hover:bg-blue-50/30'
            }`}
          >
            <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileChange} />
            {uploadState === 'uploading' ? (
              <>
                <Loader2 size={32} className="mx-auto text-brand-blue animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-700">{uploadMessage}</p>
                <p className="text-xs text-gray-400 mt-1">Estrazione testo e generazione embedding in corso…</p>
              </>
            ) : (
              <>
                <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">Trascina qui un documento o clicca per caricare</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT — max 20 MB</p>
              </>
            )}
          </div>

          {/* Feedback */}
          {uploadState === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              <CheckCircle size={16} />{uploadMessage}
            </div>
          )}
          {uploadState === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle size={16} />{uploadMessage}
            </div>
          )}

          {/* Lista documenti */}
          <div className="space-y-2">
            {documents.length === 0 && uploadState === 'idle' && (
              <div className="text-center py-10 text-gray-400">
                <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nessun documento caricato</p>
                <p className="text-xs mt-1">Carica PDF o DOCX per addestrare l'agente</p>
              </div>
            )}
            {documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} deleting={deletingId === doc.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
