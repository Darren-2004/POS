import React from 'react';
import { ShoppingCart, Shield, Lock, ShoppingBag, Clock, Receipt, BarChart2 } from 'lucide-react';
import IconButton from './IconButton';
import { cx } from '../utils/helpers';

const CASHIER_TABS = [
  { key: 'sale',         label: 'Vente Directe',        icon: ShoppingBag },
  { key: 'reservations', label: 'Réservations',          icon: Clock },
  { key: 'my_invoices',  label: 'Mes Ventes',            icon: Receipt },
  { key: 'stats',        label: 'Tableau de Bord',       icon: BarChart2 },
];

export default function Header({
  currentUser,
  serverOnline,
  currentView,
  setCurrentView,
  onLogout,
  cashierTab,
  setCashierTab,
}) {
  if (!currentUser) return null;
  const isAdmin  = currentUser.role === 'ADMIN';
  const isCashier = currentView === 'cashier';

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-background px-4 sm:px-6 h-[52px] shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-gold">
          <ShoppingCart className="h-4 w-4" />
        </div>
        <div className="hidden sm:block leading-none">
          <div className="text-xs font-black tracking-[0.15em] text-foreground">JOEL SHOP</div>
          <div className="text-[9px] text-foreground/30">Système de Caisse</div>
        </div>
      </div>

      <div className="w-px h-6 bg-white/10 shrink-0" />

      {/* Cashier tabs — take all available space */}
      {isCashier && (
        <nav className="flex flex-1 items-center gap-1 min-w-0 overflow-x-auto scrollbar-none">
          {CASHIER_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCashierTab(key)}
              className={cx(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-bold transition shrink-0 cursor-pointer',
                cashierTab === key
                  ? 'bg-gold text-black shadow shadow-gold/20'
                  : 'text-foreground/60 hover:text-foreground hover:bg-white/[0.06]'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Admin: spacer so right cluster stays right */}
      {!isCashier && <div className="flex-1" />}

      {/* Right cluster */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Server status */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-foreground/40">
          <span className={cx('h-1.5 w-1.5 rounded-full', serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
          {serverOnline ? 'Actif' : 'Hors-ligne'}
        </div>
        <span className={cx('sm:hidden h-2 w-2 rounded-full', serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />

        {/* User badge */}
        <div className="flex items-center gap-2 border-l border-white/10 pl-2.5">
          <div className="hidden sm:block text-right leading-tight">
            <div className="text-[11px] font-semibold text-foreground">{currentUser.name}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-gold">
              {isAdmin ? 'Administrateur' : 'Caissière'}
            </div>
          </div>
          <div className="h-7 w-7 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-[11px] font-bold text-gold">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Admin toggle */}
        {isAdmin && (
          <button
            onClick={() => setCurrentView(currentView === 'admin' ? 'cashier' : 'admin')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-foreground/60 hover:bg-white/[0.06] transition"
          >
            {currentView === 'admin'
              ? <ShoppingCart className="h-3.5 w-3.5 text-gold" />
              : <Shield className="h-3.5 w-3.5 text-gold" />}
            <span className="hidden sm:inline">
              {currentView === 'admin' ? 'Mode Caisse' : 'Console Admin'}
            </span>
          </button>
        )}

        <IconButton icon={<Lock className="h-4 w-4" />} onClick={onLogout} tone="danger" title="Déconnexion" />
      </div>
    </header>
  );
}