import { useState, FormEvent } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface SettingField {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  sensitive?: boolean;
}

const SECTIONS: { title: string; fields: SettingField[] }[] = [
  {
    title: 'Anthropic (Claude AI)',
    fields: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key Anthropic', placeholder: 'sk-ant-...', sensitive: true },
    ],
  },
  {
    title: 'Vapi.ai — Agente vocale',
    fields: [
      { key: 'VAPI_API_KEY', label: 'API Key Vapi', placeholder: 'vapi_...', sensitive: true },
      { key: 'VAPI_PHONE_NUMBER_ID', label: 'Phone Number ID', placeholder: 'pn_...' },
      { key: 'BACKEND_URL', label: 'URL backend (per webhook)', placeholder: 'https://tuodominio.com', hint: 'Vapi invierà gli eventi a questo URL' },
    ],
  },
  {
    title: 'OpenAI (embedding documenti)',
    fields: [
      { key: 'OPENAI_API_KEY', label: 'API Key OpenAI', placeholder: 'sk-...', sensitive: true, hint: 'Usata per generare embedding dei documenti' },
    ],
  },
  {
    title: 'WhatsApp — Twilio',
    fields: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', placeholder: 'ACxxxx', sensitive: true },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', placeholder: '...', sensitive: true },
      { key: 'TWILIO_WHATSAPP_NUMBER', label: 'Numero WhatsApp', placeholder: '+14155238886', hint: 'Numero Twilio sandbox o business' },
    ],
  },
  {
    title: 'WhatsApp — Meta Cloud API (alternativa)',
    fields: [
      { key: 'META_PHONE_NUMBER_ID', label: 'Phone Number ID', placeholder: '123456789' },
      { key: 'META_ACCESS_TOKEN', label: 'Access Token', placeholder: 'EAAxx...', sensitive: true },
      { key: 'META_VERIFY_TOKEN', label: 'Verify Token webhook', placeholder: 'scegli-un-token-sicuro' },
    ],
  },
  {
    title: 'Sicurezza',
    fields: [
      { key: 'ADMIN_PASSWORD', label: 'Password pannello', placeholder: 'Nuova password', sensitive: true },
    ],
  },
];

export default function Settings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  function handleChange(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function toggleShow(key: string) {
    setShow((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    // Le chiavi API vengono gestite tramite variabili d'ambiente nel file .env
    // Questa pagina mostra i valori da configurare nel server
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
          <SettingsIcon size={18} className="text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Impostazioni</h1>
          <p className="text-gray-500 text-xs mt-0.5">Configura le chiavi API e i parametri del sistema</p>
        </div>
      </div>

      <div className="card p-4 mb-5 bg-amber-50 border-amber-200">
        <p className="text-sm text-amber-800">
          <strong>Importante:</strong> le chiavi API vanno inserite nel file <code className="bg-amber-100 px-1 rounded">.env</code> del backend, non nel browser. Questa pagina mostra i campi da configurare.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm mb-4">
          <CheckCircle size={16} />
          Riferimento salvato — aggiorna il file .env per applicare le modifiche
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.title} className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{section.title}</h2>
            <div className="space-y-3">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="label">
                    {field.label}
                    <code className="ml-2 text-xs text-gray-400 font-mono">{field.key}</code>
                  </label>
                  <div className="relative">
                    <input
                      type={field.sensitive && !show[field.key] ? 'password' : 'text'}
                      className="input pr-10"
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                    {field.sensitive && (
                      <button
                        type="button"
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        onClick={() => toggleShow(field.key)}
                      >
                        {show[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    )}
                  </div>
                  {field.hint && <p className="text-xs text-gray-400 mt-1">{field.hint}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">URL webhook</h2>
          <p className="text-xs text-gray-500 mb-3">Usa questi URL quando configuri Vapi e Twilio/Meta:</p>
          <div className="space-y-2">
            {[
              { label: 'Webhook chiamate Vapi', path: '/api/calls/webhook' },
              { label: 'Webhook WhatsApp Twilio', path: '/api/whatsapp/webhook' },
              { label: 'Webhook WhatsApp Meta (POST)', path: '/api/whatsapp/webhook' },
              { label: 'Verifica Meta (GET)', path: '/api/whatsapp/webhook' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50 rounded-lg px-3 py-2 gap-0.5">
                <span className="text-xs text-gray-600">{item.label}</span>
                <code className="text-xs text-brand-blue break-all">{item.path}</code>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary">
          <Save size={16} />
          Salva riferimento
        </button>
      </form>
    </div>
  );
}
