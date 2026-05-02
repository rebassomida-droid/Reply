import { useState } from 'react';
import { Phone, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from './StatusBadge';

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

interface Props {
  call: CallLog;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallCard({ call }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 lg:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Phone size={15} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{call.caller_number || 'Numero sconosciuto'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {call.started_at ? new Date(call.started_at).toLocaleString('it-IT') : '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} />
            {formatDuration(call.duration_seconds)}
          </span>
          <StatusBadge status={call.outcome || 'answered'} />
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {call.summary && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Riepilogo AI</p>
              <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{call.summary}</p>
            </div>
          )}
          {call.transcript && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trascrizione</p>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto font-sans">
                {call.transcript}
              </pre>
            </div>
          )}
          {call.transferred_to && (
            <p className="text-xs text-gray-500">
              Trasferita a: <span className="font-medium text-gray-700">{call.transferred_to}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
