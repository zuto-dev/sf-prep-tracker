'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIMARY = [
  { href: '/', label: 'Train' },
  { href: '/standards', label: 'Standards' },
  { href: '/progress', label: 'Progress' },
  { href: '/nutrition', label: 'Fuel' },
];

const SECONDARY = [
  { href: '/mobility', label: 'Mobility' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/study', label: 'Study' },
  { href: '/intel', label: 'Intel' },
  { href: '/pods', label: 'SF Pod' },
  { href: '/board-sim', label: 'Board' },
];

export function Nav() {
  const pathname = usePathname();
  const secondaryActive = SECONDARY.some(link => pathname === link.href);

  return (
    <nav className="mb-6" aria-label="Primary navigation">
      <div className="grid grid-cols-5 gap-px bg-gray-900 border border-gray-900">
        {PRIMARY.map(link => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`bg-[#0d0d0f] px-1 py-3 text-center text-[9px] font-bold uppercase tracking-[0.08em] transition-colors ${
                active ? 'text-blue-400' : 'text-gray-600 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <details className="relative bg-[#0d0d0f]">
          <summary className={`flex h-full cursor-pointer list-none items-center justify-center px-1 py-3 text-center text-[9px] font-bold uppercase tracking-[0.08em] ${secondaryActive ? 'text-blue-400' : 'text-gray-600 hover:text-white'}`}>
            More
          </summary>
          <div className="absolute right-0 z-50 mt-1 w-44 border border-gray-800 bg-[#0d0d0f] p-1 shadow-2xl">
            {SECONDARY.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2.5 text-xs ${pathname === link.href ? 'bg-blue-950/30 text-blue-400' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </nav>
  );
}
