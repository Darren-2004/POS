import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import IconButton from '../../components/IconButton';
import ConfirmModal from '../../components/ConfirmModal';
import { formatFCFA, triggerPrint, getTodayDateStr, cx } from '../../utils/helpers';
import { Printer, Trash2, Receipt, RotateCcw, Calendar, X } from 'lucide-react';
import { API_BASE } from '../../utils/constants';

const SHOP_NAME = 'JOEL SHOP';

export default function Dashboard({ stats = {}, invoices = [], reservationPayments = [], reservations = [], users = [], filterDate, setFilterDate, filterCashier, setFilterCashier, fetchInvoices, loading = false }) {
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState(null);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [previewInvoice, setPreviewInvoice] = useState(null);

  const todayStr = getTodayDateStr();

  // Normalize arrays to prevent rendering crashes
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const safeResPayments = Array.isArray(reservationPayments) ? reservationPayments : [];
  const safeReservations = Array.isArray(reservations) ? reservations : [];
  const safeUsers = Array.isArray(users) ? users : [];

  const asNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeStatus = (value) => String(value || '').trim().toUpperCase();
  const normalizeMethod = (value) => String(value || '').trim().toUpperCase();
  const isReservationInvoice = (inv) => {
    if (!inv || typeof inv !== 'object') return false;
    if (inv.isReservation === true || inv.isReservation === 1 || inv.isReservation === '1' || inv.isReservation === 'true') return true;
    if (inv.isReservationInvoice === true || inv.isReservationInvoice === 1 || inv.isReservationInvoice === '1' || inv.isReservationInvoice === 'true') return true;
    if (inv.reservationNo || inv.reservationId || inv.reservation_id) return true;
    return false;
  };

  // Invoice list (for the table): show all invoices fetched (already date-filtered by API)
  const directValidatedInvoices = safeInvoices.filter(inv => {
    if (!inv) return false;
    return normalizeStatus(inv.status) === 'VALIDATED' && !isReservationInvoice(inv);
  });

  const invCashSales   = directValidatedInvoices.filter(inv => { const m = normalizeMethod(inv.paymentMethod); return m === 'CASH' || m === 'UNSPECIFIED' || !m; });
  const invOnlineSales = directValidatedInvoices.filter(inv => normalizeMethod(inv.paymentMethod) === 'ONLINE');
  const invOrangeSales = directValidatedInvoices.filter(inv => normalizeMethod(inv.paymentMethod) === 'ORANGE_MONEY');
  // ── TOP CARDS: authoritative numbers come from stats.filtered (server-computed) ──
  const computeFallbackStats = () => {
    let total = 0, cash = 0, online = 0, orangeMoney = 0, count = 0, reservationTotal = 0, resPaymentsCount = 0;
    let directCash = 0, directOnline = 0, directOrange = 0;
    let resCash = 0, resOnline = 0, resOrange = 0;

    safeInvoices.forEach(inv => {
      if (normalizeStatus(inv.status) === 'VALIDATED' && !isReservationInvoice(inv)) {
        count++;
        const amt = asNumber(inv.totalAmount);
        total += amt;
        const m = normalizeMethod(inv.paymentMethod);
        if (m === 'ORANGE_MONEY' || m === 'ORANGE' || m === 'OM') {
          orangeMoney += amt; directOrange += amt;
        } else if (m === 'ONLINE' || m === 'MOBILE_MONEY' || m === 'MOMO' || m === 'WAVE') {
          online += amt; directOnline += amt;
        } else {
          cash += amt; directCash += amt;
        }
      }
    });

    safeResPayments.forEach(p => {
      resPaymentsCount++;
      const amt = asNumber(p.amount);
      reservationTotal += amt;
      total += amt;
      const m = normalizeMethod(p.paymentMethod);
      if (m === 'ORANGE_MONEY' || m === 'ORANGE' || m === 'OM') {
        orangeMoney += amt; resOrange += amt;
      } else if (m === 'ONLINE' || m === 'MOBILE_MONEY' || m === 'MOMO' || m === 'WAVE') {
        online += amt; resOnline += amt;
      } else {
        cash += amt; resCash += amt;
      }
    });

    return {
      total, cash, online, orangeMoney, count, reservationTotal,
      resPaymentsCount, directCash, directOnline, directOrange,
      resCash, resOnline, resOrange
    };
  };

  const sf = (stats && stats.filtered && typeof stats.filtered.total === 'number')
    ? stats.filtered
    : computeFallbackStats();

  const filteredTotal       = asNumber(sf.total);
  const filteredCashTotal   = asNumber(sf.cash);
  const filteredOnlineTotal = asNumber(sf.online);
  const filteredOrangeTotal = asNumber(sf.orangeMoney);

  // Direct sales = total minus reservation advances
  const reserveTotal  = asNumber(sf.reservationTotal);
  const salesTotal    = filteredTotal - reserveTotal;
  const reserveCount  = asNumber(sf.resPaymentsCount);
  const salesCount    = asNumber(sf.count);

  const directCash   = asNumber(sf.directCash);
  const directOnline = asNumber(sf.directOnline);
  const directOrange = asNumber(sf.directOrange);

  const resCash   = asNumber(sf.resCash);
  const resOnline = asNumber(sf.resOnline);
  const resOrange = asNumber(sf.resOrange);

  const formatMethodSummary = (saleTotalValue, advanceTotalValue) => {
    const parts = [`Ventes: ${formatFCFA(saleTotalValue)}`];
    if (advanceTotalValue > 0) {
      parts.push(`Acomptes: ${formatFCFA(advanceTotalValue)}`);
    }
    return parts.join(' | ');
  };
  const topSummary = `${salesCount} vente${salesCount === 1 ? '' : 's'} directe${salesCount === 1 ? '' : 's'} (${formatFCFA(salesTotal)}) ${reserveCount > 0 ? `+ ${reserveCount} acompte${reserveCount === 1 ? '' : 's'} (${formatFCFA(reserveTotal)})` : ''}`;

  const isFiltered = Boolean(filterDate || filterCashier);

  const handleDateChange = (newDate) => {
    setFilterDate(newDate || '');
  };

  const handleCashierChange = (newCashier) => {
    setFilterCashier(newCashier || '');
  };

  const formatFilterDate = (dateStr) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'object') {
      if (dateStr.startDate && dateStr.endDate) return `Du ${dateStr.startDate} au ${dateStr.endDate}`;
      if (dateStr.date) dateStr = dateStr.date;
      else return '';
    }
    if (typeof dateStr !== 'string') return String(dateStr);
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('fr-FR');
    }
    return dateStr;
  };

  const handleRowClick = (inv, e) => {
    if (e.target.closest('button')) return;
    setPreviewInvoice(prev => prev?.id === inv.id ? null : inv);
  };

  const confirmDeleteInvoice = async () => {
    const inv = pendingDeleteInvoice;
    if (!inv) return;
    if (!adminPinInput.trim()) {
      setDeleteError('Mot de passe administrateur requis');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/invoices/${inv.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPinInput.trim()
        }
      });
      if (res.ok) {
        if (previewInvoice?.id === inv.id) setPreviewInvoice(null);
        setPendingDeleteInvoice(null);
        setAdminPinInput('');
        setDeleteError('');
        if (typeof fetchInvoices === 'function') fetchInvoices(filterDate, filterCashier);
        window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      } else {
        const j = await res.json().catch(() => ({}));
        setDeleteError(j.error || 'Mot de passe administrateur incorrect');
      }
    } catch (e) {
      console.error(e);
      setDeleteError('Erreur réseau lors de la suppression');
    }
  };

  const groupInvoiceItems = (items = []) => {
    const map = {};
    items.forEach(item => {
      const key = `${item.categoryName}||${item.price}`;
      if (!map[key]) map[key] = { categoryName: item.categoryName, price: item.price, qty: 0 };
      map[key].qty += 1;
    });
    return Object.values(map);
  };

  return (
    <div className="space-y-6">
      {/* Top Cards Section */}
      <section className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
        <div className="rounded-2xl bg-white/[0.02] p-4 border border-gold/20 text-sm text-foreground/80 shadow-lg shadow-gold/5">
          <div className="text-[10px] uppercase tracking-[0.24em] text-gold font-semibold flex items-center gap-1.5">
            {loading
              ? <span className="w-2 h-2 rounded-full bg-gold animate-ping inline-block" />
              : <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />}
            {filterDate ? `Total Encaissements (${formatFilterDate(filterDate)})` : 'Total Encaissements (Toutes les dates)'}
          </div>
          <div className="mt-3 text-2xl font-bold text-gold">{formatFCFA(filteredTotal)}</div>
          <div className="mt-1 text-xs text-foreground/50">{topSummary}</div>
        </div>

        <div className="rounded-2xl bg-white/[0.015] p-4 border border-white/5 text-sm text-foreground/80">
          <div className="text-[10px] uppercase tracking-[0.24em] text-foreground/40">Règlements Espèces</div>
          <div className="mt-3 text-2xl font-semibold text-emerald-400">{formatFCFA(filteredCashTotal)}</div>
          <div className="mt-1 text-xs text-foreground/40">{formatMethodSummary(directCash, resCash)}</div>
        </div>

        <div className="rounded-2xl bg-white/[0.015] p-4 border border-white/5 text-sm text-foreground/80">
          <div className="text-[10px] uppercase tracking-[0.24em] text-foreground/40">Mobile Money</div>
          <div className="mt-3 text-2xl font-semibold text-blue-400">{formatFCFA(filteredOnlineTotal)}</div>
          <div className="mt-1 text-xs text-foreground/40">{formatMethodSummary(directOnline, resOnline)}</div>
        </div>

        <div className="rounded-2xl bg-white/[0.015] p-4 border border-white/5 text-sm text-foreground/80">
          <div className="text-[10px] uppercase tracking-[0.24em] text-orange-400/90 font-semibold">Orange Money</div>
          <div className="mt-3 text-2xl font-semibold text-orange-400">{formatFCFA(filteredOrangeTotal)}</div>
          <div className="mt-1 text-xs text-foreground/40">{formatMethodSummary(directOrange, resOrange)}</div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="space-y-4">
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

        {/* Invoice List Table */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 rounded-2xl bg-white/[0.015] border border-white/5 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-foreground/50 text-[10px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Facture N°</th>
                  {!previewInvoice && <th className="p-3">Date & Heure</th>}
                  <th className="p-3">Caissière</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {safeInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-foreground/40 italic">
                      Aucune vente trouvée pour les filtres sélectionnés.
                    </td>
                  </tr>
                ) : (
                  safeInvoices.map(inv => (
                    <tr
                      key={inv.id}
                      onClick={(e) => handleRowClick(inv, e)}
                      className={cx(
                        'cursor-pointer transition',
                        previewInvoice?.id === inv.id
                          ? 'bg-gold/10 border-l-2 border-gold'
                          : 'hover:bg-white/[0.025]'
                      )}
                    >
                      <td className="p-3 font-semibold text-foreground/90 text-[11px]">
                        <div>{inv.invoiceNumber}</div>
                        {inv.isReservation && (
                          <span className="mt-1 inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            🏷️ Fin de Réservation
                          </span>
                        )}
                      </td>
                      {!previewInvoice && <td className="p-3 text-foreground/60 text-[11px]">{new Date(inv.createdAt).toLocaleString('fr-FR')}</td>}
                      <td className="p-3 font-medium text-[11px]">{inv.createdBy?.name || 'N/A'}</td>
                      <td className="p-3 text-right font-mono font-semibold text-gold text-[11px]">{formatFCFA(inv.totalAmount)}</td>
                      <td className="p-3">
                        <StatusChip
                          tone={inv.status === 'VALIDATED' ? 'emerald' : 'red'}
                          label={inv.status === 'VALIDATED' ? 'Validée' : 'Annulée'}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <IconButton
                            icon={<Printer className="h-3.5 w-3.5 text-foreground/70" />}
                            onClick={(e) => { e.stopPropagation(); triggerPrint(inv); }}
                            title="Imprimer"
                          />
                          <IconButton
                            icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />}
                            onClick={(e) => { e.stopPropagation(); setPendingDeleteInvoice(inv); }}
                            title="Supprimer"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paper Sheet Invoice Preview Modal / Sidebar */}
          {previewInvoice && (
            <div
              className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer p-4"
              onClick={() => setPreviewInvoice(null)}
            >
              <div
                className="w-full max-w-md bg-zinc-100 border border-zinc-300 rounded-2xl p-1 overflow-hidden shadow-2xl animate-in slide-in-from-right-4 duration-200 cursor-default self-start mt-12 mr-6 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Paper Top Controls */}
              <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 text-white rounded-t-xl">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
                  <Receipt className="h-4 w-4" />
                  <span>Aperçu Facture Papier</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Real White Paper Sheet */}
              <div className="p-4 space-y-4 bg-white text-zinc-900 font-sans shadow-md rounded-b-xl max-h-[calc(100vh-250px)] overflow-y-auto">
                {/* Paper Header */}
                <div className="text-center pb-3 border-b-2 border-zinc-900">
                  <h1 className="text-lg font-extrabold tracking-tight text-zinc-900 uppercase">{SHOP_NAME}</h1>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Facture de caisse originale</p>
                  <div className="mt-2 inline-block px-3 py-1 bg-zinc-900 text-white font-mono text-xs font-bold rounded">
                    {previewInvoice.invoiceNumber}
                  </div>
                </div>

                {previewInvoice.isReservation && (
                  <div className="bg-purple-100 border border-purple-300 text-purple-900 rounded-lg p-2 text-center text-xs font-bold">
                    🏷️ FIN DE RÉSERVATION ({previewInvoice.reservationNo || 'RÉSERVÉ'})
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs py-1 border-b border-zinc-200">
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Date & Heure</span>
                    <span className="font-semibold text-zinc-800">{new Date(previewInvoice.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Caissière</span>
                    <span className="font-semibold text-zinc-800">{previewInvoice.createdBy?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Client</span>
                    <span className="font-semibold text-zinc-800">{previewInvoice.clientName || 'Client de passage'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Mode de paiement</span>
                    <span className="font-bold text-emerald-700">
                      {previewInvoice.paymentMethod === 'CASH'
                        ? 'Espèces'
                        : previewInvoice.paymentMethod === 'ONLINE'
                        ? 'Mobile Money'
                        : previewInvoice.paymentMethod === 'ORANGE_MONEY'
                        ? 'Orange Money'
                        : 'Non précisé'}
                    </span>
                  </div>
                </div>

                {/* Paper Items Table */}
                <div className="py-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">
                        <th className="pb-1 text-left">Article / Catégorie</th>
                        <th className="pb-1 text-center">Qté</th>
                        <th className="pb-1 text-right">P.U</th>
                        <th className="pb-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 font-mono">
                      {groupInvoiceItems(previewInvoice.items).map((item, idx) => (
                        <tr key={idx} className="text-zinc-900">
                          <td className="py-2 pr-2 font-sans font-medium text-xs">{item.categoryName}</td>
                          <td className="py-2 text-center font-bold">{item.qty}</td>
                          <td className="py-2 text-right text-zinc-600 text-[11px]">{formatFCFA(item.price)}</td>
                          <td className="py-2 text-right font-bold text-zinc-900">{formatFCFA(item.price * item.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paper Total Box */}
                <div className="border-t-2 border-zinc-900 pt-3 flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                  <span className="text-xs font-black uppercase text-zinc-700">Total Net Réglé :</span>
                  <span className="text-lg font-black text-zinc-900 font-mono">{formatFCFA(previewInvoice.totalAmount)}</span>
                </div>

                {/* Status Notice */}
                {previewInvoice.status === 'CANCELLED' && (
                  <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg text-xs text-red-800 space-y-0.5">
                    <div className="font-bold text-red-700">⚠ Facture Annulée</div>
                    {previewInvoice.cancellationReason && <div>Motif : {previewInvoice.cancellationReason}</div>}
                    {previewInvoice.cancelledBy?.name && <div>Par : {previewInvoice.cancelledBy.name}</div>}
                  </div>
                )}

                {/* Print button */}
                <button
                  type="button"
                  onClick={() => triggerPrint(previewInvoice)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 text-white py-3 text-xs font-bold hover:bg-zinc-800 transition shadow-lg cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-gold" />
                  Imprimer la Facture Papier
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </section>

      {/* Admin Password confirmation modal for delete */}
      {pendingDeleteInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
          onClick={() => { setPendingDeleteInvoice(null); setAdminPinInput(''); setDeleteError(''); }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-900 p-6 space-y-4 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="text-sm font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>Confirmation de suppression</span>
              </div>
              <button
                type="button"
                onClick={() => { setPendingDeleteInvoice(null); setAdminPinInput(''); setDeleteError(''); }}
                className="text-foreground/40 hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-foreground/80 space-y-1">
              <p>Vous êtes sur le point de supprimer définitivement la facture <b className="text-gold font-mono">{pendingDeleteInvoice.invoiceNumber}</b> ({formatFCFA(pendingDeleteInvoice.totalAmount)}).</p>
              <p className="text-foreground/50">Cette action exige le mot de passe administrateur.</p>
            </div>

            {deleteError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-2.5 text-xs font-semibold text-red-400">
                ⚠ {deleteError}
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); confirmDeleteInvoice(); }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/90">Mot de passe / Code PIN Admin :</label>
                <input
                  type="password"
                  autoFocus
                  placeholder="Entrez le mot de passe admin"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="w-full bg-zinc-800 text-white font-mono border border-white/20 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setPendingDeleteInvoice(null); setAdminPinInput(''); setDeleteError(''); }}
                  className="px-4 py-2 text-xs rounded-xl bg-white/5 text-foreground/70 hover:bg-white/10 transition font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition cursor-pointer shadow-lg shadow-red-600/20"
                >
                  Confirmer la suppression
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
