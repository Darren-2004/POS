import React, { useState, useEffect } from 'react';
import { Search, Printer, Eye, X, Receipt, Calendar, User, CreditCard } from 'lucide-react';
import Field, { inputCls } from './Field';
import StatusChip from './StatusChip';
import { formatFCFA, triggerPrint, getPaymentMethodLabel, getTodayDateStr, cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function CashierInvoicesView({ currentUser, serverOnline }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  // Date and status filters
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [selectedStatus, setSelectedStatus] = useState('VALIDATED'); // Default to valid transactions

  useEffect(() => {
    if (currentUser?.id) {
      fetchCashierInvoices();
    }
  }, [currentUser?.id, selectedDate, selectedStatus]);

  useEffect(() => {
    const handleRefresh = () => fetchCashierInvoices();
    window.addEventListener('pos:dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('pos:dashboard-refresh', handleRefresh);
  }, [currentUser?.id, selectedDate, selectedStatus]);

  const fetchCashierInvoices = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      let url = `${API_BASE}/invoices?cashierId=${currentUser.id}`;
      if (selectedDate) {
        url += `&date=${selectedDate}`;
      }
      if (selectedStatus && selectedStatus !== 'all') {
        url += `&status=${selectedStatus}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Fetch cashier invoices error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const invNo = (inv.invoiceNumber || '').toLowerCase();
    const client = (inv.clientName || '').toLowerCase();
    return invNo.includes(q) || client.includes(q);
  });

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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white/[0.01] p-2">
      {/* Search & Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-gold" />
          <h2 className="text-sm font-bold text-foreground">Mes Ventes & Réimpression</h2>
          <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-extrabold text-gold">
            {invoices.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector Filter */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-2 py-1">
            <Calendar className="h-3.5 w-3.5 text-gold" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-foreground text-xs font-bold outline-none cursor-pointer [color-scheme:dark]"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-foreground/40 hover:text-white px-1 font-bold"
                title="Toutes les dates"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Dropdown Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-zinc-900 border border-white/10 text-foreground text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
          >
            <option value="all">Tous statuts</option>
            <option value="VALIDATED">Validées</option>
            <option value="CANCELLED">Annulées</option>
          </select>

          {/* Search bar */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
            <input
              type="text"
              placeholder="Rechercher N° de facture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cx(inputCls, 'pl-8 bg-zinc-900 border-white/10 text-foreground text-xs')}
            />
          </div>

          <button
            type="button"
            onClick={fetchCashierInvoices}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-foreground/70 transition cursor-pointer border border-white/5"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="min-h-0 flex-1 overflow-hidden bg-black/20 rounded-2xl border border-white/5 flex flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10 text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">
              <tr>
                <th className="px-4 py-3">Facture N°</th>
                <th className="px-4 py-3">Date & Heure</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Règlement</th>
                <th className="px-4 py-3 text-right">Montant Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-foreground/40 italic">
                    Chargement de vos ventes...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-16 text-foreground/40 italic">
                    Aucune vente enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className="hover:bg-white/[0.03] transition cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-gold">
                      <div>{inv.invoiceNumber}</div>
                      {inv.isReservation && (
                        <span className="text-[9px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30">
                          🏷️ Fin Réservation
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/60 text-[11px]">
                      {new Date(inv.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {inv.clientName || 'Client de passage'}
                    </td>
                    <td className="px-4 py-3 text-foreground/80 font-medium">
                      {getPaymentMethodLabel(inv.paymentMethod)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-gold text-sm">
                      {formatFCFA(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip
                        tone={inv.status === 'VALIDATED' ? 'emerald' : 'red'}
                        label={inv.status === 'VALIDATED' ? 'Validée' : 'Annulée'}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-foreground/80 text-xs font-semibold transition cursor-pointer border border-white/10"
                        >
                          <Eye className="h-3.5 w-3.5 text-foreground/60" />
                          <span>Détails</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerPrint(inv)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gold/15 hover:bg-gold/30 text-gold text-xs font-bold transition cursor-pointer border border-gold/30 shadow-sm"
                          title="Lancer la réimpression directe"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Réimprimer</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVOICE DETAILS MODAL / DRAWER */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border-l border-white/10 h-full flex flex-col shadow-2xl p-5 overflow-hidden animate-in slide-in-from-right duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-gold" />
                <div>
                  <h3 className="text-sm font-black text-gold font-mono">{selectedInvoice.invoiceNumber}</h3>
                  <div className="text-xs text-foreground/50">Détails de la vente</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl p-1 text-foreground/50 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="space-y-2 rounded-2xl bg-white/[0.02] p-3 border border-white/5 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-foreground/50">Date & Heure</span>
                  <span className="font-semibold">{new Date(selectedInvoice.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-foreground/50">Client</span>
                  <span className="font-semibold text-gold">{selectedInvoice.clientName || 'Client de passage'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-foreground/50">Mode de paiement</span>
                  <span className="font-bold text-emerald-400">{getPaymentMethodLabel(selectedInvoice.paymentMethod)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-foreground/50">Statut</span>
                  <StatusChip
                    tone={selectedInvoice.status === 'VALIDATED' ? 'emerald' : 'red'}
                    label={selectedInvoice.status === 'VALIDATED' ? 'Validée' : 'Annulée'}
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 rounded-2xl bg-white/[0.02] p-3 border border-white/5">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/50">Articles achetés</div>
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-zinc-900 text-[10px] uppercase text-foreground/50 font-semibold border-b border-white/5">
                      <tr>
                        <th className="p-2">Désignation</th>
                        <th className="p-2 text-center">Qté</th>
                        <th className="p-2 text-right">P/U</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {groupInvoiceItems(selectedInvoice.items).map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-foreground font-medium">{item.categoryName}</td>
                          <td className="p-2 text-center text-foreground/80">{item.qty}</td>
                          <td className="p-2 text-right font-mono text-foreground/80">{formatFCFA(item.price)}</td>
                          <td className="p-2 text-right font-mono font-bold text-gold">{formatFCFA(item.price * item.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Amount Box */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 text-center">
                <div className="text-xs uppercase font-bold text-foreground/40">Montant Total Réglé</div>
                <div className="text-xl font-black text-gold mt-1">{formatFCFA(selectedInvoice.totalAmount)}</div>
              </div>
            </div>

            {/* Modal Bottom Action: Re-print */}
            <div className="border-t border-white/10 pt-4 shrink-0">
              <button
                type="button"
                onClick={() => triggerPrint(selectedInvoice)}
                className="w-full rounded-2xl bg-gold py-3 px-4 text-xs font-extrabold text-black hover:bg-gold/85 transition shadow-lg shadow-gold/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Réimprimer ce Ticket de Caisse</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
