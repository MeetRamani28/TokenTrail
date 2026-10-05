import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Layers,
  Cpu,
  Settings,
  Compass,
  ExternalLink,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { ThreeLogo } from '../common/ThreeLogo';

interface SidebarProps {
  onClose?: () => void;
}

const navItems = [
  { path: '/overview', label: 'Overview', icon: Activity },
  { path: '/traces', label: 'Traces', icon: Layers },
  { path: '/models', label: 'Models & Cost', icon: Cpu },
  { path: '/roadmap', label: 'Integration Roadmap', icon: Compass },
  { path: '/settings', label: 'Settings & Keys', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  return (
    <aside className="w-64 h-full border-r border-slate-800 bg-[#070b12] flex flex-col shrink-0 select-none">
      {/* Brand with 3D Canvas Logo */}
      <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10 overflow-hidden">
            <ThreeLogo size={32} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">TokenTrail</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20 font-bold">
                v0.1
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">LLM Observability</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav list */}
      <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer link to docs / github */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-2">
        <a
          href="https://github.com/MeetRamani28/TokenTrail"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Documentation & Repo</span>
        </a>
        <p className="text-[11px] text-slate-600">Zero overhead LLM telemetry</p>
      </div>
    </aside>
  );
};
