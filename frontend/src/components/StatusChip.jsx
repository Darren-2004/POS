import React from 'react';
import { cx } from '../utils/helpers';

export default function StatusChip({ tone = 'emerald', label }) {
  const tones = {
    emerald: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 ring-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
    red: 'text-red-400 bg-red-500/10 ring-red-500/20',
    purple: 'text-purple-400 bg-purple-500/10 ring-purple-500/20',
    gold: 'text-gold bg-gold/10 ring-gold/20',
  };
  const dots = {
    emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400',
    red: 'bg-red-400', purple: 'bg-purple-400', gold: 'bg-gold',
  };

  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset', tones[tone])}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dots[tone])} />
      {label}
    </span>
  );
}