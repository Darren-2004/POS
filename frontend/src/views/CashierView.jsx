import React, { useState } from 'react';
import { Search, Clock, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Field, { inputCls } from '../components/Field';
import ReservationsView from '../components/ReservationsView';
import CashierInvoicesView from '../components/CashierInvoicesView';
import CashierStatsView from '../components/CashierStatsView';
import { formatFCFA, triggerPrint, triggerProformaPrint, cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function CashierView({ categories, currentUser, serverOnline, activeTab, setActiveTab }) {
  // activeTab/setActiveTab are lifted to App so Header can render the tabs
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedMethods, setSelectedMethods] = useState(['CASH']);
  const [methodAmounts, setMethodAmounts] = useState({ CASH: '', ONLINE: '', ORANGE_MONEY: '' });
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

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

  // Reservation Mode state inside CashierView
  const [showReservationMode, setShowReservationMode] = useState(false);
  const [reservationAdvanceInput, setReservationAdvanceInput] = useState('');

  const [expandedCatIds, setExpandedCatIds] = useState([]);

  const toggleExpandCategory = (catId) => {
    setExpandedCatIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleAddItemToCart = (designationName) => {
    setCart(prev => [
      ...prev,
      {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        categoryName: designationName,
        price: '',
        qty: 1,
      }
    ]);
  };

  const handleUpdateCartField = (id, field, rawValue) => {
    setCart(prev => prev.map(item => {
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

  const handleRemoveFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const getCartTotal = () => cart.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 0)), 0);

  const getCartItemsForServer = () =>
    cart.flatMap(item =>
      Array.from({ length: Number(item.qty) || 1 }, () => ({
        categoryName: item.categoryName,
        price: Number(item.price) || 0
      }))
    );

  const handleValidateAndPrint = async () => {
    if (cart.length === 0) return alert('Le panier est vide');
    
    // Obligation : au moins le Nom OU le Numéro de téléphone avant impression
    if (!clientName.trim() && !clientPhone.trim()) {
      return alert('Veuillez renseigner au moins le nom du client ou son numéro de téléphone avant d\'imprimer le ticket.');
    }

    const invalidLine = cart.find(item => isNaN(item.price) || item.price <= 0 || isNaN(item.qty) || item.qty < 1);
    if (invalidLine) return alert(`Vérifiez la ligne "${invalidLine.categoryName}"`);

    const targetTotal = getCartTotal();
    if (!validateMultiplePayments(targetTotal)) return;

    const formattedClient = clientName.trim() && clientPhone.trim()
      ? `${clientName.trim()} (${clientPhone.trim()})`
      : clientName.trim() || clientPhone.trim();

    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: targetTotal,
          paymentMethod: getFinalPaymentMethod(),
          items: getCartItemsForServer(),
          createdById: currentUser.id,
          clientName: formattedClient
        })
      });
      const invoiceData = await res.json();
      if (!res.ok) { alert(invoiceData.error || 'Erreur'); setIsSubmittingOrder(false); return; }
      triggerPrint(invoiceData);
      window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      setCart([]);
      setSelectedMethods(['CASH']);
      setMethodAmounts({ CASH: '', ONLINE: '', ORANGE_MONEY: '' });
      setClientName('');
      setClientPhone('');
      setIsSubmittingOrder(false);
    } catch {
      alert('Erreur réseau');
      setIsSubmittingOrder(false);
    }
  };

  const handleConfirmReservation = async () => {
    if (cart.length === 0) return alert('Le panier est vide');
    if (!clientName.trim()) return alert('Veuillez entrer le nom du client pour la réservation.');
    const advanceNum = parseFloat(reservationAdvanceInput) || 0;
    if (advanceNum <= 0) return alert('Veuillez entrer un montant d\'avance valide (> 0 FCFA).');
    if (advanceNum > getCartTotal() + 0.01) return alert(`L'avance (${formatFCFA(advanceNum)}) ne peut pas dépasser le montant total (${formatFCFA(getCartTotal())}).`);

    if (!validateMultiplePayments(advanceNum)) return;

    const invalidLine = cart.find(item => isNaN(item.price) || item.price <= 0 || isNaN(item.qty) || item.qty < 1);
    if (invalidLine) return alert(`Vérifiez la ligne "${invalidLine.categoryName}"`);

    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API_BASE}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          totalAmount: getCartTotal(),
          items: cart.map(item => ({
            categoryName: item.categoryName,
            price: parseFloat(item.price) || 0,
            qty: parseInt(item.qty, 10) || 1
          })),
          createdById: currentUser.id,
          initialPayment: {
            amount: advanceNum,
            paymentMethod: getFinalPaymentMethod()
          }
        })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Erreur lors de la réservation'); setIsSubmittingOrder(false); return; }
      triggerProformaPrint(data);
      window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      setCart([]);
      setSelectedMethods(['CASH']);
      setMethodAmounts({ CASH: '', ONLINE: '', ORANGE_MONEY: '' });
      setClientName('');
      setClientPhone('');
      setReservationAdvanceInput('');
      setShowReservationMode(false);
      setIsSubmittingOrder(false);
      setActiveTab('reservations');
    } catch {
      alert('Erreur réseau');
      setIsSubmittingOrder(false);
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-white/[0.02] p-3 sm:p-4">
      {activeTab === 'reservations' ? (
        <ReservationsView categories={categories} currentUser={currentUser} serverOnline={serverOnline} />
      ) : activeTab === 'my_invoices' ? (
        <CashierInvoicesView currentUser={currentUser} serverOnline={serverOnline} />
      ) : activeTab === 'stats' ? (
        <CashierStatsView currentUser={currentUser} serverOnline={serverOnline} />
      ) : (
        <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
          <div className="flex w-72 flex-col overflow-hidden p-3 bg-black/20 rounded-2xl border border-white/5">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                placeholder="Rechercher catégorie..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className={cx(inputCls, 'pl-9 bg-zinc-900 border-white/10 text-foreground/90 text-xs')}
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
                        <div className="flex items-center justify-between p-2.5 hover:bg-white/[0.04] transition group">
                          <button
                            type="button"
                            onClick={() => handleAddItemToCart(cat.name)}
                            disabled={!serverOnline}
                            className="flex-1 text-left text-xs font-semibold text-foreground hover:text-gold transition truncate cursor-pointer py-1"
                            title={`Ajouter ${cat.name} au panier`}
                          >
                            {cat.name}
                          </button>
                          {hasSubs && (
                            <button
                              type="button"
                              onClick={() => toggleExpandCategory(cat.id)}
                              className="text-xs text-gold font-bold bg-gold/15 hover:bg-gold/30 px-3 py-1.5 rounded-xl transition ml-2 cursor-pointer border border-gold/30 flex items-center gap-1 shrink-0 shadow-sm"
                              title={isExpanded ? "Masquer les sous-catégories" : "Afficher les sous-catégories"}
                            >
                              <span>{cat.subCategories.length} sous-cat.</span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>

                        {hasSubs && isExpanded && (
                          <div className="bg-black/30 p-1.5 space-y-1 border-t border-white/5">
                            {cat.subCategories.map(sub => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleAddItemToCart(`${cat.name} - ${sub.name}`)}
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

          <div className="w-px bg-white/10" />

          <div className="flex flex-1 flex-col overflow-hidden p-3 bg-black/20 rounded-2xl border border-white/5">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                <table className="min-w-full border-collapse text-left text-[12px]">
                  <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10">
                    <tr>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Désignation</th>
                      <th className="w-24 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Qté</th>
                      <th className="w-32 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Prix / un.</th>
                      <th className="w-32 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Total</th>
                      <th className="w-20 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-12 text-xs text-foreground/40 italic">
                          Le panier est vide. Cliquez sur une catégorie à gauche pour ajouter un article.
                        </td>
                      </tr>
                    ) : (
                      cart.map(item => (
                        <tr key={item.id} className="border-b border-white/5 odd:bg-white/[0.01] even:bg-white/[0.02]">
                          <td className="px-3 py-2 text-sm text-foreground">
                            <input type="text" value={item.categoryName} onChange={(e) => handleUpdateCartField(item.id, 'categoryName', e.target.value)} className="w-full bg-transparent px-2 py-1 text-xs text-foreground outline-none border border-transparent focus:border-gold/30 rounded" />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => handleUpdateCartField(item.id, 'qty', e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-foreground outline-none focus:border-gold"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) => handleUpdateCartField(item.id, 'price', e.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-foreground outline-none focus:border-gold font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-gold">
                            {formatFCFA((parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 0))}
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => handleRemoveFromCart(item.id)} className="text-xs font-semibold text-foreground/50 hover:text-red-400">Suppr</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Client Info Inputs: 2 inputs side-by-side */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 border-t border-white/10 pt-3">
              <Field label="Nom du client (Au moins 1 des 2 requis) *">
                <input
                  type="text"
                  placeholder="Nom du client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className={cx(inputCls, 'bg-zinc-900 border-white/10 text-foreground text-xs font-medium')}
                />
              </Field>

              <Field label="Numéro de téléphone (Au moins 1 des 2 requis) *">
                <input
                  type="text"
                  placeholder="Ex: 0700000000"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className={cx(inputCls, 'bg-zinc-900 border-white/10 text-foreground text-xs font-medium')}
                />
              </Field>
            </div>
            {!clientName.trim() && !clientPhone.trim() && !showReservationMode && (
              <div className="mt-1 text-[11px] text-amber-400 font-semibold italic text-right">
                ⚠ Saisissez le nom du client ou son téléphone pour valider.
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="mt-2 grid gap-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-foreground/50">Mode de paiement (Sélectionnez un ou plusieurs)</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethods(prev => prev.includes('CASH') ? prev.filter(m => m !== 'CASH') : [...prev, 'CASH'])}
                  className={cx('rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer transition border', selectedMethods.includes('CASH') ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                >
                  Espèces
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMethods(prev => prev.includes('ONLINE') ? prev.filter(m => m !== 'ONLINE') : [...prev, 'ONLINE'])}
                  className={cx('rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer transition border', selectedMethods.includes('ONLINE') ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                >
                  Mobile Money
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMethods(prev => prev.includes('ORANGE_MONEY') ? prev.filter(m => m !== 'ORANGE_MONEY') : [...prev, 'ORANGE_MONEY'])}
                  className={cx('rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer transition border', selectedMethods.includes('ORANGE_MONEY') ? 'bg-orange-500 text-black border-orange-500' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}
                >
                  Orange Money
                </button>
              </div>
            </div>

            {/* Split amounts input if more than 1 payment method is selected */}
            {selectedMethods.length > 1 && (
              <div className="mt-2.5 p-3 bg-zinc-900/60 rounded-xl border border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase font-bold text-amber-400">Répartition du paiement</div>
                  <button
                    type="button"
                    onClick={() => {
                      const target = showReservationMode ? (parseFloat(reservationAdvanceInput) || 0) : getCartTotal();
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
                    <span className="text-gold">Requis: {formatFCFA(showReservationMode ? (parseFloat(reservationAdvanceInput) || 0) : getCartTotal())}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Reservation Advance Panel if activated */}
            {showReservationMode && (
              <div className="mt-3 p-4 bg-purple-950/40 border-2 border-purple-500/50 rounded-2xl space-y-3 animate-in fade-in duration-200">
                <div className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-400" />
                    <span>Mode Réservation en cours — Saisir l'Acompte</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReservationMode(false);
                      setReservationAdvanceInput('');
                    }}
                    className="rounded-lg px-2.5 py-1 bg-white/10 text-white hover:bg-white/20 text-xs font-bold transition cursor-pointer"
                  >
                    ✕ Annuler la réservation
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] uppercase font-bold text-purple-300/80 mb-1 block">
                      Montant de l'acompte / avance (FCFA) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={getCartTotal()}
                      placeholder="Ex: 5000"
                      value={reservationAdvanceInput}
                      onChange={(e) => setReservationAdvanceInput(e.target.value)}
                      className={cx(inputCls, 'bg-zinc-900 border-purple-400/60 text-gold font-mono font-black text-base focus:border-purple-400')}
                    />
                  </div>
                  <div className="self-end">
                    <button
                      type="button"
                      onClick={handleConfirmReservation}
                      disabled={isSubmittingOrder || !reservationAdvanceInput || Number(reservationAdvanceInput) <= 0 || Number(reservationAdvanceInput) > getCartTotal() || !clientName.trim() || !serverOnline}
                      className="rounded-xl bg-gold px-6 py-3 text-xs font-black text-black hover:bg-gold/85 disabled:opacity-30 transition cursor-pointer shadow-lg shadow-gold/20 flex items-center gap-2"
                    >
                      <span>{isSubmittingOrder ? 'Enregistrement...' : 'Valider la Réservation & Reçu'}</span>
                    </button>
                  </div>
                </div>

                {/* Helpful Validation Alerts */}
                <div className="space-y-1 text-[11px] font-semibold">
                  {!clientName.trim() && (
                    <div className="text-amber-400 flex items-center gap-1">
                      <span>⚠ Le nom du client en haut est obligatoire pour créer la réservation.</span>
                    </div>
                  )}
                  {(!reservationAdvanceInput || Number(reservationAdvanceInput) <= 0) && (
                    <div className="text-purple-300/90 italic">
                      ℹ Saisissez le montant de l'acompte (ex: 5000) pour activer le bouton de validation.
                    </div>
                  )}
                  {Number(reservationAdvanceInput) > getCartTotal() && (
                    <div className="text-red-400">
                      ⚠ L'acompte ne peut pas dépasser le total de la commande ({formatFCFA(getCartTotal())}).
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Total & Main Buttons */}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-3">
              <div className="p-1">
                <div className="uppercase tracking-wider text-[10px] text-foreground/40 font-bold">Montant Total</div>
                <div className="text-2xl font-black text-gold">{formatFCFA(getCartTotal())}</div>
              </div>

              <div className="flex items-center gap-3">
                {/* Button 1: Créer Réservation (Distinct Purple Color) */}
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length === 0) return alert('Le panier est vide');
                    setShowReservationMode(true);
                  }}
                  disabled={isSubmittingOrder || cart.length === 0 || !serverOnline || showReservationMode}
                  className={cx(
                    'rounded-2xl py-3 px-5 text-xs font-extrabold transition flex items-center gap-2 cursor-pointer shadow-lg',
                    showReservationMode
                      ? 'bg-purple-900/50 text-purple-300 border border-purple-500/40 opacity-80 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20 border border-purple-400/30 disabled:opacity-40'
                  )}
                  title="Créer une réservation avec acompte"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>{showReservationMode ? 'Mode Réservation Actif' : 'Créer Réservation'}</span>
                </button>

                {/* Button 2: Valider Ticket (Distinct Emerald Green Color, Disabled during reservation mode) */}
                <button
                  type="button"
                  onClick={handleValidateAndPrint}
                  disabled={isSubmittingOrder || cart.length === 0 || !serverOnline || showReservationMode}
                  className={cx(
                    'rounded-2xl py-3 px-8 text-xs font-black transition shadow-lg cursor-pointer',
                    showReservationMode
                      ? 'bg-zinc-800 text-foreground/30 border border-white/10 opacity-30 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20 disabled:opacity-40'
                  )}
                  title={showReservationMode ? 'Désactivé pendant la création de réservation' : 'Valider la vente directe'}
                >
                  {isSubmittingOrder ? 'Enregistrement...' : 'Valider Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}