import { createContext, useContext, useState, ReactNode } from 'react';

export interface Company {
  id: number;
  name: string;
  slug: string;
  color: string;
  created_at: string;
}

interface CompanyContextValue {
  company: Company | null;
  companies: Company[];
  setCompany: (c: Company) => void;
  setCompanies: (list: Company[]) => void;
  switchCompany: (c: Company) => void;
}

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  companies: [],
  setCompany: () => {},
  setCompanies: () => {},
  switchCompany: () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompanyState] = useState<Company | null>(() => {
    const stored = localStorage.getItem('company');
    return stored ? JSON.parse(stored) : null;
  });

  function setCompany(c: Company) {
    setCompanyState(c);
    localStorage.setItem('company', JSON.stringify(c));
    localStorage.setItem('companyId', String(c.id));
  }

  function switchCompany(c: Company) {
    setCompany(c);
    // Reload della pagina per resettare tutti gli stati delle pagine
    window.location.href = '/';
  }

  return (
    <CompanyContext.Provider value={{ company, companies, setCompany, setCompanies, switchCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
