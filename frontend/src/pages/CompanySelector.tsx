import { useState } from 'react';
import { Building2, Plus, ArrowRight, Mic, Check, X } from 'lucide-react';
import { Company, useCompany } from '../contexts/CompanyContext';
import api from '../lib/api';

const COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#6366F1',
];

interface Props {
  companies: Company[];
  onSelect: (c: Company) => void;
}

export default function CompanySelector({ companies: initialCompanies, onSelect }: Props) {
  const { setCompanies } = useCompany();
  const [companies, setLocal] = useState<Company[]>(initialCompanies);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.post('/companies', { name: newName.trim(), color: newColor });
      const updated = [...companies, res.data];
      setLocal(updated);
      setCompanies(updated);
      setShowCreate(false);
      setNewName('');
      onSelect(res.data);
    } catch {
      setError('Errore nella creazione. Riprova.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-11 h-11 bg-brand-blue rounded-xl flex items-center justify-center">
          <Mic size={22} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">Voice AI</p>
          <p className="text-white/40 text-xs mt-0.5">Seleziona azienda</p>
        </div>
      </div>

      <div className="w-full max-w-xl">
        <h1 className="text-white text-2xl font-bold mb-1">Scegli l'azienda</h1>
        <p className="text-white/40 text-sm mb-6">Ogni azienda ha il proprio agente, knowledge base e log chiamate.</p>

        {/* Griglia aziende */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-5 text-left transition-all"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-white font-bold text-lg"
                style={{ backgroundColor: c.color }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-white font-semibold text-sm truncate">{c.name}</p>
              <p className="text-white/30 text-xs mt-0.5">/{c.slug}</p>
              <ArrowRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white/60 transition-colors" />
            </button>
          ))}

          {/* Bottone nuova azienda */}
          <button
            onClick={() => setShowCreate(true)}
            className="bg-white/3 hover:bg-white/8 border border-dashed border-white/20 hover:border-white/40 rounded-2xl p-5 text-left transition-all flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Plus size={20} className="text-white/50" />
            </div>
            <p className="text-white/50 text-sm font-medium">Nuova azienda</p>
          </button>
        </div>

        {/* Form crea azienda */}
        {showCreate && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-sm">Crea nuova azienda</p>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white/70">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Nome azienda</label>
              <input
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-brand-blue"
                placeholder="es. Studio Rossi"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Colore identificativo</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewColor(col)}
                    className="w-8 h-8 rounded-lg transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: col }}
                  >
                    {newColor === col && <Check size={14} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-white/50 hover:text-white text-sm transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="flex items-center gap-2 bg-brand-blue hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <Building2 size={15} />
                {creating ? 'Creazione…' : 'Crea e accedi'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
