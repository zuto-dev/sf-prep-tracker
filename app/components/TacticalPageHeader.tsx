'use client';

import { Nav } from './Nav';

export function TacticalPageHeader({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <header className="mb-7 border-b border-gray-900 pb-5">
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-bold tracking-[0.3em] text-gray-500">SF</span>
          <span className="text-sm font-bold tracking-[0.3em] text-white">PREP</span>
        </div>
        {status && <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">{status}</span>}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-light tracking-tight text-white">{title}</h1>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-gray-600">{description}</p>
      <div className="mt-6">
        <Nav />
      </div>
    </header>
  );
}
