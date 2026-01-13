import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Lightbulb,
  TrendingUp,
  FolderOpen,
  BookOpen,
  GraduationCap,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/trends', label: 'Trends', icon: TrendingUp },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/guidebook', label: 'Guidebook', icon: GraduationCap },
];

export default function Sidebar() {
  return (
    <aside className="w-72 bg-app-surface border-r border-app-border flex flex-col">
      {/* Logo */}
      <div className="p-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-2xl flex items-center justify-center shadow-app">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8V16M8 10L12 8L16 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-app-text-primary text-base tracking-tight">Prompt Evolution</h2>
            <p className="text-xs text-app-text-tertiary mt-0.5">Analytics Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2">
        <ul className="space-y-1">
          {navItems.map((item, index) => (
            <li key={item.to} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-accent-primary text-white shadow-app'
                      : 'text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary'
                  }`
                }
              >
                <item.icon size={20} strokeWidth={2} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-6 pt-4 border-t border-app-border">
        <div className="bg-app-elevated rounded-xl p-4">
          <p className="text-xs font-medium text-app-text-secondary mb-1">Version</p>
          <p className="text-sm text-app-text-primary font-mono">0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
