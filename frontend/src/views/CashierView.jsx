import React, { useState } from 'react';
import { Search } from 'lucide-react';
import Field, { inputCls } from '../components/Field';
import { formatFCFA, triggerPrint, cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function CashierView({ categories, currentUser, serverOnline }) {
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  const handleCategoryClick = (category) => {
    setCart(prev => [
      ...prev,
      {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        categoryName: category.name,
        price: '',
        qty: 1,
      }
    ]);
  };

  const handleUpdateCartField = (id, field, rawValue) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'categoryName') return { ...item, categoryName: rawValue };
      if (rawValue === '') return { ...item, [field]: '' };
      const value = field === 'qty'
        ? Math.max(0, parseInt(rawValue, 10) || 0)
        : Math.max(0, parseFloat(rawValue) || 0);
      return { ...item, [field]: value };
    }));
  };

  const handleRemoveFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));
  const getCartTotal = () => cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);

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
          paymentMethod: paymentMethod || 'UNSPECIFIED',
          items: getCartItemsForServer(),
          createdById: currentUser.id
        })
      });
      const invoiceData = await res.json();
      if (!res.ok) { alert(invoiceData.error || 'Erreur'); setIsSubmittingOrder(false); return; }
      invoiceData.clientName = clientName.trim();
      triggerPrint(invoiceData);
      setCart([]);
      setPaymentMethod('');
      setClientName('');
      setIsSubmittingOrder(false);
    } catch {
      alert('Erreur réseau');
      setIsSubmittingOrder(false);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white/[0.02] p-4 sm:p-5">
      <div className="mt-4 flex h-full gap-4 overflow-hidden">
        <div className="flex w-72 flex-col overflow-hidden p-3">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className={cx(inputCls, 'pl-9 bg-transparent border-none text-foreground/80 placeholder:italic placeholder:text-foreground/40')}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ul className="divide-y divide-white/10 text-sm text-foreground/90">
              {filteredCategories.map(cat => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(cat)}
                    disabled={!serverOnline}
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-white/[0.06] hover:text-gold active:bg-gold/10 disabled:opacity-40"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="w-px bg-white/10" />

        <div className="flex flex-1 flex-col overflow-hidden p-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <table className="min-w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr>
                    <th className="border border-white/10 w-1/2 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Désignation</th>
                    <th className="border border-white/10 w-32 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Qté</th>
                    <th className="border border-white/10 w-40 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Prix / un.</th>
                    <th className="border border-white/10 w-40 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Total</th>
                    <th className="border border-white/10 w-28 px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/50">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.id} className="odd:bg-white/[0.01] even:bg-white/[0.02]">
                      <td className="border border-white/10 px-3 py-3 text-sm text-foreground">
                        <input type="text" value={item.categoryName} onChange={(e) => handleUpdateCartField(item.id, 'categoryName', e.target.value)} className="w-full bg-transparent px-2 py-2 text-sm text-foreground outline-none" />
                      </td>
                      <td className="border border-white/10 px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          value={item.qty}
                          onChange={(e) => handleUpdateCartField(item.id, 'qty', e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-transparent px-2 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                        />
                      </td>
                      <td className="border border-white/10 px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleUpdateCartField(item.id, 'price', e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-transparent px-2 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                        />
                      </td>
                      <td className="border border-white/10 px-3 py-3 font-mono text-sm font-semibold text-gold">
                        {formatFCFA((Number(item.price) || 0) * (Number(item.qty) || 0))}
                      </td>
                      <td className="border border-white/10 px-3 py-3">
                        <button type="button" onClick={() => handleRemoveFromCart(item.id)} className="text-xs font-semibold text-foreground/60 hover:text-red-400">Suppr</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Nom du client">
              <input type="text" placeholder="Nom du client" value={clientName} onChange={(e) => setClientName(e.target.value)} className={cx(inputCls, 'bg-transparent border-none text-foreground/90')} />
            </Field>

            <div className="grid gap-2">
              <div className="text-[10px] uppercase tracking-wider text-foreground/40">Mode de paiement</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMethod('CASH')} className={cx('rounded-2xl px-3 py-2 text-xs font-semibold', paymentMethod === 'CASH' ? 'bg-gold text-black' : 'bg-white/[0.03] text-foreground/60')}>Espèces</button>
                <button onClick={() => setPaymentMethod('ONLINE')} className={cx('rounded-2xl px-3 py-2 text-xs font-semibold', paymentMethod === 'ONLINE' ? 'bg-gold text-black' : 'bg-white/[0.03] text-foreground/60')}>Mobile Money</button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="p-2 text-sm text-foreground/60">
              <div className="uppercase tracking-wider text-[10px] text-foreground/40">Montant final</div>
              <div className="mt-1 text-2xl font-semibold text-gold">{formatFCFA(getCartTotal())}</div>
            </div>
            <button onClick={handleValidateAndPrint} disabled={isSubmittingOrder || cart.length === 0 || !serverOnline} className="rounded-2xl bg-gold py-3 text-xs font-semibold text-black hover:bg-gold/85 disabled:opacity-40 sm:px-10">
              {isSubmittingOrder ? 'Enregistrement...' : 'Valider Ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}