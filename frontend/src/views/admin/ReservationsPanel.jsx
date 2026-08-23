import React, { useState, useEffect } from 'react';
import { formatFCFA, getTodayDateStr, triggerProformaPrint, cx } from '../../utils/helpers';
import { RotateCcw, Calendar, Printer, Trash2, XCircle } from 'lucide-react';

export default function ReservationsPanel({
  reservations = [],
  users = [],
  filterDate,
  setFilterDate,
  filterCashier,
  setFilterCashier,
  selectedReservationId,
  setSelectedReservationId,
  onRefresh
}) {
  const [reservationStatusFilter, setReservationStatusFilter] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelReservation = async (resId) => {
    if (!resId) return;
    if (!window.confirm("Êtes-vous sûr de vouloir annuler définitivement cette réservation ? Cette action est irréversible.")) {
      return;
    }
    
    setIsCancelling(true);
    try {
      const { API_BASE } = await import('../../utils/constants');
      const response = await fetch(`${API_BASE}/reservations/${resId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        alert("Réservation annulée avec succès.");
        setSelectedReservationId(null);
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || "Erreur lors de l'annulation de la réservation.");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur réseau");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteReservation = async (resId) => {
    if (!resId) return;
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette réservation de la base de données ? Toutes les données associées (versements, détails) seront perdues.")) {
      return;
    }
    
    setIsCancelling(true);
    try {
      const { API_BASE } = await import('../../utils/constants');
      const response = await fetch(`${API_BASE}/reservations/${resId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        alert("Réservation supprimée définitivement.");
        setSelectedReservationId(null);
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || "Erreur lors de la suppression de la réservation.");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur réseau");
    } finally {
      setIsCancelling(false);
    }
  };

  const todayStr = getTodayDateStr();

  const safeReservations = Array.isArray(reservations) ? reservations : [];
  const safeUsers = Array.isArray(users) ? users : [];

  const filteredReservations = safeReservations.filter(res => {
    if (!reservationStatusFilter) return true;
    return res.status === reservationStatusFilter;
  });

  const selectedReservation = filteredReservations.find(res => res.id === selectedReservationId) || safeReservations.find(res => res.id === selectedReservationId) || null;

  useEffect(() => {
    if (selectedReservationId && !filteredReservations.some(res => res.id === selectedReservationId)) {
      setSelectedReservationId(null);
    }
  }, [filteredReservations, selectedReservationId]);

  const handleDateChange = (value) => {
    setFilterDate(value);
  };

  const handleCashierChange = (value) => {
    setFilterCashier(value);
  };

  const isFiltered = filterDate || filterCashier;

  const formatFilterDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <section className="space-y-4">
      {/* Filters Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.015] p-4 border border-white/5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-foreground/90">Caissière :</label>
            <select
              value={filterCashier || ''}
              onChange={(e) => handleCashierChange(e.target.value)}
              className="bg-zinc-800 text-white font-bold border-2 border-white/30 hover:border-gold rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 cursor-pointer transition shadow-md"
            >
              <option value="" className="bg-zinc-900 text-white font-normal">Toutes les caissières</option>
              {safeUsers.map(u => (
                <option key={u.id} value={u.id} className="bg-zinc-900 text-white font-normal">{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-foreground/90">Date :</label>
            <input
              type="date"
              value={filterDate || ''}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-zinc-800 text-white font-bold border-2 border-gold/70 hover:border-gold rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer transition shadow-md"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDateChange(todayStr)}
              className={cx(
                'px-3 py-1.5 text-xs rounded-xl transition font-medium flex items-center gap-1.5 cursor-pointer',
                filterDate === todayStr
                  ? 'bg-gold text-black font-semibold'
                  : 'bg-white/[0.04] text-foreground/70 hover:bg-white/[0.08]'
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Aujourd'hui</span>
            </button>

            {filterDate && (
              <button
                type="button"
                onClick={() => handleDateChange('')}
                className="px-3 py-1.5 text-xs rounded-xl bg-white/[0.04] text-foreground/70 hover:bg-white/[0.08] transition flex items-center gap-1.5 border border-white/5 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Toutes les dates</span>
              </button>
            )}
          </div>
        </div>

        {isFiltered && (
          <div className="text-xs text-gold/90 bg-gold/10 border border-gold/20 px-3 py-1.5 rounded-xl font-medium">
            Filtre actif : {filterDate ? formatFilterDate(filterDate) : 'Toutes dates'} {filterCashier ? `| Caissière : ${safeUsers.find(u => u.id === filterCashier)?.name || 'Sélectionnée'}` : ''}
          </div>
        )}
      </div>

      {/* Reservations Section */}
      <section className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.015] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">
            <span className="h-2 w-2 rounded-full bg-gold"></span>
            <span>Réservations</span>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReservationStatusFilter('')} className={cx('rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition', !reservationStatusFilter ? 'bg-gold text-black' : 'bg-white/[0.04] text-foreground/70 hover:bg-white/[0.08]')}>
              Toutes
            </button>
            <button type="button" onClick={() => setReservationStatusFilter('PENDING')} className={cx('rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition', reservationStatusFilter === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.04] text-foreground/70 hover:bg-white/[0.08]')}>
              En cours
            </button>
            <button type="button" onClick={() => setReservationStatusFilter('COMPLETED')} className={cx('rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition', reservationStatusFilter === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.04] text-foreground/70 hover:bg-white/[0.08]')}>
              Terminées
            </button>
          </div>
        </div>

        <div className={cx('flex gap-4 transition-all duration-200', selectedReservation ? 'items-start' : '')}>
          <div className={cx('overflow-hidden rounded-2xl border border-white/5 bg-black/20 transition-all duration-200', selectedReservation ? 'flex-1 min-w-0' : 'w-full')}>
            <table className="w-full border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-foreground/35 bg-white/[0.02]">
                  <th className="p-3">Réservation</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Acompte</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-foreground/40 italic">
                      Aucune réservation pour les filtres actifs.
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map(res => {
                    const totalPaid = (res.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
                    return (
                      <tr
                        key={res.id}
                        onClick={() => setSelectedReservationId(prev => prev === res.id ? null : res.id)}
                        className={cx('cursor-pointer transition', selectedReservationId === res.id ? 'bg-gold/10 border-l-2 border-gold' : 'hover:bg-white/[0.025]')}
                      >
                        <td className="p-3 font-semibold text-gold text-[11px]">{res.reservationNo}</td>
                        <td className="p-3 text-[11px] font-medium text-foreground/90">{res.clientName || 'Client anonyme'}</td>
                        <td className="p-3 text-[11px] text-foreground/60">{new Date(res.createdAt).toLocaleString('fr-FR')}</td>
                        <td className="p-3 text-right font-mono text-[11px] text-gold">{formatFCFA(res.totalAmount)}</td>
                        <td className="p-3 text-right font-mono text-[11px] text-emerald-400">{formatFCFA(totalPaid)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className={cx(
                              'inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider',
                              res.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400' :
                              res.status === 'CANCELLED' ? 'bg-red-500/15 text-red-400' :
                              'bg-amber-500/15 text-amber-400'
                            )}>
                              {res.status === 'COMPLETED' ? 'Terminée' :
                               res.status === 'CANCELLED' ? 'Annulée' :
                               'En cours'}
                            </span>
                            
                            {res.status === 'CANCELLED' ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteReservation(res.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30 transition cursor-pointer"
                                title="Supprimer définitivement"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Supprimer</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCancelReservation(res.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 text-[10px] font-bold border border-amber-500/30 transition cursor-pointer"
                                title="Annuler la réservation"
                              >
                                <XCircle className="h-3 w-3" />
                                <span>Annuler</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => triggerProformaPrint(res)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gold/15 hover:bg-gold/30 text-gold text-[10px] font-bold border border-gold/30 transition cursor-pointer"
                              title="Réimprimer le reçu (Dernière tranche / action)"
                            >
                              <Printer className="h-3 w-3" />
                              <span>Réimprimer</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedReservation && (
            <aside className="w-[420px] shrink-0 overflow-hidden rounded-2xl border border-gold/20 bg-white/[0.02] shadow-xl shadow-gold/5">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">Détails réservation</div>
                <button type="button" onClick={() => setSelectedReservationId(null)} className="rounded-lg p-1 text-foreground/50 hover:bg-white/10 hover:text-foreground transition cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="space-y-4 p-4 text-xs">
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">Référence</div>
                      <div className="mt-1 font-bold text-gold">{selectedReservation.reservationNo}</div>
                    </div>
                    <span className={cx(
                      'rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider',
                      selectedReservation.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400' :
                      selectedReservation.status === 'CANCELLED' ? 'bg-red-500/15 text-red-400' :
                      'bg-amber-500/15 text-amber-400'
                    )}>
                      {selectedReservation.status === 'COMPLETED' ? 'Terminée' :
                       selectedReservation.status === 'CANCELLED' ? 'Annulée' :
                       'En cours'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-[11px] text-foreground/80">
                    <div className="flex justify-between"><span>Client</span><strong>{selectedReservation.clientName || 'Client anonyme'}</strong></div>
                    <div className="flex justify-between"><span>Téléphone</span><strong>{selectedReservation.clientPhone || '—'}</strong></div>
                    <div className="flex justify-between"><span>Créée par</span><strong>{selectedReservation.createdBy?.name || 'N/A'}</strong></div>
                    <div className="flex justify-between"><span>Date création</span><strong>{new Date(selectedReservation.createdAt).toLocaleString('fr-FR')}</strong></div>
                    <div className="flex justify-between"><span>Total</span><strong className="text-gold">{formatFCFA(selectedReservation.totalAmount)}</strong></div>
                    <div className="flex justify-between"><span>Déjà payé</span><strong className="text-emerald-400">{formatFCFA((selectedReservation.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0))}</strong></div>
                    <div className="flex justify-between"><span>Reste</span><strong className={Number(selectedReservation.remainingBalance || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}>{formatFCFA(selectedReservation.remainingBalance || 0)}</strong></div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-foreground/40">Historique des versements</div>
                  <div className="space-y-2">
                    {(selectedReservation.payments || []).length === 0 ? (
                      <div className="text-foreground/40 italic">Aucun acompte enregistré.</div>
                    ) : (
                      (selectedReservation.payments || []).map(payment => (
                        <div key={payment.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-gold">{payment.installmentNumber ? `Tranche ${payment.installmentNumber}` : 'Versement'}</span>
                            <span className="font-mono text-emerald-400">{formatFCFA(payment.amount)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-foreground/60">
                            <span>{payment.paymentMethod || 'CASH'}</span>
                            <span>{new Date(payment.createdAt).toLocaleString('fr-FR')}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-foreground/55">Reçu par : {payment.createdBy?.name || 'Caissière'}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-foreground/40">Opérations</div>
                  <div className="space-y-2">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">Création</div>
                      <div className="mt-1 font-medium">{selectedReservation.createdBy?.name || 'N/A'}</div>
                      <div className="text-[10px] text-foreground/55">{new Date(selectedReservation.createdAt).toLocaleString('fr-FR')}</div>
                    </div>
                    {selectedReservation.updatedAt && (
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">Dernière modification</div>
                        <div className="mt-1 font-medium">{selectedReservation.updatedBy?.name || 'N/A'}</div>
                        <div className="text-[10px] text-foreground/55">{new Date(selectedReservation.updatedAt).toLocaleString('fr-FR')}</div>
                      </div>
                    )}
                    
                    {selectedReservation.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => handleCancelReservation(selectedReservation.id)}
                        disabled={isCancelling}
                        className="w-full mt-2 rounded-xl bg-red-950/40 hover:bg-red-950/60 text-red-400 border border-red-500/30 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        ✕ {isCancelling ? 'Annulation...' : 'Annuler la réservation'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>
    </section>
  );
}
