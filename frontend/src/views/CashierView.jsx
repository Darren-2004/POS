import React, { useState } from 'react';
import { Search, ShoppingBag, Clock, PlusCircle } from 'lucide-react';
import Field, { inputCls } from '../components/Field';
import ReservationsView from '../components/ReservationsView';
import { formatFCFA, triggerPrint, triggerProformaPrint, cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function CashierView({ categories, currentUser, serverOnline }) {
  const [activeTab, setActiveTab] = useState('sale'); // 'sale' | 'reservations'
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

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
    const invalidLine = cart.find(item => isNaN(item.price) || item.price <= 0 || isNaN(item.qty) || item.qty < 1);
    if (invalidLine) return alert(`Vérifiez la ligne "${invalidLine.categoryName}"`);

    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: getCartTotal(),
          paymentMethod: paymentMethod || 'CASH',
          items: getCartItemsForServer(),
          createdById: currentUser.id,
          clientName: clientName.trim()
        })
      });
      const invoiceData = await res.json();
      if (!res.ok) { alert(invoiceData.error || 'Erreur'); setIsSubmittingOrder(false); return; }
      triggerPrint(invoiceData);
      window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      setCart([]);
      setPaymentMethod('');
      setClientName('');
      setIsSubmittingOrder(false);
    } catch {
      alert('Erreur réseau');
      setIsSubmittingOrder(false);
    }
  };

  const handleCreateReservationFromCart = async () => {
    if (cart.length === 0) return alert('Le panier est vide');
    if (!clientName.trim()) return alert('Veuillez entrer le nom du client pour la réservation.');
    const invalidLine = cart.find(item => isNaN(item.price) || item.price <= 0 || isNaN(item.qty) || item.qty < 1);
    if (invalidLine) return alert(`Vérifiez la ligne "${invalidLine.categoryName}"`);

    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API_BASE}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          totalAmount: getCartTotal(),
          items: cart.map(item => ({
            categoryName: item.categoryName,
            price: Number(item.price) || 0,
            qty: Number(item.qty) || 1
          })),
          createdById: currentUser.id,
          initialPayment: paymentMethod ? {
            amount: getCartTotal(),
            paymentMethod: paymentMethod
          } : null
        })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Erreur lors de la réservation'); setIsSubmittingOrder(false); return; }
      triggerProformaPrint(data);
      window.dispatchEvent(new CustomEvent('pos:dashboard-refresh'));
      setCart([]);
      setPaymentMethod('');
      setClientName('');
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
      {/* Navigation tabs for Cashier */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-2 shrink-0">
        <button
          onClick={() => setActiveTab('sale')}
          className={cx(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer',
            activeTab === 'sale' ? 'bg-gold text-black shadow-md shadow-gold/20' : 'bg-white/[0.03] text-foreground/70 hover:bg-white/10'
          )}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Vente Directe</span>
        </button>

        <button
          onClick={() => setActiveTab('reservations')}
          className={cx(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer',
            activeTab === 'reservations' ? 'bg-gold text-black shadow-md shadow-gold/20' : 'bg-white/[0.03] text-foreground/70 hover:bg-white/10'
          )}
        >
          <Clock className="h-4 w-4" />
          <span>Réservations & Acomptes</span>
        </button>
      </div>

      {activeTab === 'reservations' ? (
        <ReservationsView categories={categories} currentUser={currentUser} serverOnline={serverOnline} />
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
                        <div className="flex items-center justify-between p-2 hover:bg-white/[0.04] transition">
                          <button
                            type="button"
                            onClick={() => handleAddItemToCart(cat.name)}
                            disabled={!serverOnline}
                            className="flex-1 text-left text-xs font-semibold text-foreground hover:text-gold transition truncate cursor-pointer"
                            title={`Ajouter ${cat.name} au panier`}
                          >
                            {cat.name}
                          </button>
                          {hasSubs && (
                            <button
                              type="button"
                              onClick={() => toggleExpandCategory(cat.id)}
                              className="text-[10px] text-gold/90 bg-gold/10 hover:bg-gold/20 px-2 py-0.5 rounded-md font-bold transition ml-1 cursor-pointer"
                              title="Voir les sous-catégories"
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
                            {formatFCFA((Number(item.price) || 0) * (Number(item.qty) || 0))}
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

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] border-t border-white/10 pt-3">
              <Field label="Nom du client (Optionnel)">
                <input type="text" placeholder="Nom du client" value={clientName} onChange={(e) => setClientName(e.target.value)} className={cx(inputCls, 'bg-zinc-900 border-white/10 text-foreground text-xs')} />
              </Field>

              <div className="grid gap-1.5">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-foreground/50">Mode de paiement (Optionnel)</div>
                <div className="flex gap-2">
                  <button onClick={() => setPaymentMethod(prev => prev === 'CASH' ? '' : 'CASH')} className={cx('rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition border', paymentMethod === 'CASH' ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}>Espèces</button>
                  <button onClick={() => setPaymentMethod(prev => prev === 'ONLINE' ? '' : 'ONLINE')} className={cx('rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition border', paymentMethod === 'ONLINE' ? 'bg-gold text-black border-gold' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}>Mobile Money</button>
                  <button onClick={() => setPaymentMethod(prev => prev === 'ORANGE_MONEY' ? '' : 'ORANGE_MONEY')} className={cx('rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition border', paymentMethod === 'ORANGE_MONEY' ? 'bg-orange-500 text-black border-orange-500' : 'bg-zinc-900 border-white/10 text-foreground/70 hover:bg-white/10')}>Orange Money</button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-3">
              <div className="p-1">
                <div className="uppercase tracking-wider text-[10px] text-foreground/40 font-bold">Montant Total</div>
                <div className="text-2xl font-black text-gold">{formatFCFA(getCartTotal())}</div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateReservationFromCart}
                  disabled={isSubmittingOrder || cart.length === 0 || !serverOnline}
                  className="rounded-2xl border border-gold/50 bg-gold/15 py-3 px-4 text-xs font-bold text-gold hover:bg-gold/25 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
                  title="Créer une réservation avec versement en 3 tranches"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Créer Réservation</span>
                </button>

                <button
                  type="button"
                  onClick={handleValidateAndPrint}
                  disabled={isSubmittingOrder || cart.length === 0 || !serverOnline}
                  className="rounded-2xl bg-gold py-3 px-8 text-xs font-extrabold text-black hover:bg-gold/85 disabled:opacity-40 transition shadow-lg shadow-gold/10 cursor-pointer"
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