'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav() {
  const p = usePathname();
  const cls = (href: string) =>
    `px-3 py-1.5 rounded text-sm ${p === href ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`;
  return (
    <nav className="flex gap-2 mb-6">
      <Link className={cls('/')} href="/">Workouts</Link>
      <Link className={cls('/progress')} href="/progress">Progress</Link>
      <Link className={cls('/nutrition')} href="/nutrition">Nutrition</Link>
    </nav>
  );
}
