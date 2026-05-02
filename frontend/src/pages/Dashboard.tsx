import { useEffect, useState } from 'react';
import { Phone, Clock, ArrowRightLeft, BookOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface Stats {
  calls_today: string;
  avg_duration: string;
  transfers_today: string;
  documents_count: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/calls/stats/today')
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const s = stats;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="mb-5 lg:mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Chiamate oggi"
            value={s?.calls_today ?? '0'}
            icon={Phone}
            color="bg-brand-blue"
          />
          <StatCard
            label="Durata media"
            value={s?.avg_duration ? `${s.avg_duration}s` : '—'}
            icon={Clock}
            color="bg-purple-500"
            sub="secondi per chiamata"
          />
          <StatCard
            label="Trasferimenti oggi"
            value={s?.transfers_today ?? '0'}
            icon={ArrowRightLeft}
            color="bg-orange-500"
          />
          <StatCard
            label="Documenti caricati"
            value={s?.documents_count ?? '0'}
            icon={BookOpen}
            color="bg-green-500"
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-brand-blue" />
            <h2 className="font-semibold text-gray-900">Azioni rapide</h2>
          </div>
          <div className="space-y-2">
            <Link to="/agent" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
              <span className="text-sm text-gray-700">Configura agente AI</span>
              <span className="text-xs text-brand-blue">→</span>
            </Link>
            <Link to="/knowledge" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
              <span className="text-sm text-gray-700">Carica documenti</span>
              <span className="text-xs text-brand-blue">→</span>
            </Link>
            <Link to="/calls" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
              <span className="text-sm text-gray-700">Vedi log chiamate</span>
              <span className="text-xs text-brand-blue">→</span>
            </Link>
            <Link to="/whatsapp" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
              <span className="text-sm text-gray-700">Gestisci WhatsApp</span>
              <span className="text-xs text-brand-blue">→</span>
            </Link>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h2 className="font-semibold text-gray-900">Stato sistema</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Pannello di controllo', status: 'Operativo' },
              { label: 'Knowledge Base RAG', status: 'Attivo' },
              { label: 'Agente vocale Vapi', status: import.meta.env.DEV ? 'Non configurato' : 'Attivo' },
              { label: 'Risponditore WhatsApp', status: 'In attesa config.' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
