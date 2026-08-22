import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { formatFCFA, cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function CashierStatsView({ currentUser }) {
  const [period, setPeriod] = useState('today'); // 'today' | 'week'
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser?.id) {
      fetchStats();
    }
  }, [currentUser?.id, period]);

  useEffect(() => {
    const handleRefresh = () => fetchStats();
    window.addEventListener('pos:dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('pos:dashboard-refresh', handleRefresh);
  }, [currentUser?.id, period]);

  const fetchStats = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const now = new Date();
      let startDateStr, endDateStr;
      const getStr = (d) => d.toISOString().split('T')[0];

      if (period === 'today') {
        const todayStr = getStr(now);
        startDateStr = todayStr;
        endDateStr = todayStr;
      } else {
        const d = new Date(now);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        startDateStr = getStr(d);
        endDateStr = getStr(now);
      }

      const res = await fetch(`${API_BASE}/stats?cashierId=${currentUser.id}&startDate=${startDateStr}&endDate=${endDateStr}`);
      if (res.ok) {
        const data = await res.json();
        setStats(period === 'today' ? data.today : data.week);
      }
    } catch (e) {
      console.error('Fetch cashier stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white/[0.01] p-2 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-gold" />
          <h2 className="text-sm font-bold text-foreground">Mon Tableau de Bord Ventes</h2>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400 uppercase">
            Session Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setPeriod('today')}
              className={cx(
                "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                period === 'today' ? "bg-gold text-black shadow" : "text-foreground/60 hover:text-foreground"
              )}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={cx(
                "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer",
                period === 'week' ? "bg-gold text-black shadow" : "text-foreground/60 hover:text-foreground"
              )}
            >
              Cette Semaine
            </button>
          </div>

          <button
            type="button"
            onClick={fetchStats}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-foreground/70 transition cursor-pointer border border-white/5"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {loading && !stats ? (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            Chargement des statistiques...
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gold/15 to-transparent p-4 relative overflow-hidden shadow-lg">
                <div className="absolute top-3 right-3 text-gold/30">
                  <TrendingUp className="h-10 w-10" />
                </div>
                <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Chiffre d'Affaires</div>
                <div className="text-xl font-black text-gold mt-1.5">{formatFCFA(stats.total || 0)}</div>
                <div className="text-[9px] text-foreground/40 mt-1">Direct: {formatFCFA(stats.total - (stats.reservationTotal || 0))} | Acompte: {formatFCFA(stats.reservationTotal || 0)}</div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 relative overflow-hidden shadow">
                <div className="absolute top-3 right-3 text-emerald-400/20">
                  <DollarSign className="h-10 w-10" />
                </div>
                <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Espèces (Cash)</div>
                <div className="text-xl font-black text-emerald-400 mt-1.5">{formatFCFA(stats.cash || 0)}</div>
                <div className="text-[9px] text-foreground/40 mt-1">Ventes: {formatFCFA(stats.directCash || 0)} | Rés: {formatFCFA(stats.resCash || 0)}</div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 relative overflow-hidden shadow">
                <div className="absolute top-3 right-3 text-amber-500/20">
                  <CreditCard className="h-10 w-10" />
                </div>
                <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Mobile Money</div>
                <div className="text-xl font-black text-amber-400 mt-1.5">{formatFCFA(stats.online || 0)}</div>
                <div className="text-[9px] text-foreground/40 mt-1">Ventes: {formatFCFA(stats.directOnline || 0)} | Rés: {formatFCFA(stats.resOnline || 0)}</div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 relative overflow-hidden shadow">
                <div className="absolute top-3 right-3 text-orange-500/20">
                  <CreditCard className="h-10 w-10" />
                </div>
                <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Orange Money</div>
                <div className="text-xl font-black text-orange-400 mt-1.5">{formatFCFA(stats.orangeMoney || 0)}</div>
                <div className="text-[9px] text-foreground/40 mt-1">Ventes: {formatFCFA(stats.directOrange || 0)} | Rés: {formatFCFA(stats.resOrange || 0)}</div>
              </div>
            </div>

            {/* Transaction count summary */}
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="flex gap-8">
                <div>
                  <div className="text-[10px] text-foreground/40 font-bold uppercase">Factures Directes</div>
                  <div className="text-base font-bold text-foreground mt-0.5">{stats.count || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] text-foreground/40 font-bold uppercase">Acomptes Réservations</div>
                  <div className="text-base font-bold text-foreground mt-0.5">{stats.resPaymentsCount || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] text-foreground/40 font-bold uppercase">Total Transactions</div>
                  <div className="text-base font-bold text-foreground mt-0.5">{(stats.count || 0) + (stats.resPaymentsCount || 0)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[11px] text-foreground/60 leading-relaxed">
              💡 Ce tableau inclut uniquement les ventes validées par <strong>{currentUser?.name || 'vous'}</strong>. Les montants affichés correspondent à vos encaissements en espèces, Mobile Money et Orange Money.
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            Aucune statistique disponible pour cette période.
          </div>
        )}
      </div>
    </div>
  );
}
