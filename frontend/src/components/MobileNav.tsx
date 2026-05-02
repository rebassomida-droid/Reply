import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bot, Phone, MessageSquare, Settings } from 'lucide-react';

const navItems = [
  { to: '/',          label: 'Home',        icon: LayoutDashboard, end: true },
  { to: '/agent',     label: 'Agente',      icon: Bot },
  { to: '/calls',     label: 'Chiamate',    icon: Phone },
  { to: '/whatsapp',  label: 'WhatsApp',    icon: MessageSquare },
  { to: '/settings',  label: 'Settings',    icon: Settings },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden flex-shrink-0 bg-brand-dark border-t border-white/10 z-40">
      <div className="flex h-16">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-white' : 'text-white/40'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-brand-blue' : ''}`}>
                  <Icon size={19} />
                </div>
                <span className="text-[9px] font-medium leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
