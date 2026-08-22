import React, { useState, useEffect } from 'react';
import { Search, User, Phone, Printer, CheckCircle, X, Eye, Clock, ArrowRight } from 'lucide-react';
import Field, { inputCls } from './Field';
import { formatFCFA, triggerPrint, triggerProformaPrint, triggerFinalReservationPrint, getPaymentMethodLabel, cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function ReservationsView({ categories = [], currentUser, serverOnline }) {
  // Existing reservations list state
  const [reservations, setReservations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Side Drawer state for selected reservation
  const [selectedRes, setSelectedRes] = useState(null); // null = Drawer closed
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [newAdvanceAmount, setNewAdvanceAmount] = useState('');
  const [selectedMethods, setSelectedMethods] = useState(['CASH']);
  const [methodAmounts, setMethodAmounts] = useState({ CASH: '', ONLINE: '', ORANGE_MONEY: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getFinalPaymentMethod = () => {
    if (selectedMethods.length === 0) return 'CASH';
    if (selectedMethods.length === 1) return selectedMethods[0];
    const parts = selectedMethods.map(m => {
      const v = parseFloat(methodAmounts[m]) || 0;
      return `${m}=${v}`;
    });
    return `MULTIPLE:${parts.join(';')}`;
  };

  const validateMultiplePayments = (targetTotal) => {
    if (selectedMethods.length <= 1) return true;
    const sum = selectedMethods.reduce((acc, m) => acc + (parseFloat(methodAmounts[m]) || 0), 0);
    if (Math.abs(sum - targetTotal) > 0.01) {
      alert(`Le montant total réparti (${formatFCFA(sum)}) ne correspond pas au montant requis (${formatFCFA(targetTotal)}).`);
      return false;
    }
    return true;
  };

  useEffect(() => {
    fetchReservations();
  }, [searchQuery, statusFilter]);

  const fetchReservations = async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      const res = await fetch(`${API_BASE}/reservations?${params.toString()}`);
      if (res.ok) {
        setReservations(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  const handleOpenDrawer = (resObj) => {
    setSelectedRes(resObj);
    setClientName(resObj.clientName || '');
    setClientPhone(resObj.clientPhone || '');
    setNewAdvanceAmount('');
    setSelectedMethods(['CASH']);
    setMethodAmounts({ CASH: '', ONLINE: '', ORANGE_MONEY: '' });
  };

  const handleCloseDrawer = () => {
    setSelectedRes(null);
    setClientName('');
    setClientPhone('');
    setNewAdvanceAmount('');
  };

  const getAlreadyPaid = (resObj) => {
    if (!resObj || !resObj.payments) return 0;
    return resObj.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  };

  const getRemainingBalance = (resObj) => {
    if (!resObj) return 0;
    const total = parseFloat(resObj.totalAmount) || 0;
    return Math.max(0, total - getAlreadyPaid(resObj));
  };

  // Save / Submit updated reservation details or new installment
  const handleSaveDrawerChanges = async () => {
    if (!selectedRes) return;

    if (!clientName.trim() && !clientPhone.trim()) {
      return alert('Veuillez renseigner au moins le nom du client ou son numéro de téléphone.');
    }

    const advanceNum = parseFloat(newAdvanceAmount) || 0;
    const remaining = getRemainingBalance(selectedRes);
    const existingPaymentsCount = selectedRes.payments?.length || 0;

    // Enforce that the 3rd payment MUST complete the remaining balance since max 3 payments are allowed
    if (existingPaymentsCount === 2 && advanceNum > 0) {
      if (Math.abs(advanceNum - remaining) > 0.01) {
        return alert(`Il s'agit du 3ème et dernier versement possible pour cette réservation. Le montant saisi doit être exactement égal au solde restant (${formatFCFA(remaining)}).`);
      }
    }

    if (advanceNum > 0 && advanceNum > remaining + 0.01) {
      return alert(`L'avance saisie (${formatFCFA(advanceNum)}) dépasse le solde restant (${formatFCFA(remaining)})`);
    }

    if (!validateMultiplePayments(advanceNum)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/reservations/${selectedRes.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          totalAmount: selectedRes.totalAmount,
          items: selectedRes.items || [],
          createdById: currentUser.id,
          newPayment: advanceNum > 0 ? {
            amount: advanceNum,
            paymentMethod: getFinalPaymentMethod()
          } : null
        })
      });

      const updatedResData = await response.json();
      if (!response.ok) {
        alert(updatedResData.error || 'Erreur lors de la mise à jour');
        setIsSubmitting(false);
        return;
      }

      // Calculate new remaining balance after this payment
      const newTotalPaid = (updatedResData.payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const newRemaining = Math.max(0, (parseFloat(updatedResData.totalAmount) || 0) - newTotalPaid);
      const isNowFullyPaid = newRemaining <= 0.01;

      if (isNowFullyPaid && advanceNum > 0) {
        // ✅ Payment is complete — auto-create & print the definitive invoice
        try {
          const invResponse = await fetch(`${API_BASE}/reservations/${selectedRes.id}/create-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ createdById: currentUser.id })
          });
          if (invResponse.ok) {
            const invoiceData = await invResponse.json();
            triggerFinalReservationPrint(invoiceData); // Print definitive invoice with history
          } else {
            // Fallback: print proforma with completion message
            triggerProformaPrint(updatedResData);
          }
        } catch {
          triggerProformaPrint(updatedResData);
        }
      } else if (advanceNum > 0) {
        // 💰 Partial payment — print advance receipt
        triggerProformaPrint(updatedResData);
      }

      window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));

      // Refresh list & update drawer content
      await fetchReservations();
      setSelectedRes(updatedResData);
      setNewAdvanceAmount('');
      setSelectedMethods(['CASH']);
      setMethodAmounts({ CASH: '', ONLINE: '', ORANGE_MONEY: '' });
      setIsSubmitting(false);
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
      setIsSubmitting(false);
    }
  };

  const handlePrintFinalInvoice = async () => {
    if (!selectedRes) return;
    const remaining = getRemainingBalance(selectedRes);
    if (remaining > 0.01) {
      return alert('La facture définitive ne peut être imprimée que lorsque la réservation est totalement réglée (Solde = 0 FCFA).');
    }

    try {
      const response = await fetch(`${API_BASE}/reservations/${selectedRes.id}/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createdById: currentUser.id })
      });
      if (response.ok) {
        const invoiceData = await response.json();
        triggerFinalReservationPrint(invoiceData);
        window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Erreur lors de la création de la facture');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
    }
  };

  // Determine what the main action button will do based on current state
  const newAmountNum = parseFloat(newAdvanceAmount) || 0;
  const currentRemaining = getRemainingBalance(selectedRes);
  const willFinishPayment = selectedRes && newAmountNum > 0 && (currentRemaining - newAmountNum) <= 0.01;



  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white/[0.01] p-2">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gold" />
          <h2 className="text-sm font-bold text-foreground">Gestion des Réservations & Acomptes</h2>
          <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-extrabold text-gold">
            {reservations.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Pills */}
          <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setStatusFilter('')}
              className={cx('rounded-lg px-3 py-1 font-bold transition cursor-pointer', !statusFilter ? 'bg-gold text-black' : 'text-foreground/60 hover:text-white')}
            >
              Toutes
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={cx('rounded-lg px-3 py-1 font-bold transition cursor-pointer', statusFilter === 'PENDING' ? 'bg-amber-500 text-black' : 'text-foreground/60 hover:text-white')}
            >
              En cours
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={cx('rounded-lg px-3 py-1 font-bold transition cursor-pointer', statusFilter === 'COMPLETED' ? 'bg-emerald-500 text-black' : 'text-foreground/60 hover:text-white')}
            >
              Solde 100%
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
            <input
              type="text"
              placeholder="Rechercher nom, n° ou tel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cx(inputCls, 'pl-8 bg-zinc-900 border-white/10 text-foreground text-xs')}
            />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: Full-width Table of Existing Reservations */}
      <div className="min-h-0 flex-1 overflow-hidden bg-black/20 rounded-2xl border border-white/5 flex flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10 text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">
              <tr>
                <th className="px-4 py-3">N° Réservation</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Déjà Payé</th>
                <th className="px-4 py-3 text-right">Solde Restant</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingList ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-foreground/40 italic">Chargement des réservations...</td>
                </tr>
              ) : reservations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-16 text-foreground/40 italic">
                    Aucune réservation trouvée.
                  </td>
                </tr>
              ) : (
                reservations.map((res) => {
                  const isCompleted = res.status === 'COMPLETED';
                  const alreadyPaid = getAlreadyPaid(res);
                  const remaining = getRemainingBalance(res);
                  const paymentCount = res.payments?.length || 0;

                  return (
                    <tr
                      key={res.id}
                      onClick={() => handleOpenDrawer(res)}
                      className="hover:bg-white/[0.03] transition cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-gold">{res.reservationNo}</td>
                      <td className="px-4 py-3 text-foreground/60 text-[11px]">
                        {new Date(res.createdAt).toLocaleDateString('fr-FR')} {new Date(res.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div>{res.clientName || 'Client anonyme'}</div>
                        {res.clientPhone && <div className="text-[10px] text-foreground/40 font-mono">{res.clientPhone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cx(
                          'px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider',
                          isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        )}>
                          {isCompleted ? 'PAYÉE À 100%' : `${paymentCount}/3 Tranches`}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-right text-foreground">{formatFCFA(res.totalAmount)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-right text-emerald-400">{formatFCFA(alreadyPaid)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-right">
                        <span className={remaining > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          {formatFCFA(remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(res)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-foreground/80 text-xs font-semibold transition cursor-pointer border border-white/10"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Détails & Acompte</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerProformaPrint(res)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gold/15 hover:bg-gold/30 text-gold text-xs font-bold transition cursor-pointer border border-gold/30 shadow-sm"
                            title="Réimprimer le reçu (Dernière tranche / action)"
                          >
                            <Printer className="h-3.5 w-3.5" />
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
      </div>

      {/* SIDE WINDOW DRAWER (Opens when a reservation is selected) */}
      {selectedRes && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
          onClick={handleCloseDrawer}
        >
          <div
            className="w-full max-w-xl bg-zinc-900 border-l border-white/10 h-full flex flex-col shadow-2xl p-5 overflow-hidden animate-in slide-in-from-right duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gold" />
                <div>
                  <h3 className="text-sm font-black text-gold font-mono">{selectedRes.reservationNo}</h3>
                  <div className="text-xs text-foreground/50">Détails et Gestion des versements</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={cx(
                  'px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider',
                  selectedRes.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                )}>
                  {selectedRes.status === 'COMPLETED' ? 'SOLDE 100%' : 'EN COURS'}
                </span>
                <button
                  onClick={handleCloseDrawer}
                  className="rounded-xl p-1 text-foreground/50 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              
              {/* Audit Info */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.02] p-2.5 text-[11px] border border-white/5">
                <div>
                  <span className="text-foreground/50">Créée par : </span>
                  <strong className="text-gold font-bold">{selectedRes.createdBy?.name || 'Caissière'}</strong>
                </div>
                <div>
                  <span className="text-foreground/50">Date : </span>
                  <span className="text-foreground/80">{new Date(selectedRes.createdAt).toLocaleString('fr-FR')}</span>
                </div>
              </div>

              {/* Client Info (Editable) */}
              <div className="space-y-2 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/50">Informations Client</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Nom du Client">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                      <input
                        type="text"
                        placeholder="Nom du client"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className={cx(inputCls, 'pl-8 bg-zinc-900 border-white/10 text-foreground text-xs font-semibold')}
                      />
                    </div>
                  </Field>

                  <Field label="Numéro de Téléphone">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                      <input
                        type="text"
                        placeholder="Ex: 0700000000"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className={cx(inputCls, 'pl-8 bg-zinc-900 border-white/10 text-foreground text-xs font-semibold')}
                      />
                    </div>
                  </Field>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/50">Articles de la commande</div>
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
                      {(selectedRes.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-foreground font-medium">{item.categoryName}</td>
                          <td className="p-2 text-center text-foreground/80">{item.qty || 1}</td>
                          <td className="p-2 text-right font-mono text-foreground/80">{formatFCFA(item.price)}</td>
                          <td className="p-2 text-right font-mono font-bold text-gold">{formatFCFA((item.price || 0) * (item.qty || 1))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-2xl border border-white/10 text-center">
                <div>
                  <div className="text-[10px] uppercase font-bold text-foreground/40">Total Commande</div>
                  <div className="text-sm font-black text-gold mt-0.5">{formatFCFA(selectedRes.totalAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-foreground/40">Déjà Payé</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">{formatFCFA(getAlreadyPaid(selectedRes))}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-foreground/40">Solde Restant</div>
                  <div className={cx('text-sm font-black mt-0.5', getRemainingBalance(selectedRes) > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                    {formatFCFA(getRemainingBalance(selectedRes))}
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="space-y-2 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  Historique des Versements ({selectedRes.payments?.length || 0}/3)
                </div>
                <div className="space-y-1.5">
                  {(!selectedRes.payments || selectedRes.payments.length === 0) ? (
                    <div className="text-xs italic text-foreground/40 p-2">Aucun versement effectué pour l'instant.</div>
                  ) : (
                    selectedRes.payments.map((p, idx) => (
                      <div key={p.id || idx} className="flex items-center justify-between bg-zinc-900 p-2.5 rounded-xl border border-white/5 text-xs">
                        <div>
                          <div className="font-bold text-foreground">Tranche #{p.installmentNumber || idx + 1} ({getPaymentMethodLabel(p.paymentMethod)})</div>
                          <div className="text-[10px] text-foreground/40">
                            {p.createdAt ? new Date(p.createdAt).toLocaleString('fr-FR') : ''}
                          </div>
                        </div>
                        <div className="font-mono font-bold text-emerald-400 text-sm">
                          +{formatFCFA(p.amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add New Advance Input Section (If remaining balance > 0) */}
              {getRemainingBalance(selectedRes) > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Saisir un Nouvel Acompte (Tranche #{ (selectedRes.payments?.length || 0) + 1 })
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Montant de l'acompte (FCFA)">
                      <input
                        type="number"
                        min="1"
                        max={getRemainingBalance(selectedRes)}
                        placeholder="Ex: 5000"
                        value={newAdvanceAmount}
                        onChange={(e) => setNewAdvanceAmount(e.target.value)}
                        className={cx(inputCls, 'bg-zinc-900 border-amber-500/50 text-gold font-mono font-bold text-sm')}
                      />
                    </Field>

                    <div className="grid gap-1.5">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-foreground/50">Mode de paiement</div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedMethods(prev => prev.includes('CASH') ? prev.filter(m => m !== 'CASH') : [...prev, 'CASH'])}
                          className={cx('flex-1 rounded-xl py-1.5 text-xs font-bold transition border cursor-pointer', selectedMethods.includes('CASH') ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                        >
                          Espèces
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedMethods(prev => prev.includes('ONLINE') ? prev.filter(m => m !== 'ONLINE') : [...prev, 'ONLINE'])}
                          className={cx('flex-1 rounded-xl py-1.5 text-xs font-bold transition border cursor-pointer', selectedMethods.includes('ONLINE') ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                        >
                          Mobile
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedMethods(prev => prev.includes('ORANGE_MONEY') ? prev.filter(m => m !== 'ORANGE_MONEY') : [...prev, 'ORANGE_MONEY'])}
                          className={cx('flex-1 rounded-xl py-1.5 text-xs font-bold transition border cursor-pointer', selectedMethods.includes('ORANGE_MONEY') ? 'bg-orange-500 text-black border-orange-500' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                        >
                          Orange
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Split amounts input for Reservations */}
                  {selectedMethods.length > 1 && (
                    <div className="p-3 bg-zinc-900/60 rounded-xl border border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] uppercase font-bold text-amber-400">Répartition du versement</div>
                        <button
                          type="button"
                          onClick={() => {
                            const target = parseFloat(newAdvanceAmount) || 0;
                            const lastMethod = selectedMethods[selectedMethods.length - 1];
                            const currentSum = selectedMethods.reduce((sum, m) => sum + (m === lastMethod ? 0 : (parseFloat(methodAmounts[m]) || 0)), 0);
                            const diff = Math.max(0, target - currentSum);
                            setMethodAmounts(prev => ({ ...prev, [lastMethod]: diff }));
                          }}
                          className="text-[10px] bg-gold/15 text-gold border border-gold/30 hover:bg-gold/30 px-2 py-0.5 rounded transition cursor-pointer font-bold"
                        >
                          Auto-équilibrer
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className={cx('grid gap-2', selectedMethods.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
                          {selectedMethods.includes('CASH') && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-foreground/50 font-bold">Espèces :</span>
                              <input
                                type="number"
                                placeholder="Montant"
                                value={methodAmounts.CASH}
                                onChange={(e) => setMethodAmounts(prev => ({ ...prev, CASH: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5 text-xs text-left font-mono text-foreground font-bold"
                              />
                            </div>
                          )}
                          {selectedMethods.includes('ONLINE') && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-foreground/50 font-bold">Mobile Money :</span>
                              <input
                                type="number"
                                placeholder="Montant"
                                value={methodAmounts.ONLINE}
                                onChange={(e) => setMethodAmounts(prev => ({ ...prev, ONLINE: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5 text-xs text-left font-mono text-foreground font-bold"
                              />
                            </div>
                          )}
                          {selectedMethods.includes('ORANGE_MONEY') && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-foreground/50 font-bold">Orange Money :</span>
                              <input
                                type="number"
                                placeholder="Montant"
                                value={methodAmounts.ORANGE_MONEY}
                                onChange={(e) => setMethodAmounts(prev => ({ ...prev, ORANGE_MONEY: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5 text-xs text-left font-mono text-foreground font-bold"
                              />
                            </div>
                          )}
                        </div>
                        <div className="border-t border-white/5 pt-2 flex justify-between text-[11px] font-bold">
                          <span>Saisi: {formatFCFA(selectedMethods.reduce((sum, key) => sum + (parseFloat(methodAmounts[key]) || 0), 0))}</span>
                          <span className="text-gold">Requis: {formatFCFA(parseFloat(newAdvanceAmount) || 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Drawer Bottom Actions */}
            <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-2 shrink-0">

              {/* Reprint last receipt */}
              <button
                type="button"
                onClick={() => triggerProformaPrint(selectedRes)}
                className="rounded-2xl bg-white/5 hover:bg-white/10 text-gold border border-gold/30 py-3 px-4 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Réimprimer le dernier reçu de cette réservation"
              >
                <Printer className="h-4 w-4 text-gold" />
                <span>Réimprimer Reçu</span>
              </button>

              {/* Main action — dynamically shows what will happen */}
              {getRemainingBalance(selectedRes) > 0.01 && (
                <button
                  type="button"
                  onClick={handleSaveDrawerChanges}
                  disabled={isSubmitting || !serverOnline}
                  className={cx(
                    'flex-1 rounded-2xl py-3 px-4 text-xs font-extrabold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40',
                    willFinishPayment
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                      : 'bg-gold hover:bg-gold/85 text-black shadow-gold/10'
                  )}
                >
                  {willFinishPayment
                    ? <CheckCircle className="h-4 w-4" />
                    : <Printer className="h-4 w-4" />
                  }
                  <span>
                    {isSubmitting
                      ? 'Enregistrement...'
                      : willFinishPayment
                        ? '✅ Solder & Imprimer Facture Définitive'
                        : '🧾 Enregistrer Acompte & Imprimer Reçu'
                    }
                  </span>
                </button>
              )}

              {/* Already fully paid — reprint definitive invoice */}
              {getRemainingBalance(selectedRes) <= 0.01 && (
                <button
                  type="button"
                  onClick={handlePrintFinalInvoice}
                  className="flex-1 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 py-3 px-4 text-xs font-bold transition flex items-center gap-1.5 justify-center cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span>Réimprimer Facture Définitive</span>
                </button>
              )}

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
