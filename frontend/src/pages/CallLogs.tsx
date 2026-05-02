import { useEffect, useState, useCallback } from 'react';
import { Phone, Filter, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import CallCard from '../components/CallCard';

interface CallLog {
  id: number;
  caller_number: string;
  started_at: string;
  duration_seconds: number;
  outcome: string;
  transcript: string;
  summary: string;
  transferred_to: string;
}

type OutcomeFilter = 'all' | 'answered' | 'transferred' | 'voicemail' | 'missed';

export default function CallLogs() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadCalls = useCallback(() => {
    setLoading(true);
    api.get('/calls')
      .then((r) => setCalls(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.post('/calls/sync');
      setSyncMsg({ type: 'success', text: `Sincronizzate ${r.data.synced} chiamate da Vapi` });
      loadCalls();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Errore durante la sincronizzazione';
      setSyncMsg({ type: 'error', text: msg });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 5000);
    }
  }

  const filtered = calls.filter((c) => {
    if (filter !== 'all' && c.outcome !== filter) return false;
    if (dateFrom && new Date(c.started_at) < new Date(dateFrom)) return false;
    return true;
  });

  // Contatori per i badge filtro
  const counts: Record<string, number> = { all: calls.length };
  for (const c of calls) counts[c.outcome] = (counts[c.outcome] || 0) + 1;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Phone size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Log Chiamate</h1>
            <p className="text-gray-500 text-xs mt-0.5">{calls.length} chiamate in totale</p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing || loading}
          className="flex items-center gap-2 bg-brand-blue text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizzazione…' : 'Sincronizza da Vapi'}
        </button>
      </div>

      {/* Feedback sync */}
      {syncMsg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
          syncMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {syncMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {syncMsg.text}
        </div>
      )}

      {/* Filtri */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex items-center gap-1 mr-1">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">Filtri:</span>
        </div>
        {([
          ['all', 'Tutte'],
          ['answered', 'Risposta'],
          ['transferred', 'Trasferite'],
          ['voicemail', 'Voicemail'],
          ['missed', 'Perse'],
        ] as [OutcomeFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
              filter === key
                ? 'bg-brand-blue text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
            {counts[key] !== undefined && counts[key] > 0 && (
              <span className={`text-[10px] px-1 rounded-full ${
                filter === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
        <input
          type="date"
          className="input text-xs w-auto ml-auto"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Phone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nessuna chiamata trovata</p>
          <p className="text-xs mt-1 mb-4">
            {calls.length === 0
              ? 'Clicca "Sincronizza da Vapi" per importare le chiamate registrate'
              : 'Nessuna chiamata corrisponde ai filtri selezionati'}
          </p>
          {calls.length === 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 bg-brand-blue text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizzazione…' : 'Sincronizza ora'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((call) => (
            <CallCard key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}
