import { LogOut, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';

export default function MobileHeader() {
  const navigate = useNavigate();
  const { company } = useCompany();

  const companyColor = company?.color || '#3B82F6';
  const companyInitial = company?.name?.charAt(0)?.toUpperCase() || 'A';

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('companyId');
    localStorage.removeItem('company');
    navigate('/login');
  }

  return (
    <header className="lg:hidden flex-shrink-0 bg-brand-dark border-b border-white/10 px-4 h-14 flex items-center justify-between z-40">
      {/* Company */}
      <button
        onClick={() => {
          localStorage.removeItem('companyId');
          localStorage.removeItem('company');
          navigate('/select-company');
        }}
        className="flex items-center gap-2.5 min-w-0"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{ backgroundColor: companyColor }}
        >
          {companyInitial}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-none truncate">
            {company?.name || 'Voice AI'}
          </p>
          <p className="text-white/30 text-[10px] mt-0.5 flex items-center gap-0.5">
            <Mic size={8} /> Voice AI
          </p>
        </div>
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="p-2 text-white/40 hover:text-white/80 transition-colors"
        aria-label="Esci"
      >
        <LogOut size={18} />
      </button>
    </header>
  );
}
