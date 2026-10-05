import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import {
  Settings,
  Compass,
  LogOut,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export const UserNavMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsOpen(false);
      await signOut();
      toast.success('Signed out successfully');
      navigate('/sign-in');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign out failed');
    }
  };

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'User';

  const displayEmail = user?.primaryEmailAddress?.emailAddress || '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full ring-2 ring-emerald-500/40 hover:ring-emerald-400 transition-all cursor-pointer focus:outline-none focus:ring-emerald-400"
        title={displayName}
      >
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={displayName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
            {initial}
          </div>
        )}
        {/* Pulsing online status indicator */}
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
      </button>

      {/* 100% Solid Cyberpunk Dark Menu (No Clerk Branding) */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2.5 w-72 rounded-2xl border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.95)] py-2 z-[999] animate-in fade-in zoom-in-95 duration-100"
          style={{ backgroundColor: '#0B0F17', opacity: 1 }}
        >
          {/* User Profile Header */}
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full shrink-0 ring-2 ring-emerald-500/30 overflow-hidden">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  {initial}
                </div>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white truncate tracking-tight">
                {displayName}
              </span>
              <span className="text-[11px] text-slate-400 truncate font-mono">
                {displayEmail}
              </span>
              <div className="flex items-center gap-1 mt-0.5 text-[10px] text-emerald-400 font-mono">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Active Session</span>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1 px-1.5 space-y-0.5 text-xs">
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Project & API Settings</span>
            </Link>

            <Link
              to="/roadmap"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 text-emerald-400" />
              <span>Developer Roadmap</span>
            </Link>

            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Laptop className="w-4 h-4 text-indigo-400" />
              <span>Multi-Device Sessions</span>
            </Link>
          </div>

          <div className="border-t border-slate-800/80 my-1" />

          {/* Sign Out Button */}
          <div className="px-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
