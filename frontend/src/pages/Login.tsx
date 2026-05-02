import { useState, FormEvent } from 'react';
import { Mic } from 'lucide-react';
import api from '../lib/api';
import { Company } from '../contexts/CompanyContext';

interface Props {
  onLogin: (companies: Company[]) => void;
}

export default function Login({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.companies || []);
    } catch {
      setError('Password non corretta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-brand-blue rounded-2xl flex items-center justify-center mb-4">
            <Mic size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Voice AI</h1>
          <p className="text-white/50 text-sm mt-1">Pannello di controllo</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-2xl">
          <div className="mb-4">
            <label className="label">Password accesso</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
