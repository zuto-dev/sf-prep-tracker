'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell, TrendingUp, Apple, ShieldAlert, Crosshair, Calendar, Award, BookOpen, Activity, Podcast } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Nav() {
  const pathname = usePathname();
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const links = [
    { href: '/', label: 'Workouts', icon: Dumbbell },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/nutrition', label: 'Nutrition', icon: Apple },
    { href: '/progress', label: 'Progress', icon: TrendingUp },
    { href: '/standards', label: 'Standards', icon: Award },
    { href: '/study', label: 'Study', icon: BookOpen },
    { href: '/mobility', label: 'Mobility', icon: Activity },
    { href: '/pods', label: 'SF Pod', icon: Podcast },
  ];

  return (
    <header className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 md:p-5 mb-8 shadow-2xl relative overflow-hidden">
      {/* Visual Tech Accents */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 opacity-80" />
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand/Identity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-700 flex items-center justify-center text-blue-400 shadow-inner">
              <Crosshair className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-gray-400">PLAN-D PROTOCOL</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold font-mono tracking-tight text-white flex items-center gap-1.5">
                SF PREP <span className="text-emerald-400">TRACKER</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Tactical Status & Info */}
        <div className="flex items-center gap-4 text-xs font-mono text-gray-400 bg-gray-900/60 px-3 py-1.5 rounded-lg border border-gray-800/80 self-start md:self-auto">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <span className="text-gray-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>SYS TIME: <span className="text-gray-200">{timeStr || '00:00'}</span></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="mt-5 flex gap-1.5 border-t border-gray-800/80 pt-4 overflow-x-auto scrollbar-none">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const IconComponent = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium font-mono transition-all duration-200 shrink-0 relative ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900 border border-transparent'
              }`}
            >
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-gray-400'}`} />
              <span>{link.label}</span>
              {isActive && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

