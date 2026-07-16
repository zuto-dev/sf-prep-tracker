'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Nav() {
  const p = usePathname();
  const cls = (href: string) =>
    `px-3 py-1.5 rounded text-sm ${p === href ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`;
  return (
    <nav className="flex gap-2 mb-6 flex-wrap">
      <Link className={cls('/')} href="/">Workouts</Link>
      <Link className={cls('/mobility')} href="/mobility">Mobility</Link>
      <Link className={cls('/progress')} href="/progress">Progress</Link>
      <Link className={cls('/calendar')} href="/calendar">Calendar</Link>
      <Link className={cls('/nutrition')} href="/nutrition">Nutrition</Link>
      <Link className={cls('/study')} href="/study">Study</Link>
      <Link className={cls('/standards')} href="/standards">Standards</Link>
      <Link className={cls('/pods')} href="/pods">SF Pod</Link>
    </nav>
  );
}
