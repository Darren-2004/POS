import React from 'react';
import { cx } from '../utils/helpers';

export default function IconButton({ icon, onClick, tone = 'default', title, disabled }) {
  const tones = {
    default: 'text-foreground/45 hover:text-green/500 hover:bg-white/6',
    danger: 'text-foreground/45 hover:text-red-400 hover:bg-red-500/10',
    info: 'text-foreground/45 hover:text-blue-400 hover:bg-blue-500/10',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx('rounded-md p-2 transition disabled:opacity-40 disabled:pointer-events-none', tones[tone])}
    >
      {icon}
    </button>
  );
}