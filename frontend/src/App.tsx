import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from './lib/api';
import { CompanyProvider, useCompany, Company } from './contexts/CompanyContext';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import MobileNav from './components/MobileNav';
import Dashboard from './pages/Dashboard';
import AgentConfig from './pages/AgentConfig';
import CallLogs from './pages/CallLogs';
import Settings from './pages/Settings';
import WhatsApp from './pages/WhatsApp';
import Login from './pages/Login';
import CompanySelector from './pages/CompanySelector';

function ProtectedLayout() {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      {/* Sidebar — visibile solo su desktop */}
      <Sidebar />

      {/* Colonna principale — header mobile + contenuto + bottom nav */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agent" element={<AgentConfig />} />
            <Route path="/knowledge" element={<Navigate to="/agent" replace />} />
            <Route path="/calls" element={<CallLogs />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}

function AppInner() {
  const { company, companies, setCompany, setCompanies } = useCompany();
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'no-company' | 'ready'>('loading');
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setAuthState('unauthenticated'); return; }

    api.get('/auth/verify')
      .then(() => {
        // Token valido — controlla se una company è già selezionata
        const storedCompany = localStorage.getItem('company');
        if (storedCompany) {
          try {
            const c = JSON.parse(storedCompany) as Company;
            setCompany(c);
            // Ricarica la lista companies prima di passare a ready
            api.get('/auth/companies')
              .then((r) => setCompanies(r.data))
              .catch(() => {})
              .finally(() => setAuthState('ready'));
          } catch {
            setAuthState('no-company');
          }
        } else {
          // Carica lista companies per il selettore
          api.get('/auth/companies')
            .then((r) => {
              const list: Company[] = r.data;
              setCompanies(list);
              if (list.length === 1) {
                // Solo una azienda → auto-select
                setCompany(list[0]);
                setAuthState('ready');
              } else {
                setPendingCompanies(list);
                setAuthState('no-company');
              }
            })
            .catch(() => setAuthState('no-company'));
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('companyId');
        localStorage.removeItem('company');
        setAuthState('unauthenticated');
      });
  }, []);

  function handleLogin(companies: Company[]) {
    setCompanies(companies);
    if (companies.length === 1) {
      setCompany(companies[0]);
      setAuthState('ready');
    } else {
      setPendingCompanies(companies);
      setAuthState('no-company');
    }
  }

  function handleSelectCompany(c: Company) {
    setCompany(c);
    // Redirect duro a / — resetta tutti gli stati come fa switchCompany
    window.location.href = '/';
  }

  if (authState === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-dark">
        <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authState !== 'unauthenticated'
              ? <Navigate to="/" replace />
              : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/select-company"
          element={
            authState === 'unauthenticated'
              ? <Navigate to="/login" replace />
              : <CompanySelector
                  companies={authState === 'no-company' ? pendingCompanies : companies}
                  onSelect={handleSelectCompany}
                />
          }
        />
        <Route
          path="/*"
          element={
            authState === 'unauthenticated'
              ? <Navigate to="/login" replace />
              : authState === 'no-company'
              ? <Navigate to="/select-company" replace />
              : <ProtectedLayout />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <CompanyProvider>
      <AppInner />
    </CompanyProvider>
  );
}
