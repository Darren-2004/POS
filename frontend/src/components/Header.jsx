import React from 'react';
import { ShoppingCart, Shield, Lock } from 'lucide-react';
import IconButton from './IconButton';
import { cx } from '../utils/helpers';

export default function Header({ currentUser, serverOnline, currentView, setCurrentView, onLogout }) {
  if (!currentUser) return null;
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-background px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-gold shrink-0">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-none text-foreground truncate">ApexPOS</h1>
          <p className="mt-0.5 text-[11px] text-foreground/40 hidden sm:block">Terminal Caissier & Management</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-foreground/40">
          <span className={cx('h-1.5 w-1.5 rounded-full', serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
          {serverOnline ? 'Serveur actif' : 'Hors-ligne'}
        </div>
        <span className={cx('sm:hidden h-2 w-2 rounded-full', serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />

        <div className="flex items-center gap-2.5 border-l border-white/10 pl-3 sm:pl-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-foreground leading-tight">{currentUser.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
              {isAdmin ? 'Administrateur' : 'Caissière'}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-xs font-semibold text-gold shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setCurrentView(currentView === 'admin' ? 'cashier' : 'admin')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-foreground/60 hover:bg-white/6 transition"
          >
            {currentView === 'admin' ? <ShoppingCart className="h-3.5 w-3.5 text-gold" /> : <Shield className="h-3.5 w-3.5 text-gold" />}
            <span className="hidden sm:inline">{currentView === 'admin' ? 'Mode Caisse' : 'Console Admin'}</span>
          </button>
        )}

        <IconButton
          icon={<Lock className="h-4 w-4" />}
          onClick={onLogout}
          tone="danger"
          title="Déconnexion"
        />
      </div>
    </header>
  );
}