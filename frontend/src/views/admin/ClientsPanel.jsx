import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, Phone, ShoppingBag, Calendar, TrendingUp, Users } from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { cx } from '../../utils/helpers';

function formatFCFA(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export default function ClientsPanel() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchClients = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.append('q', q.trim());
      const res = await fetch(`${API_BASE}/clients/stats?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Fetch clients error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients('');
  }, [fetchClients]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => fetchClients(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchClients]);

  // Computed totals
  const totalClients = clients.length;
  const totalRevenue = clients.reduce((s, c) => s + (c.totalSpent || 0), 0);
  const topClient = clients.length > 0
    ? [...clients].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))[0]
    : null;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10">
            <Users className="h-5 w-5 text-gold" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Total Clients</div>
            <div className="text-2xl font-bold text-foreground tabular-nums">{totalClients}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Chiffre d'affaires clients</div>
            <div className="text-lg font-bold text-emerald-400 tabular-nums">{formatFCFA(totalRevenue)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
            <ShoppingBag className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Meilleur client</div>
            <div className="text-sm font-bold text-purple-300 truncate">{topClient?.name || '—'}</div>
            {topClient && (
              <div className="text-xs text-foreground/50 font-mono">{formatFCFA(topClient.totalSpent)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
        <input
          type="text"
          placeholder="Rechercher un client par nom ou téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-foreground/30 outline-none focus:border-gold/60 transition"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gold animate-pulse font-mono">
            ...
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-zinc-900 text-[10px] uppercase tracking-wider text-foreground/50 font-semibold border-b border-white/[0.07]">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3 hidden sm:table-cell">Téléphone</th>
              <th className="px-4 py-3 text-right">Total Achats</th>
              <th className="px-4 py-3 text-center hidden md:table-cell">Factures</th>
              <th className="px-4 py-3 text-center hidden md:table-cell">Réservations</th>
              <th className="px-4 py-3 hidden lg:table-cell">Dernier achat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-foreground/40">
                  {search ? 'Aucun client trouvé pour cette recherche.' : 'Aucun client enregistré.'}
                </td>
              </tr>
            )}
            {clients.map((client) => {
              const isTop = topClient && client.id === topClient.id;
              return (
                <tr
                  key={client.id}
                  onClick={() => setSelected(selected?.id === client.id ? null : client)}
                  className={cx(
                    'cursor-pointer transition-colors',
                    selected?.id === client.id
                      ? 'bg-gold/10'
                      : 'hover:bg-white/[0.03]'
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cx(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold shrink-0',
                        isTop ? 'bg-gold/20 text-gold' : 'bg-white/5 text-foreground/60'
                      )}>
                        {client.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-xs flex items-center gap-1">
                          {client.name}
                          {isTop && <span className="text-[9px] bg-gold/20 text-gold px-1.5 rounded-full font-bold">⭐ Top</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-mono text-foreground/70">
                    {client.phone || <span className="text-foreground/30 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cx(
                      'font-bold font-mono tabular-nums',
                      client.totalSpent > 0 ? 'text-emerald-400' : 'text-foreground/40'
                    )}>
                      {formatFCFA(client.totalSpent)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="inline-flex items-center justify-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold text-foreground/70">
                      {client.invoiceCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="inline-flex items-center justify-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-400">
                      {client.reservationCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-foreground/50">
                    {formatDate(client.lastPurchaseAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Panel — shown when a client is selected */}
      {selected && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-lg font-bold text-gold">
                {selected.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{selected.name}</div>
                {selected.phone && (
                  <div className="flex items-center gap-1 text-xs text-foreground/60 font-mono">
                    <Phone className="h-3 w-3" />
                    {selected.phone}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-foreground/40 hover:text-foreground text-lg leading-none"
            >✕</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-foreground/50 mb-1">Total dépensé</div>
              <div className="text-base font-bold text-emerald-400 font-mono tabular-nums">{formatFCFA(selected.totalSpent)}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-foreground/50 mb-1">Factures</div>
              <div className="text-xl font-bold text-foreground">{selected.invoiceCount}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-foreground/50 mb-1">Réservations</div>
              <div className="text-xl font-bold text-purple-400">{selected.reservationCount}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-foreground/50 mb-1">Dernier achat</div>
              <div className="text-xs font-semibold text-foreground/80">{formatDate(selected.lastPurchaseAt)}</div>
            </div>
          </div>

          <div className="text-[11px] text-foreground/40 italic">
            Client enregistré le {formatDate(selected.createdAt)}
          </div>
        </div>
      )}
    </div>
  );
}
