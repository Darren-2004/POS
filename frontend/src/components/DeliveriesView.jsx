import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Search, CheckSquare, Square, CheckCircle, Clock, MapPin, Phone, User, Printer, XCircle, PackageCheck, AlertCircle } from 'lucide-react';
import { API_BASE } from '../utils/constants';
import { triggerPrint, showToast, cx, formatFCFA } from '../utils/helpers';

export default function DeliveriesView({ currentUser }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, PENDING, IN_DELIVERY, DELIVERED, CANCELLED
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [targetBulkStatus, setTargetBulkStatus] = useState(null);
  const [targetSingleDelivery, setTargetSingleDelivery] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());

      const res = await fetch(`${API_BASE}/deliveries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      showToast("⚠️ Erreur lors de la récupération des livraisons", "error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(fetchDeliveries, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchDeliveries]);

  // Handle select all / deselect all
  const toggleSelectAll = () => {
    if (selectedIds.length === deliveries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deliveries.map(d => d.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Open modal to confirm payment method when marking DELIVERED
  const openDeliveredModal = (deliveryOrBulk = null) => {
    if (deliveryOrBulk === 'BULK') {
      if (selectedIds.length === 0) return;
      setTargetBulkStatus('DELIVERED');
      setTargetSingleDelivery(null);
    } else if (deliveryOrBulk) {
      setTargetSingleDelivery(deliveryOrBulk);
      setTargetBulkStatus(null);
      setPaymentMethod(deliveryOrBulk.paymentMethod || 'CASH');
    }
    setPaymentModalOpen(true);
  };

  // Perform status update (single or bulk)
  const handleUpdateStatus = async (status, deliveryItem = null) => {
    if (status === 'DELIVERED' && !paymentModalOpen) {
      openDeliveredModal(deliveryItem || 'BULK');
      return;
    }

    setSubmitting(true);
    try {
      if (targetSingleDelivery || deliveryItem) {
        const target = targetSingleDelivery || deliveryItem;
        const res = await fetch(`${API_BASE}/deliveries/${target.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, paymentMethod })
        });
        if (res.ok) {
          showToast(`✅ Statut mis à jour : ${getStatusLabel(status)}`, 'success');
        }
      } else if (selectedIds.length > 0) {
        const res = await fetch(`${API_BASE}/deliveries/bulk-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds, status, paymentMethod })
        });
        if (res.ok) {
          const data = await res.json();
          showToast(`✅ ${data.message || 'Lot mis à jour avec succès'}`, 'success');
          setSelectedIds([]);
        }
      }
      setPaymentModalOpen(false);
      fetchDeliveries();
    } catch (err) {
      console.error('Update status error:', err);
      showToast("❌ Échec de la mise à jour", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Enregistrée</span>;
      case 'IN_DELIVERY':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><Truck className="w-3.5 h-3.5 animate-pulse" /> En cours de livraison</span>;
      case 'DELIVERED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Livrée (En comptabilité)</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Annulée</span>;
      default:
        return status;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING': return 'Enregistrée';
      case 'IN_DELIVERY': return 'En cours de livraison';
      case 'DELIVERED': return 'Livrée';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
  };

  // Calculate totals
  const totalCount = deliveries.length;
  const pendingCount = deliveries.filter(d => d.deliveryStatus === 'PENDING').length;
  const inDeliveryCount = deliveries.filter(d => d.deliveryStatus === 'IN_DELIVERY').length;
  const deliveredCount = deliveries.filter(d => d.deliveryStatus === 'DELIVERED').length;
  const deliveredRevenue = deliveries
    .filter(d => d.deliveryStatus === 'DELIVERED')
    .reduce((sum, d) => sum + (d.totalAmount || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background text-foreground p-4 sm:p-6 space-y-4">
      {/* Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-gold" /> Espace Livraisons
          </h1>
          <p className="text-xs text-foreground/60">
            Suivi des commandes à livrer — l'intégration comptable est automatique dès le passage au statut "Livrée"
          </p>
        </div>

        <button
          onClick={fetchDeliveries}
          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium border border-white/10 transition"
        >
          🔄 Actualiser
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Enregistrées</div>
            <div className="text-lg font-bold tabular-nums text-amber-400">{pendingCount}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">En cours</div>
            <div className="text-lg font-bold tabular-nums text-blue-400">{inDeliveryCount}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <PackageCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Livrées</div>
            <div className="text-lg font-bold tabular-nums text-emerald-400">{deliveredCount}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">CA Livré comptabilisé</div>
            <div className="text-sm sm:text-base font-bold tabular-nums text-gold">{formatFCFA(deliveredRevenue)}</div>
          </div>
        </div>
      </div>

      {/* Filters Bar & Bulk Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-zinc-900 border border-white/10 text-xs">
          {[
            { id: 'ALL', label: 'Toutes' },
            { id: 'PENDING', label: 'Enregistrées' },
            { id: 'IN_DELIVERY', label: 'En cours' },
            { id: 'DELIVERED', label: 'Livrées' },
            { id: 'CANCELLED', label: 'Annulées' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={cx(
                'px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap',
                filterStatus === tab.id
                  ? 'bg-gold text-black font-bold shadow'
                  : 'text-foreground/70 hover:text-foreground hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
          <input
            type="text"
            placeholder="Rechercher nom, tél, N° livraison, adresse..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-zinc-900 py-1.5 pl-9 pr-3 text-xs text-foreground placeholder-foreground/30 outline-none focus:border-gold/60"
          />
        </div>
      </div>

      {/* Bulk Action Banner when items are selected */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gold/15 border border-gold/40 text-xs animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-gold">
            <CheckSquare className="h-4 w-4" />
            <span>{selectedIds.length} livraison(s) sélectionnée(s)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleUpdateStatus('IN_DELIVERY')}
              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold shadow flex items-center gap-1.5 transition"
            >
              <Truck className="h-3.5 w-3.5" /> Passer en cours
            </button>

            <button
              onClick={() => openDeliveredModal('BULK')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow flex items-center gap-1.5 transition"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Marquer comme Livrées
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1.5 rounded-lg text-foreground/60 hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 rounded-2xl border border-white/[0.07] overflow-y-auto bg-zinc-950">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-[10px] uppercase tracking-wider text-foreground/50 font-semibold border-b border-white/[0.07] z-10">
            <tr>
              <th className="px-3 py-3 w-10 text-center">
                <button onClick={toggleSelectAll} className="text-foreground/60 hover:text-gold">
                  {deliveries.length > 0 && selectedIds.length === deliveries.length ? (
                    <CheckSquare className="h-4 w-4 text-gold" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-3 py-3">N° Livraison</th>
              <th className="px-3 py-3">Client & Téléphone</th>
              <th className="px-3 py-3 hidden sm:table-cell">Adresse</th>
              <th className="px-3 py-3 text-right">Montant</th>
              <th className="px-3 py-3 text-center">Statut</th>
              <th className="px-3 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-foreground/40">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin"></span>
                    Chargement des livraisons...
                  </div>
                </td>
              </tr>
            )}

            {!loading && deliveries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-foreground/40">
                  Aucune livraison trouvée.
                </td>
              </tr>
            )}

            {!loading && deliveries.map(del => {
              const isSelected = selectedIds.includes(del.id);
              const clientName = del.clientName || '—';
              const clientPhone = del.clientPhone || '—';

              return (
                <tr
                  key={del.id}
                  className={cx(
                    'transition-colors',
                    isSelected ? 'bg-gold/10' : 'hover:bg-white/[0.02]'
                  )}
                >
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => toggleSelect(del.id)} className="text-foreground/60 hover:text-gold">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-gold" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-3 font-mono font-bold text-gold">
                    {del.deliveryNo || del.invoiceNumber}
                  </td>

                  <td className="px-3 py-3">
                    <div className="font-semibold text-foreground">{clientName}</div>
                    {del.clientPhone && (
                      <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" /> {del.clientPhone}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3 hidden sm:table-cell text-foreground/70 max-w-xs truncate">
                    {del.deliveryAddress ? (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gold shrink-0" /> {del.deliveryAddress}</span>
                    ) : (
                      <span className="text-foreground/30 italic">Non précisée</span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-mono font-bold text-foreground">
                    {formatFCFA(del.totalAmount)}
                  </td>

                  <td className="px-3 py-3 text-center">
                    {getStatusBadge(del.deliveryStatus)}
                  </td>

                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Status Action Button */}
                      {del.deliveryStatus === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus('IN_DELIVERY', del)}
                          title="Passer en cours de livraison"
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition"
                        >
                          <Truck className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {del.deliveryStatus !== 'DELIVERED' && del.deliveryStatus !== 'CANCELLED' && (
                        <button
                          onClick={() => openDeliveredModal(del)}
                          title="Marquer comme Livrée (Entrée en compta)"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Print Ticket */}
                      <button
                        onClick={() => triggerPrint(del)}
                        title="Imprimer le bon de livraison"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/70 border border-white/10 transition"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>

                      {/* Details View */}
                      <button
                        onClick={() => setSelectedDelivery(del)}
                        title="Détails"
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-foreground/80 border border-white/10"
                      >
                        Voir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal for Marking as DELIVERED (Confirms Payment Method) */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-gold/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              {targetSingleDelivery ? 'Validation de la livraison' : `Validation de ${selectedIds.length} livraison(s)`}
            </h3>

            <p className="text-xs text-foreground/70 leading-relaxed">
              ⚠️ <strong>Confirmation comptable</strong> : Le passage au statut <strong>LIVRÉE</strong> va intégrer immédiatement le montant dans la comptabilité et le rapport Z.
            </p>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground/80">Confirmer le mode de règlement :</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Espèces' },
                  { id: 'ONLINE', label: 'Mobile Money' },
                  { id: 'ORANGE_MONEY', label: 'Orange Money' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={cx(
                      'py-2 px-2 rounded-xl text-xs font-bold border transition text-center',
                      paymentMethod === m.id
                        ? 'bg-gold text-black border-gold shadow'
                        : 'bg-white/5 text-foreground/70 border-white/10 hover:bg-white/10'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                disabled={submitting}
                onClick={() => setPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-foreground/70"
              >
                Annuler
              </button>
              <button
                disabled={submitting}
                onClick={() => handleUpdateStatus('DELIVERED')}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow flex items-center gap-1.5"
              >
                {submitting ? 'Validation...' : '✅ Valider et Entrer en Compta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="bg-zinc-900 border-l border-gold/30 w-full max-w-lg h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-lg font-bold text-gold">Livraison N° {selectedDelivery.deliveryNo || selectedDelivery.invoiceNumber}</h3>
                  <div className="text-xs text-foreground/50">{new Date(selectedDelivery.createdAt).toLocaleString('fr-FR')}</div>
                </div>
                <button
                  onClick={() => setSelectedDelivery(null)}
                  className="text-foreground/50 hover:text-foreground text-xl"
                >✕</button>
              </div>

              {/* Status & Client Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground/60">Statut :</span>
                  <div>{getStatusBadge(selectedDelivery.deliveryStatus)}</div>
                </div>

                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gold shrink-0" />
                    <span className="font-semibold text-foreground">{selectedDelivery.clientName || 'Client non spécifié'}</span>
                  </div>
                  {selectedDelivery.clientPhone && (
                    <div className="flex items-center gap-2 text-emerald-400 font-mono">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{selectedDelivery.clientPhone}</span>
                    </div>
                  )}
                  {selectedDelivery.deliveryAddress && (
                    <div className="flex items-center gap-2 text-foreground/70">
                      <MapPin className="h-4 w-4 text-gold shrink-0" />
                      <span>{selectedDelivery.deliveryAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/50">Articles commandés</div>
                <div className="rounded-xl border border-white/[0.06] bg-zinc-950 divide-y divide-white/[0.04]">
                  {selectedDelivery.items?.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{item.categoryName}</div>
                        <div className="text-[11px] text-foreground/50">{formatFCFA(item.price)} x {item.qty || 1}</div>
                      </div>
                      <div className="font-bold text-foreground font-mono">
                        {formatFCFA(item.price * (item.qty || 1))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Payment Method */}
              <div className="rounded-xl bg-gold/10 border border-gold/30 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gold/80 font-bold uppercase">Total Commande</div>
                  <div className="text-xs text-foreground/60">Règlement : {selectedDelivery.paymentMethod || 'Espèces'}</div>
                </div>
                <div className="text-xl font-bold text-gold font-mono">
                  {formatFCFA(selectedDelivery.totalAmount)}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={() => triggerPrint(selectedDelivery)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-foreground flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> Imprimer Ticket
              </button>

              {selectedDelivery.deliveryStatus !== 'DELIVERED' && (
                <button
                  onClick={() => {
                    const del = selectedDelivery;
                    setSelectedDelivery(null);
                    openDeliveredModal(del);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" /> Marquer comme Livrée
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
