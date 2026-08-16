import React, { useState, useEffect } from 'react';
import { Search, User, Phone, Printer, Plus, Clock, Trash2, CheckCircle, RotateCcw, ArrowRight } from 'lucide-react';
import Field, { inputCls } from './Field';
import { formatFCFA, triggerPrint, triggerProformaPrint, getPaymentMethodLabel, cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function ReservationsView({ categories = [], currentUser, serverOnline }) {
  // Existing reservations list state
  const [reservations, setReservations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Active Reservation / Form State
  const [activeResId, setActiveResId] = useState(null); // null = New, string = Editing
  const [activeResNo, setActiveResNo] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [resItems, setResItems] = useState([]); // Cart array
  const [newAdvanceAmount, setNewAdvanceAmount] = useState('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState('');
  const [existingPayments, setExistingPayments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category search state
  const [categorySearch, setCategorySearch] = useState('');
  const [expandedCatIds, setExpandedCatIds] = useState([]);

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

  const toggleExpandCategory = (catId) => {
    setExpandedCatIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleAddItemToResCart = (designationName) => {
    setResItems(prev => [
      ...prev,
      {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        categoryName: designationName,
        price: '',
        qty: 1
      }
    ]);
  };

  const handleUpdateItemField = (id, field, rawValue) => {
    setResItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'categoryName') return { ...item, categoryName: rawValue };
      if (rawValue === '' || rawValue === undefined || rawValue === null) {
        return { ...item, [field]: '' };
      }
      const cleanStr = String(rawValue).replace(/[^0-9.]/g, '');
      if (cleanStr === '') return { ...item, [field]: '' };
      const value = field === 'qty'
        ? Math.max(0, parseInt(cleanStr, 10) || 0)
        : Math.max(0, parseFloat(cleanStr) || 0);
      return { ...item, [field]: value };
    }));
  };

  const handleRemoveItem = (id) => setResItems(prev => prev.filter(item => item.id !== id));

  const getResTotal = () => resItems.reduce((sum, i) => sum + ((parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0)), 0);
  const getAlreadyPaid = () => existingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const getRemainingBalance = () => Math.max(0, getResTotal() - getAlreadyPaid());

  const [selectedResObject, setSelectedResObject] = useState(null);

  // Click on a reservation in the list -> Populate form on the SAME screen!
  const handleSelectReservation = (res) => {
    setSelectedResObject(res);
    setActiveResId(res.id);
    setActiveResNo(res.reservationNo);
    setClientName(res.clientName || '');
    setClientPhone(res.clientPhone || '');
    setExistingPayments(res.payments || []);

    const loadedItems = (res.items || []).map(it => ({
      id: it.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)),
      categoryName: it.categoryName,
      price: it.price,
      qty: it.qty || 1
    }));
    setResItems(loadedItems);

    const paid = (res.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, res.totalAmount - paid);
    setNewAdvanceAmount(remaining > 0 ? remaining.toString() : '');
    setAdvancePaymentMethod('CASH');
  };

  // Reset form to start a new reservation
  const handleStartNewReservation = () => {
    setSelectedResObject(null);
    setActiveResId(null);
    setActiveResNo(null);
    setClientName('');
    setClientPhone('');
    setResItems([]);
    setExistingPayments([]);
    setNewAdvanceAmount('');
    setAdvancePaymentMethod('');
  };

  // Save / Submit Reservation (Create or Update + optional new installment)
  const handleSaveReservation = async () => {
    if (!clientName.trim() && !clientPhone.trim()) {
      return alert('Veuillez entrer au moins le nom du client OU son numéro de téléphone.');
    }
    if (resItems.length === 0) {
      return alert('Le panier de réservation est vide. Veuillez ajouter au moins un article.');
    }
    const invalidLine = resItems.find(item => isNaN(item.price) || item.price <= 0 || isNaN(item.qty) || item.qty < 1);
    if (invalidLine) {
      return alert(`Vérifiez la ligne "${invalidLine.categoryName}" (prix et quantité doivent être valides)`);
    }

    const total = getResTotal();
    const advanceNum = Number(newAdvanceAmount) || 0;

    if (advanceNum > 0 && advanceNum > getRemainingBalance() + 0.01) {
      return alert(`L'avance saisie (${advanceNum} FCFA) dépasse le solde restant (${getRemainingBalance()} FCFA)`);
    }

    setIsSubmitting(true);

    try {
      let response;
      if (activeResId) {
        // Update existing reservation
        response = await fetch(`${API_BASE}/reservations/${activeResId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            totalAmount: total,
            items: resItems.map(i => ({ categoryName: i.categoryName, price: Number(i.price) || 0, qty: Number(i.qty) || 1 })),
            createdById: currentUser.id,
            newPayment: advanceNum > 0 ? {
              amount: advanceNum,
              paymentMethod: advancePaymentMethod || 'CASH'
            } : null
          })
        });
      } else {
        // Create new reservation
        response = await fetch(`${API_BASE}/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            totalAmount: total,
            items: resItems.map(i => ({ categoryName: i.categoryName, price: Number(i.price) || 0, qty: Number(i.qty) || 1 })),
            createdById: currentUser.id,
            initialPayment: advanceNum > 0 ? {
              amount: advanceNum,
              paymentMethod: advancePaymentMethod || 'CASH'
            } : null
          })
        });
      }

      const resData = await response.json();
      if (!response.ok) {
        alert(resData.error || 'Erreur lors de l\'enregistrement de la réservation');
        setIsSubmitting(false);
        return;
      }

      // Trigger Proforma Print automatically
      triggerProformaPrint(resData);
      window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));

      // Refresh list & load updated state
      await fetchReservations();
      handleSelectReservation(resData);
      setNewAdvanceAmount('');
      setIsSubmitting(false);
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
      setIsSubmitting(false);
    }
  };

  const handlePrintFinalInvoice = async () => {
    if (!activeResId) return;
    const total = getResTotal();
    const paid = getAlreadyPaid();
    if (paid < total - 0.01) {
      return alert('La facture définitive ne peut être imprimée que lorsque la réservation est payée à 100%.');
    }

    try {
      const response = await fetch(`${API_BASE}/reservations/${activeResId}/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createdById: currentUser.id })
      });
      if (response.ok) {
        const invoiceData = await response.json();
        triggerPrint(invoiceData);
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

  const filteredCategories = categories.filter(c => {
    const q = categorySearch.toLowerCase();
    if (!q) return true;
    const catMatch = c.name.toLowerCase().includes(q);
    const subMatch = c.subCategories?.some(s => s.name.toLowerCase().includes(q));
    return catMatch || subMatch;
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white/[0.02]">
      <div className="flex flex-1 gap-3 overflow-hidden min-h-0">
        
        {/* COLUMN 1: Category & Article Selector (Left) */}
        <div className="flex w-64 flex-col overflow-hidden p-3 bg-black/20 rounded-2xl border border-white/5 shrink-0">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              placeholder="Rechercher catégorie..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className={cx(inputCls, 'pl-9 bg-zinc-900 border-white/10 text-foreground text-xs')}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              {filteredCategories.length === 0 ? (
                <div className="text-xs text-foreground/40 italic p-3 text-center">Aucune catégorie trouvée.</div>
              ) : (
                filteredCategories.map(cat => {
                  const isExpanded = expandedCatIds.includes(cat.id) || Boolean(categorySearch);
                  const hasSubs = cat.subCategories && cat.subCategories.length > 0;

                  return (
                    <div key={cat.id} className="rounded-xl border border-white/5 bg-white/[0.015] overflow-hidden">
                      <div className="flex items-center justify-between p-2 hover:bg-white/[0.04] transition">
                        <button
                          type="button"
                          onClick={() => handleAddItemToResCart(cat.name)}
                          disabled={!serverOnline}
                          className="flex-1 text-left text-xs font-semibold text-foreground hover:text-gold transition truncate cursor-pointer"
                          title={`Ajouter ${cat.name} à la réservation`}
                        >
                          {cat.name}
                        </button>
                        {hasSubs && (
                          <button
                            type="button"
                            onClick={() => toggleExpandCategory(cat.id)}
                            className="text-[10px] text-gold/90 bg-gold/10 hover:bg-gold/20 px-2 py-0.5 rounded-md font-bold transition ml-1 cursor-pointer"
                          >
                            {isExpanded ? '▲' : `▼ ${cat.subCategories.length}`}
                          </button>
                        )}
                      </div>

                      {hasSubs && isExpanded && (
                        <div className="bg-black/30 p-1.5 space-y-1 border-t border-white/5">
                          {cat.subCategories.map(sub => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleAddItemToResCart(`${cat.name} - ${sub.name}`)}
                              disabled={!serverOnline}
                              className="w-full text-left text-[11px] font-medium text-foreground/80 hover:text-gold hover:bg-white/5 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="text-gold font-bold">↳</span>
                              <span>{sub.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: Main Reservation Form & Cart (Center) */}
        <div className="flex flex-1 flex-col overflow-hidden p-3 bg-black/20 rounded-2xl border border-white/5 min-w-0">
          
          {/* Header indicator bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className={cx(
                'px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5',
                activeResId ? 'bg-gold/15 text-gold border border-gold/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              )}>
                <Clock className="h-3.5 w-3.5" />
                {activeResId ? `Édition Réservation : ${activeResNo}` : 'Nouvelle Réservation'}
              </span>
              {activeResId && existingPayments.length > 0 && (
                <span className="text-xs text-foreground/50 font-semibold">
                  ({existingPayments.length}/3 tranches effectuées)
                </span>
              )}
            </div>

            {activeResId && (
              <button
                type="button"
                onClick={handleStartNewReservation}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground/80 transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-gold" />
                <span>Nouvelle Réservation</span>
              </button>
            )}
          </div>

          {/* Audit trail indicator */}
          {activeResId && selectedResObject && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/20 bg-gold/5 p-2.5 text-[11px] text-foreground/80">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground/50">Créée par :</span>
                <strong className="text-gold font-bold">{selectedResObject.createdBy?.name || 'N/A'}</strong>
                <span className="text-foreground/40 text-[10px]">
                  ({selectedResObject.createdAt ? new Date(selectedResObject.createdAt).toLocaleString('fr-FR') : ''})
                </span>
              </div>
              {selectedResObject.updatedBy?.name && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground/50">Dernière modif :</span>
                  <strong className="text-gold font-bold">{selectedResObject.updatedBy.name}</strong>
                  <span className="text-foreground/40 text-[10px]">
                    ({new Date(selectedResObject.updatedAt).toLocaleString('fr-FR')})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Client Info Inputs (At least one required) */}
          <div className="grid sm:grid-cols-2 gap-3 mb-3 shrink-0 bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <Field label="Nom du Client (Obligatoire si pas de téléphone)">
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

            <Field label="Numéro de Téléphone (Obligatoire si pas de nom)">
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

          {/* Table of Reserved Items */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden mb-3">
            <div className="min-h-0 flex-1 overflow-y-auto px-1">
              <table className="min-w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Désignation</th>
                    <th className="w-20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Qté</th>
                    <th className="w-28 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Prix / un.</th>
                    <th className="w-28 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Total</th>
                    <th className="w-16 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {resItems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-10 text-xs text-foreground/40 italic">
                        Aucun article dans la réservation. Cliquez sur une catégorie à gauche pour ajouter un article.
                      </td>
                    </tr>
                  ) : (
                    resItems.map(item => (
                      <tr key={item.id} className="border-b border-white/5 odd:bg-white/[0.01] even:bg-white/[0.02]">
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={item.categoryName}
                            onChange={(e) => handleUpdateItemField(item.id, 'categoryName', e.target.value)}
                            className="w-full bg-transparent px-2 py-1 text-xs text-foreground outline-none border border-transparent focus:border-gold/30 rounded"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleUpdateItemField(item.id, 'qty', e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-foreground outline-none focus:border-gold text-center"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={(e) => handleUpdateItemField(item.id, 'price', e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-foreground outline-none focus:border-gold font-mono"
                          />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs font-semibold text-gold">
                          {formatFCFA((Number(item.price) || 0) * (Number(item.qty) || 0))}
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-xs font-semibold text-foreground/50 hover:text-red-400 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial summary & New Advance Section */}
          <div className="border-t border-white/10 pt-3 space-y-3 shrink-0">
            
            {/* Amounts Row */}
            <div className="grid grid-cols-3 gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/5 text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-foreground/40">Total Réservation</div>
                <div className="text-sm font-black text-gold mt-0.5">{formatFCFA(getResTotal())}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-foreground/40">Déjà Payé</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">{formatFCFA(getAlreadyPaid())}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-foreground/40">Solde Restant</div>
                <div className={cx('text-sm font-black mt-0.5', getRemainingBalance() > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                  {formatFCFA(getRemainingBalance())}
                </div>
              </div>
            </div>

            {/* Advance payment input section */}
            <div className="grid sm:grid-cols-2 gap-3 bg-zinc-900/60 p-3 rounded-xl border border-gold/30">
              <Field label={`Avance / Nouvel Acompte (Tranche #${existingPayments.length + 1})`}>
                <input
                  type="number"
                  min="0"
                  max={getRemainingBalance()}
                  placeholder="Ex: 5000"
                  value={newAdvanceAmount}
                  onChange={(e) => setNewAdvanceAmount(e.target.value)}
                  className={cx(inputCls, 'bg-zinc-900 border-gold/50 text-foreground font-mono font-bold text-sm')}
                />
              </Field>

              <div className="grid gap-1">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-foreground/50">Mode de paiement acompte</div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAdvancePaymentMethod(prev => prev === 'CASH' ? '' : 'CASH')}
                    className={cx('flex-1 rounded-xl py-1.5 text-xs font-bold transition border cursor-pointer', advancePaymentMethod === 'CASH' ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                  >
                    Espèces
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancePaymentMethod(prev => prev === 'ONLINE' ? '' : 'ONLINE')}
                    className={cx('flex-1 rounded-xl py-1.5 text-xs font-bold transition border cursor-pointer', advancePaymentMethod === 'ONLINE' ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancePaymentMethod(prev => prev === 'ORANGE_MONEY' ? '' : 'ORANGE_MONEY')}
                    className={cx('flex-1 rounded-xl py-1.5 text-xs font-bold transition border cursor-pointer', advancePaymentMethod === 'ORANGE_MONEY' ? 'bg-orange-500 text-black border-orange-500' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                  >
                    Orange
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveReservation}
                disabled={isSubmitting || resItems.length === 0 || !serverOnline}
                className="flex-1 rounded-2xl bg-gold py-3 px-4 text-xs font-extrabold text-black hover:bg-gold/85 disabled:opacity-40 transition shadow-lg shadow-gold/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>{isSubmitting ? 'Enregistrement...' : activeResId ? 'Mettre à jour & Proforma' : 'Créer & Imprimer Proforma'}</span>
              </button>

              {activeResId && getRemainingBalance() <= 0 && (
                <button
                  type="button"
                  onClick={handlePrintFinalInvoice}
                  className="rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 py-3 px-5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span>Facture Définitive</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3: Reservation History List (Right side of same screen) */}
        <div className="flex w-80 flex-col overflow-hidden p-3 bg-black/20 rounded-2xl border border-white/5 shrink-0">
          
          <div className="space-y-2 mb-3 shrink-0">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground/60 flex items-center justify-between">
              <span>Réservations</span>
              <span className="text-[10px] text-gold font-mono">{reservations.length}</span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
              <input
                type="text"
                placeholder="Rechercher nom, n° ou tel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cx(inputCls, 'pl-8 bg-zinc-900 border-white/10 text-foreground text-xs')}
              />
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setStatusFilter('')}
                className={cx('flex-1 rounded-lg py-1 text-[10px] font-bold transition', !statusFilter ? 'bg-white/15 text-gold' : 'text-foreground/50 hover:bg-white/5')}
              >
                Toutes
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={cx('flex-1 rounded-lg py-1 text-[10px] font-bold transition', statusFilter === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'text-foreground/50 hover:bg-white/5')}
              >
                En cours
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={cx('flex-1 rounded-lg py-1 text-[10px] font-bold transition', statusFilter === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'text-foreground/50 hover:bg-white/5')}
              >
                100%
              </button>
            </div>
          </div>

          {/* Cards List */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
            {loadingList ? (
              <div className="text-xs text-foreground/40 italic py-6 text-center">Chargement...</div>
            ) : reservations.length === 0 ? (
              <div className="text-xs text-foreground/40 italic py-8 text-center bg-white/[0.01] rounded-xl border border-white/5 p-3">
                Aucune réservation trouvée.
              </div>
            ) : (
              reservations.map((res) => {
                const isSelected = activeResId === res.id;
                const isCompleted = res.status === 'COMPLETED';
                const paymentCount = res.payments?.length || 0;

                return (
                  <div
                    key={res.id}
                    onClick={() => handleSelectReservation(res)}
                    className={cx(
                      'rounded-xl border p-3 transition cursor-pointer space-y-2',
                      isSelected
                        ? 'border-gold bg-gold/10 shadow-lg shadow-gold/10'
                        : 'border-white/5 bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="text-[11px] font-mono font-bold text-gold">{res.reservationNo}</div>
                        <div className="text-xs font-bold text-foreground truncate max-w-[150px]">
                          {res.clientName || 'Client anonyme'}
                        </div>
                        {res.clientPhone && (
                          <div className="text-[10px] text-foreground/50 font-mono">
                            {res.clientPhone}
                          </div>
                        )}
                      </div>

                      <span className={cx(
                        'px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shrink-0',
                        isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      )}>
                        {isCompleted ? '100%' : `${paymentCount}/3 Tr.`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] border-t border-white/5 pt-1.5">
                      <span className="text-foreground/50">Total: <strong className="text-foreground">{formatFCFA(res.totalAmount)}</strong></span>
                      <span className="text-foreground/50">Reste: <strong className={res.remainingBalance > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{formatFCFA(res.remainingBalance)}</strong></span>
                    </div>

                    <div className="flex justify-end pt-0.5">
                      <span className="text-[10px] text-gold font-semibold flex items-center gap-0.5 group-hover:underline">
                        Charger dans le panier <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
