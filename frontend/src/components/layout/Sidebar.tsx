import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Layers,
  Cpu,
  Settings,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { path: '/overview', label: 'Overview', icon: Activity },
  { path: '/traces', label: 'Traces', icon: Layers },
  { path: '/models', label: 'Models & Cost', icon: Cpu },
  { path: '/settings', label: 'Settings & Keys', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/80 backdrop-blur-md flex flex-col shrink-0">
      {/* Brand */}
      <div className="h-16 px-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Sparkles className="w-4 h-4 text-slate-950 font-bold" />
        </div>
        <div>
          <span className="font-bold text-base tracking-tight text-white">TokenTrail</span>
          <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
            v0.1
          </span>
        </div>
      </div>

      {/* Nav list */}
      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
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
          className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Documentation & Repo</span>
        </a>
        <p className="text-[11px] text-slate-600">Zero overhead LLM telemetry</p>
      </div>
    </aside>
  );
};
