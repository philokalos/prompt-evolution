import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Lightbulb,
  TrendingUp,
  FolderOpen,
  BookOpen,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/trends', label: 'Trends', icon: TrendingUp },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/library', label: 'Library', icon: BookOpen },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-dark-surface border-r border-dark-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">PE</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-100">Prompt</h2>
            <p className="text-xs text-gray-400">Evolution</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-accent-primary text-white'
                      : 'text-gray-400 hover:bg-dark-hover hover:text-gray-100'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-border">
        <p className="text-xs text-gray-500 text-center">
          Prompt Evolution v0.1.0
        </p>
      </div>
    </aside>
  );
}
