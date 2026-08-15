import React, { useState } from 'react';
import { Award, Printer, Calendar } from 'lucide-react';
import { formatFCFA, getTodayDateStr } from '../../utils/helpers';

export default function ZReport({ zReportData, onGenerate, onPrint }) {
  const today = getTodayDateStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const handleApplyPreset = (type) => {
    const todayStr = getTodayDateStr();
    if (type === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      if (onGenerate) onGenerate({ startDate: todayStr, endDate: todayStr });
    } else if (type === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      const s = d.toISOString().split('T')[0];
      setStartDate(s);
      setEndDate(todayStr);
      if (onGenerate) onGenerate({ startDate: s, endDate: todayStr });
    } else if (type === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(s);
      setEndDate(todayStr);
      if (onGenerate) onGenerate({ startDate: s, endDate: todayStr });
    }
  };

  const handleGenerate = () => {
    if (onGenerate) {
      onGenerate({ startDate, endDate });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="rounded-2xl bg-white/[0.03] p-5 border border-white/10 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-gold" />
            Rapport Comptable & Clôture (Z)
          </h3>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset('today')}
              className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground/80 transition cursor-pointer"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('week')}
              className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground/80 transition cursor-pointer"
            >
              Cette semaine
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('month')}
              className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground/80 transition cursor-pointer"
            >
              Ce mois-ci
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground/90">Du :</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-800 text-white font-bold border-2 border-gold/70 hover:border-gold rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer transition shadow-md"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground/90">Au :</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-800 text-white font-bold border-2 border-gold/70 hover:border-gold rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer transition shadow-md"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              className="flex items-center gap-2 rounded-xl bg-gold hover:bg-gold/90 text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-gold/20 transition active:scale-95 cursor-pointer"
            >
              <Award className="h-4 w-4" />
              Générer le rapport
            </button>
            {zReportData && (
              <button
                type="button"
                onClick={() => onPrint && onPrint({ ...zReportData, isZReport: true, zReport: zReportData })}
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-foreground px-4 py-2.5 text-xs font-bold transition border border-white/20 shadow-md cursor-pointer"
              >
                <Printer className="h-4 w-4 text-gold" />
                Imprimer le ticket
              </button>
            )}
          </div>
        </div>
      </div>

      {zReportData ? (
        <div className="rounded-2xl bg-white/[0.015] p-5 border border-white/5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="text-xs uppercase font-bold text-gold tracking-wider">
                {zReportData.periodLabel || 'Période Sélectionnée'}
              </div>
              <div className="text-3xl font-black text-foreground mt-1">
                {formatFCFA(zReportData.totalSales || zReportData.total)}
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="text-xs font-semibold text-foreground/80">
                <strong className="text-gold font-bold">{zReportData.validatedCount || zReportData.count}</strong> ventes validées
              </div>
              {zReportData.resPaymentCount > 0 && (
                <div className="text-xs font-bold text-emerald-400">
                  + <strong className="font-extrabold">{zReportData.resPaymentCount}</strong> acomptes de réservations encaissements
                </div>
              )}
              {zReportData.cancelledCount > 0 && (
                <div className="text-xs font-semibold text-red-400">
                  {zReportData.cancelledCount} ventes annulées
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Breakdown */}
          {zReportData.payments && (
            <div>
              <div className="text-xs uppercase font-bold text-foreground/50 mb-2">Ventilation par Mode de Règlement :</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <div className="text-xs font-bold text-emerald-400">💵 Espèces</div>
                  <div className="mt-1 text-xl font-bold text-foreground">{formatFCFA(zReportData.payments.CASH || 0)}</div>
                </div>

                <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
                  <div className="text-xs font-bold text-blue-400">📱 Mobile Money</div>
                  <div className="mt-1 text-xl font-bold text-foreground">{formatFCFA(zReportData.payments.ONLINE || 0)}</div>
                </div>

                <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
                  <div className="text-xs font-bold text-orange-400">🟧 Orange Money</div>
                  <div className="mt-1 text-xl font-bold text-foreground">{formatFCFA(zReportData.payments.ORANGE_MONEY || 0)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Top Selling Categories in this Period */}
          {zReportData.topSelling && zReportData.topSelling.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <div className="text-xs uppercase font-bold text-foreground/50 mb-2">Répartition des ventes par Catégorie sur la période :</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {zReportData.topSelling.map((cat, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/[0.02] p-2.5 rounded-xl border border-white/5 text-xs">
                    <span className="font-semibold text-foreground/90">{cat.name} (x{cat.quantity})</span>
                    <span className="font-mono font-bold text-gold">{formatFCFA(cat.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.01] p-8 text-center text-sm text-foreground/40 italic border border-white/5">
          Sélectionnez la période souhaitée et cliquez sur "GÉNÉRER LE RAPPORT".
        </div>
      )}
    </div>
  );
}
