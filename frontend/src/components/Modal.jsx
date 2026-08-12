import React from 'react';
import { X } from 'lucide-react';
import { cx } from '../utils/helpers';

export default function Modal({ onClose, children, widthCls = 'max-w-xs', open = true }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={cx('relative w-full rounded-xl border border-white/10 bg-background p-6 max-h-[90vh] overflow-y-auto', widthCls)}>
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1.5 text-foreground/45 hover:bg-white/6 hover:text-foreground transition">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}