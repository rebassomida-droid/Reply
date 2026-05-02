import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, RefreshCw, User, Bot, Phone } from 'lucide-react';
import api from '../lib/api';

interface Conversation {
  id: number;
  phone_number: string;
  contact_name: string | null;
  last_message: string | null;
  message_count: number;
  last_message_at: string;
}

interface Message {
  id: number;
  direction: 'inbound' | 'outbound';
  content: string;
  status: string;
  created_at: string;
}

interface Stats {
  total_conversations: string;
  messages_received: string;
  messages_sent: string;
  messages_today: string;
}

export default function WhatsApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'conversations' | 'setup'>('conversations');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function loadConversations() {
    return api.get('/whatsapp/conversations').then((r) => setConversations(r.data));
  }

  useEffect(() => {
    Promise.all([
      loadConversations(),
      api.get('/whatsapp/stats').then((r) => setStats(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/whatsapp/conversations/${selected.id}/messages`)
      .then((r) => setMessages(r.data))
      .catch(() => {});
  }, [selected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    try {
      await api.post(`/whatsapp/conversations/${selected.id}/send`, { message: reply.trim() });
      setReply('');
      const res = await api.get(`/whatsapp/conversations/${selected.id}/messages`);
      setMessages(res.data);
    } catch {
      alert('Errore invio messaggio');
    } finally {
      setSending(false);
    }
  }

  const provider = 'twilio'; // Default visualizzato

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare size={18} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">WhatsApp AI</h1>
            <p className="text-gray-500 text-xs mt-0.5">Risponditore automatico con la stessa knowledge base dell'agente vocale</p>
          </div>
        </div>
        <button onClick={() => { setLoading(true); loadConversations().finally(() => setLoading(false)); }} className="btn-secondary">
          <RefreshCw size={14} />
          Aggiorna
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('conversations')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'conversations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Conversazioni
        </button>
        <button
          onClick={() => setActiveTab('setup')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'setup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Configurazione
        </button>
      </div>

      {activeTab === 'conversations' && (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Conversazioni', value: stats.total_conversations },
                { label: 'Messaggi ricevuti', value: stats.messages_received },
                { label: 'Messaggi inviati', value: stats.messages_sent },
                { label: 'Messaggi oggi', value: stats.messages_today },
              ].map((s) => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{s.value ?? '0'}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4 h-[calc(100dvh-280px)] lg:h-[520px] min-h-[360px]">
            {/* Lista conversazioni — nascosta su mobile quando una conv è selezionata */}
            <div className={`${selected ? 'hidden lg:block' : 'flex-1 lg:flex-none'} lg:w-72 lg:flex-shrink-0 card overflow-y-auto`}>
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-gray-200" />
                      <div className="flex-1">
                        <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
                  <MessageSquare size={32} className="opacity-30 mb-2" />
                  <p className="text-sm text-center">Nessuna conversazione</p>
                  <p className="text-xs text-center mt-1">I messaggi WhatsApp appariranno qui</p>
                </div>
              ) : (
                <div>
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelected(conv)}
                      className={`flex items-start gap-3 p-3.5 cursor-pointer border-b border-gray-100 transition-colors ${selected?.id === conv.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Phone size={16} className="text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conv.contact_name || conv.phone_number}
                        </p>
                        {conv.contact_name && (
                          <p className="text-xs text-gray-400 truncate">{conv.phone_number}</p>
                        )}
                        {conv.last_message && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(conv.last_message_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat — nascosta su mobile quando nessuna conv selezionata */}
            {selected ? (
              <div className="flex-1 card flex flex-col overflow-hidden">
                {/* Header chat — back button su mobile */}
                <div className="flex items-center gap-3 p-3 lg:p-4 border-b border-gray-100">
                  <button
                    onClick={() => setSelected(null)}
                    className="lg:hidden flex-shrink-0 p-1.5 -ml-1 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                    aria-label="Torna alle conversazioni"
                  >
                    ←
                  </button>
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                    <Phone size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selected.contact_name || selected.phone_number}
                    </p>
                    {selected.contact_name && (
                      <p className="text-xs text-gray-500">{selected.phone_number}</p>
                    )}
                  </div>
                </div>

                {/* Messaggi */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.direction === 'outbound' ? 'bg-brand-blue' : 'bg-gray-200'}`}>
                        {msg.direction === 'outbound'
                          ? <Bot size={13} className="text-white" />
                          : <User size={13} className="text-gray-600" />
                        }
                      </div>
                      <div
                        className={`max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm ${
                          msg.direction === 'outbound'
                            ? 'bg-brand-blue text-white rounded-br-sm'
                            : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                        }`}
                      >
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input invio */}
                <div className="p-3 border-t border-gray-100 flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Scrivi un messaggio manuale…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!reply.trim() || sending}
                    className="btn-primary px-3"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 card flex flex-col items-center justify-center text-gray-400">
                <MessageSquare size={40} className="opacity-20 mb-3" />
                <p className="text-sm">Seleziona una conversazione</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'setup' && (
        <div className="space-y-5 max-w-2xl">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Come funziona</h2>
            <p className="text-sm text-gray-600 mb-4">
              Il risponditore WhatsApp usa la stessa knowledge base RAG dell'agente vocale. I messaggi in entrata vengono analizzati e risposti automaticamente da Claude usando i documenti caricati.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              {[
                { step: '1', label: 'Il cliente scrive su WhatsApp', icon: '📱' },
                { step: '2', label: 'Claude cerca nella knowledge base', icon: '🔍' },
                { step: '3', label: 'Risposta automatica inviata', icon: '✅' },
              ].map((s) => (
                <div key={s.step} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <p className="text-xs text-gray-600">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Opzione A — Twilio WhatsApp</h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Crea un account Twilio</p>
                  <p className="text-xs text-gray-500">Vai su twilio.com e attiva il sandbox WhatsApp (gratuito per test) o acquista un numero business</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Configura il webhook</p>
                  <p className="text-xs text-gray-500 mb-1">Nella console Twilio, imposta il webhook per i messaggi in entrata:</p>
                  <code className="block bg-gray-100 text-xs px-2 py-1.5 rounded text-brand-blue">
                    POST — {'{BACKEND_URL}'}/api/whatsapp/webhook
                  </code>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Aggiungi le chiavi al .env</p>
                  <code className="block bg-gray-100 text-xs px-2 py-2 rounded mt-1 space-y-0.5">
                    <div>WHATSAPP_PROVIDER=twilio</div>
                    <div>TWILIO_ACCOUNT_SID=ACxxxx</div>
                    <div>TWILIO_AUTH_TOKEN=xxxx</div>
                    <div>TWILIO_WHATSAPP_NUMBER=+14155238886</div>
                  </code>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Opzione B — Meta WhatsApp Cloud API</h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Crea app su Meta for Developers</p>
                  <p className="text-xs text-gray-500">Vai su developers.facebook.com, crea una Business App e aggiungi il prodotto WhatsApp</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Configura il webhook</p>
                  <code className="block bg-gray-100 text-xs px-2 py-1.5 rounded text-brand-blue mt-1">
                    GET/POST — {'{BACKEND_URL}'}/api/whatsapp/webhook
                  </code>
                  <p className="text-xs text-gray-500 mt-1">Usa il Verify Token che hai scelto per validare il webhook</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Aggiungi le chiavi al .env</p>
                  <code className="block bg-gray-100 text-xs px-2 py-2 rounded mt-1 space-y-0.5">
                    <div>WHATSAPP_PROVIDER=meta</div>
                    <div>META_PHONE_NUMBER_ID=123456789</div>
                    <div>META_ACCESS_TOKEN=EAAxxxx</div>
                    <div>META_VERIFY_TOKEN=il-tuo-token-segreto</div>
                  </code>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> il risponditore WhatsApp usa lo stesso prompt dell'agente vocale e la stessa knowledge base. Puoi personalizzare il prompt nella sezione <strong>Agente AI</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
