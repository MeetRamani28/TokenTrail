import React from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { setDateRange } from '../../store/uiSlice';
import type { DateRangeOption } from '../../store/uiSlice';
import { Calendar, Radio, Menu, Compass } from 'lucide-react';
import clsx from 'clsx';
import { ProjectSelector } from '../project/ProjectSelector';
import { SignedIn } from '@clerk/clerk-react';
import { UserNavMenu } from './UserNavMenu';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

const dateOptions: { id: DateRangeOption; label: string }[] = [
  { id: '1h', label: '1h' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const dispatch = useAppDispatch();
  const currentRange = useAppSelector((state) => state.ui.dateRange);

  return (
    <header className="h-16 border-b border-slate-800 bg-[#070b12]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
      {/* Left side: Mobile menu toggle + 3D Logo + Project Selector */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Brand Logo in Navbar (visible on mobile/tablet) */}
        <div className="lg:hidden flex items-center gap-1.5 mr-1">
          <img src="/icon.png" alt="TokenTrail Logo" className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.45)]" />
          <span className="font-extrabold text-sm text-white tracking-tight hidden sm:inline">
            TokenTrail
          </span>
        </div>

        {/* Active Project Dropdown */}
        <ProjectSelector />
      </div>

      {/* Right side: Quickstart Roadmap + Date Range + Ingest Status + User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quickstart Roadmap Button */}
        <Link
          to="/roadmap"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span>Quickstart Roadmap</span>
        </Link>

        {/* Date range picker (hidden on tiny screens, icon-only or dropdown if needed) */}
        <div className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
          {dateOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => dispatch(setDateRange(opt.id))}
              className={clsx(
                'px-2 py-1 text-xs rounded-md font-medium transition-all cursor-pointer',
                currentRange === opt.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Live Ingest Status indicator */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1.5 rounded-lg">
          <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
          <span className="hidden sm:inline">Live Ingest</span>
        </div>

        {/* Custom Dark Theme User Menu (No Clerk Branding) */}
        <SignedIn>
          <div className="pl-1 sm:pl-2 border-l border-slate-800">
            <UserNavMenu />
          </div>
        </SignedIn>
      </div>
    </header>
  );
};
