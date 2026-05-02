import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Bot, Phone, MessageSquare, Settings,
  LogOut, Mic, ChevronDown, Check, Plus, Building2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCompany } from '../contexts/CompanyContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/agent', label: 'Agente AI', icon: Bot },
  { to: '/calls', label: 'Log Chiamate', icon: Phone },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { to: '/settings', label: 'Impostazioni', icon: Settings },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { company, companies, switchCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Chiudi dropdown se si clicca fuori
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('companyId');
    localStorage.removeItem('company');
    navigate('/login');
  }

  function handleSwitchCompany(c: typeof company) {
    if (!c) return;
    setOpen(false);
    switchCompany(c);
  }

  function handleNewCompany() {
    setOpen(false);
    localStorage.removeItem('companyId');
    localStorage.removeItem('company');
    navigate('/select-company');
  }

  const companyColor = company?.color || '#3B82F6';
  const companyInitial = company?.name?.charAt(0)?.toUpperCase() || 'A';

  return (
    <aside className="hidden lg:flex w-60 flex-shrink-0 bg-brand-dark flex-col h-full">
      {/* Company Switcher */}
      <div className="px-3 py-3 border-b border-white/10" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors group"
        >
          {/* Avatar company */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: companyColor }}
          >
            {companyInitial}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-sm font-semibold leading-none truncate">
              {company?.name || 'Seleziona azienda'}
            </p>
            <p className="text-white/30 text-xs mt-0.5 flex items-center gap-1">
              <Mic size={9} /> Voice AI
            </p>
          </div>
          <ChevronDown
            size={15}
            className={clsx('text-white/30 group-hover:text-white/60 transition-all', open && 'rotate-180')}
          />
        </button>

        {/* Dropdown aziende */}
        {open && (
          <div className="mt-1.5 bg-[#1e2130] border border-white/10 rounded-xl overflow-hidden shadow-xl">
            <p className="text-white/30 text-xs px-3 pt-2.5 pb-1 font-medium uppercase tracking-wide">Aziende</p>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSwitchCompany(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                >
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-white/80 text-sm text-left truncate">{c.name}</span>
                {company?.id === c.id && <Check size={13} className="text-brand-blue flex-shrink-0" />}
              </button>
            ))}
            <div className="border-t border-white/10 mt-1">
              <button
                onClick={handleNewCompany}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Plus size={12} className="text-white/50" />
                </div>
                <span className="text-white/40 text-sm">Nuova azienda</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-blue text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        {company && (
          <div className="flex items-center gap-2 px-3 mb-2">
            <Building2 size={13} className="text-white/20" />
            <span className="text-white/20 text-xs truncate">{company.name}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={17} />
          Esci
        </button>
      </div>
    </aside>
  );
}
