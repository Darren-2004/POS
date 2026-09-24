import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Search, CheckSquare, Square, CheckCircle, Clock, MapPin, Phone, User, Printer, XCircle, PackageCheck, AlertCircle, Calendar, RotateCcw, UserCheck, DollarSign, UserMinus, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../utils/constants';
import { triggerPrint, showToast, getTodayDateStr, cx, formatFCFA, getPaymentMethodLabel } from '../utils/helpers';

export default function DeliveriesView({ currentUser }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, PENDING, IN_DELIVERY, DELIVERED, CANCELLED
  const [selectedDriverFilter, setSelectedDriverFilter] = useState('ALL'); // ALL or driver name
  const [filterDate, setFilterDate] = useState(getTodayDateStr());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  // Payment Confirmation Modal (when marking PAYEE or DELIVERED)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [targetBulkStatus, setTargetBulkStatus] = useState(null);
  const [targetSingleDelivery, setTargetSingleDelivery] = useState(null);
  const [paymentActionType, setPaymentActionType] = useState('DELIVERED'); // 'DELIVERED' or 'PAY_ONLY'
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Driver Assignment Modal (when marking IN_DELIVERY)
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [targetInDeliveryItem, setTargetInDeliveryItem] = useState(null);
  const [driverInput, setDriverInput] = useState('');
  const [savedDrivers, setSavedDrivers] = useState([]);
  const [showDriverSuggestions, setShowDriverSuggestions] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterDate) params.append('date', filterDate);
      if (searchQuery.trim()) params.append('q', searchQuery.trim());

      const res = await fetch(`${API_BASE}/deliveries?${params.toString()}`);
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setDeliveries(Array.isArray(data) ? data : []);
      } else {
        setDeliveries([]);
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDate, searchQuery, currentUser?.id, currentUser?.role]);

  const fetchSavedDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/delivery-persons`);
      if (res.ok) {
        const data = await res.json();
        setSavedDrivers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching saved drivers:', err);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    fetchSavedDrivers();
  }, [fetchDeliveries, fetchSavedDrivers]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(fetchDeliveries, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchDeliveries]);

  // Filtered deliveries for display (by driver filter)
  const displayedDeliveries = deliveries.filter(d => {
    if (selectedDriverFilter !== 'ALL') {
      return (d.deliveryPerson || '').trim().toLowerCase() === selectedDriverFilter.trim().toLowerCase();
    }
    return true;
  });

  // Extract active driver names from current IN_DELIVERY deliveries
  const activeDrivers = Array.from(new Set(
    deliveries
      .filter(d => d.deliveryStatus === 'IN_DELIVERY' && d.deliveryPerson)
      .map(d => (d.deliveryPerson || '').trim())
  )).sort();

  // Handle select all / deselect all
  const toggleSelectAll = () => {
    if (selectedIds.length === displayedDeliveries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedDeliveries.map(d => d.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Open modal to confirm driver when marking IN_DELIVERY
  const openInDeliveryModal = (deliveryOrBulk = null) => {
    if (deliveryOrBulk === 'BULK') {
      if (selectedIds.length === 0) return;
      setTargetInDeliveryItem('BULK');
      setDriverInput('');
    } else if (deliveryOrBulk) {
      setTargetInDeliveryItem(deliveryOrBulk);
      setDriverInput(deliveryOrBulk.deliveryPerson || '');
    }
    fetchSavedDrivers();
    setShowDriverSuggestions(false);
    setDriverModalOpen(true);
  };

  // Open modal to confirm payment method when marking PAYEE or DELIVERED
  const openPaymentModal = (actionType = 'DELIVERED', deliveryOrBulk = null) => {
    setPaymentActionType(actionType);
    if (deliveryOrBulk === 'BULK') {
      if (selectedIds.length === 0) return;
      setTargetBulkStatus(actionType);
      setTargetSingleDelivery(null);
    } else if (deliveryOrBulk) {
      setTargetSingleDelivery(deliveryOrBulk);
      setTargetBulkStatus(null);
      setPaymentMethod(deliveryOrBulk.paymentMethod || 'CASH');
    }
    setPaymentModalOpen(true);
  };

  // Unassign driver (retirer du livreur)
  const handleUnassignDriver = async (deliveryItem = null) => {
    setSubmitting(true);
    try {
      const target = deliveryItem || (selectedIds.length > 0 ? null : null);
      if (target) {
        const res = await fetch(`${API_BASE}/deliveries/${target.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'UNASSIGN' })
        });
        if (res.ok) {
          showToast(`✅ Livraison retirée du livreur (Remise en attente)`, 'info');
        }
      } else if (selectedIds.length > 0) {
        const res = await fetch(`${API_BASE}/deliveries/bulk-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds, action: 'UNASSIGN' })
        });
        if (res.ok) {
          const data = await res.json();
          showToast(`✅ ${data.message || 'Livraisons retirées du livreur'}`, 'info');
          setSelectedIds([]);
        }
      }
      fetchDeliveries();
    } catch (err) {
      console.error('Unassign driver error:', err);
      showToast("❌ Échec du retrait du livreur", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Main status & payment update handler
  const handleUpdateStatus = async (status, deliveryItem = null, extraParams = {}) => {
    // If action is PAY_ONLY
    if (extraParams.action === 'PAY') {
      if (!paymentModalOpen && !extraParams.paymentConfirmed) {
        openPaymentModal('PAY_ONLY', deliveryItem || (selectedIds.length > 0 ? 'BULK' : null));
        return;
      }
    }

    // If going to IN_DELIVERY, prompt for driver unless confirmed from driver modal
    if (status === 'IN_DELIVERY' && !extraParams.deliveryPersonConfirmed) {
      openInDeliveryModal(deliveryItem || (selectedIds.length > 0 ? 'BULK' : null));
      return;
    }

    // If going to DELIVERED, prompt for payment method unless confirmed from payment modal
    if (status === 'DELIVERED' && !paymentModalOpen && !extraParams.paymentConfirmed) {
      openPaymentModal('DELIVERED', deliveryItem || (selectedIds.length > 0 ? 'BULK' : null));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {};
      if (status) payload.status = status;
      if (extraParams.action) payload.action = extraParams.action;
      if (extraParams.deliveryPerson !== undefined) payload.deliveryPerson = extraParams.deliveryPerson;
      if (paymentMethod) payload.paymentMethod = paymentMethod;

      const target = targetInDeliveryItem === 'BULK' || targetBulkStatus ? null : (targetSingleDelivery || targetInDeliveryItem || deliveryItem);

      if (target && target !== 'BULK') {
        const res = await fetch(`${API_BASE}/deliveries/${target.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const msg = extraParams.action === 'PAY' ? 'Paiement enregistré' : `Statut mis à jour : ${getStatusLabel(status)}`;
          showToast(`✅ ${msg}`, 'success');
        }
      } else if (selectedIds.length > 0) {
        const res = await fetch(`${API_BASE}/deliveries/bulk-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds, ...payload })
        });
        if (res.ok) {
          const data = await res.json();
          showToast(`✅ ${data.message || 'Mise à jour effectuée'}`, 'success');
          setSelectedIds([]);
        }
      }

      setPaymentModalOpen(false);
      setDriverModalOpen(false);

      // If a driver was assigned, switch to that driver filter
      if (extraParams.deliveryPerson) {
        setSelectedDriverFilter(extraParams.deliveryPerson);
      }

      await fetchDeliveries();
      await fetchSavedDrivers();
    } catch (err) {
      console.error('Update status error:', err);
      showToast("❌ Échec de la mise à jour", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDriverAssignment = () => {
    const driverName = driverInput.trim();
    if (!driverName) {
      showToast("⚠️ Veuillez préciser le nom du livreur", "warning");
      return;
    }
    handleUpdateStatus('IN_DELIVERY', targetInDeliveryItem, {
      deliveryPersonConfirmed: true,
      deliveryPerson: driverName
    });
  };

  const getLogisticsBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> En attente</span>;
      case 'IN_DELIVERY':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"><Truck className="w-3.5 h-3.5 animate-pulse" /> En cours</span>;
      case 'DELIVERED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Livrée</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Annulée</span>;
      default:
        return status;
    }
  };

  const getPaymentBadge = (del) => {
    const isPaid = del.isPaid || del.deliveryStatus === 'DELIVERED';
    if (isPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          PAYÉE ({getPaymentMethodLabel(del.paymentMethod)})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-foreground/50 border border-white/10">
        ⚪ NON PAYÉE
      </span>
    );
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING': return 'En attente';
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
  const paidCount = deliveries.filter(d => d.isPaid || d.deliveryStatus === 'DELIVERED').length;
  const deliveredRevenue = deliveries
    .filter(d => d.isPaid || d.deliveryStatus === 'DELIVERED')
    .reduce((sum, d) => sum + (d.totalAmount || 0), 0);

  // Suggestions filter for driver input
  const matchingDriverSuggestions = savedDrivers.filter(d =>
    d.name.toLowerCase().includes(driverInput.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background text-foreground p-4 sm:p-6 space-y-4">
      {/* Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-gold" /> Espace Livraisons & Expéditions
          </h1>
          <p className="text-xs text-foreground/60">
            Gestion du statut comptable (Payée d'avance / à la livraison) et suivi logistique par livreur
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">En attente</div>
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Livrées ({paidCount} Payées)</div>
            <div className="text-lg font-bold tabular-nums text-emerald-400">{deliveredCount}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gold/90">CA COMPTABILISÉ</div>
            <div className="text-sm sm:text-base font-bold tabular-nums text-gold">{formatFCFA(deliveredRevenue)}</div>
          </div>
        </div>
      </div>

      {/* Filters Bar & Bulk Action Toolbar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-zinc-900 border border-white/10 text-xs">
            {[
              { id: 'ALL', label: 'Toutes' },
              { id: 'PENDING', label: 'En attente' },
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

          {/* Date Filter & Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
            <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded-xl border border-white/10 text-xs">
              <Calendar className="h-3.5 w-3.5 text-gold" />
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="bg-transparent text-foreground text-xs font-semibold outline-none border-none cursor-pointer [color-scheme:dark]"
              />
              {filterDate === getTodayDateStr() ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-gold/20 text-gold">Aujourd'hui</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setFilterDate(getTodayDateStr())}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white/10 hover:bg-white/20 text-foreground transition"
                >
                  Aujourd'hui
                </button>
              )}
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate('')}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-foreground/70 hover:text-foreground transition flex items-center gap-1"
                  title="Afficher toutes les dates"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Toutes</span>
                </button>
              )}
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
              <input
                type="text"
                placeholder="Rechercher nom, livreur, tél, N°..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-900 py-1.5 pl-9 pr-3 text-xs text-foreground placeholder-foreground/30 outline-none focus:border-gold/60"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Driver Filter Pills ("Filtres livreurs en cours") */}
        {activeDrivers.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs bg-zinc-900/90 p-2 rounded-xl border border-white/10 animate-fadeIn">
            <span className="text-gold font-bold flex items-center gap-1 shrink-0 px-1">
              <UserCheck className="h-3.5 w-3.5" /> Course en cours par livreur :
            </span>

            <button
              onClick={() => setSelectedDriverFilter('ALL')}
              className={cx(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition',
                selectedDriverFilter === 'ALL'
                  ? 'bg-gold text-black font-bold shadow'
                  : 'bg-white/5 text-foreground/70 hover:bg-white/10'
              )}
            >
              Tous ({deliveries.length})
            </button>

            {activeDrivers.map(driverName => {
              const driverInProgCount = deliveries.filter(d => (d.deliveryPerson || '').trim().toLowerCase() === driverName.toLowerCase() && d.deliveryStatus === 'IN_DELIVERY').length;
              const isSelected = selectedDriverFilter.toLowerCase() === driverName.toLowerCase();

              return (
                <button
                  key={driverName}
                  onClick={() => setSelectedDriverFilter(driverName)}
                  className={cx(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border',
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-lg ring-2 ring-blue-400/30'
                      : 'bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/20'
                  )}
                >
                  <span>🛵 {driverName}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-400/20 text-amber-300 font-bold">
                    {driverInProgCount} en cours
                  </span>
                </button>
              );
            })}

            {selectedDriverFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedDriverFilter('ALL')}
                className="text-[11px] text-foreground/50 hover:text-foreground underline ml-1"
              >
                Effacer filtre livreur
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Banner when items are selected */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gold/15 border border-gold/40 text-xs animate-fadeIn flex-wrap gap-2">
          <div className="flex items-center gap-2 font-bold text-gold">
            <CheckSquare className="h-4 w-4" />
            <span>{selectedIds.length} livraison(s) sélectionnée(s)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleUpdateStatus(null, null, { action: 'PAY' })}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow flex items-center gap-1.5 transition"
            >
              <DollarSign className="h-3.5 w-3.5" /> Marquer comme Payées
            </button>

            <button
              onClick={() => handleUpdateStatus('IN_DELIVERY')}
              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold shadow flex items-center gap-1.5 transition"
            >
              <Truck className="h-3.5 w-3.5" /> Attribuer Livreur / En cours
            </button>

            <button
              onClick={() => handleUnassignDriver()}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1.5 transition"
              title="Retirer du livreur et remettre en attente"
            >
              <UserMinus className="h-3.5 w-3.5" /> Retirer du livreur
            </button>

            <button
              onClick={() => openPaymentModal('DELIVERED', 'BULK')}
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
                  {displayedDeliveries.length > 0 && selectedIds.length === displayedDeliveries.length ? (
                    <CheckSquare className="h-4 w-4 text-gold" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-3 py-3">N° Livraison</th>
              <th className="px-3 py-3">Client & Livreur</th>
              <th className="px-3 py-3 hidden sm:table-cell">Adresse</th>
              <th className="px-3 py-3 text-right">Montant</th>
              <th className="px-3 py-3 text-center">Comptabilité & Statut</th>
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

            {!loading && displayedDeliveries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-foreground/40">
                  Aucune livraison trouvée.
                </td>
              </tr>
            )}

            {!loading && displayedDeliveries.map(del => {
              const isSelected = selectedIds.includes(del.id);
              const clientName = del.clientName || '—';
              const clientPhone = del.clientPhone || '—';
              const driverName = del.deliveryPerson || null;
              const isPaid = del.isPaid || del.deliveryStatus === 'DELIVERED';

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
                    {driverName && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                        <span>🛵 Livreur :</span>
                        <span className="font-bold">{driverName}</span>
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

                  <td className="px-3 py-3 text-center space-y-1">
                    <div>{getPaymentBadge(del)}</div>
                    <div>{getLogisticsBadge(del.deliveryStatus)}</div>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {/* Action 1: Marquer comme Payée (Paiement d'avance / Expédition) */}
                      {!isPaid && del.deliveryStatus !== 'CANCELLED' && (
                        <button
                          onClick={() => handleUpdateStatus(null, del, { action: 'PAY' })}
                          title="Marquer Payée (Encaisser d'avance pour expédition)"
                          className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="hidden xl:inline">Encaisser</span>
                        </button>
                      )}

                      {/* Action 2: Passer en cours (Attribuer livreur) - Uniquement si EN ATTENTE */}
                      {del.deliveryStatus === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus('IN_DELIVERY', del)}
                          title="Passer en cours de livraison (Attribuer livreur)"
                          className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          <span className="hidden xl:inline">En cours</span>
                        </button>
                      )}

                      {/* Action 3: Retirer du livreur (Désaffecter) */}
                      {driverName && del.deliveryStatus === 'IN_DELIVERY' && (
                        <button
                          onClick={() => handleUnassignDriver(del)}
                          title="Retirer du livreur (Remettre en attente sans annuler)"
                          className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Action 4: Marquer comme Livrée */}
                      {del.deliveryStatus !== 'DELIVERED' && del.deliveryStatus !== 'CANCELLED' && (
                        <button
                          onClick={() => openPaymentModal('DELIVERED', del)}
                          title="Marquer comme Livrée"
                          className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow transition"
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

      {/* Driver Assignment Modal (When marking IN_DELIVERY) */}
      {driverModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-zinc-900 border border-blue-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-400" />
              {targetInDeliveryItem === 'BULK' ? `Attribution du livreur (${selectedIds.length} livraisons)` : 'Attribution du livreur'}
            </h3>

            <p className="text-xs text-foreground/70 leading-relaxed">
              Précisez le nom du livreur qui prend en charge la livraison. Un filtre temporaire avec son nom sera créé automatiquement.
            </p>

            {/* Input with Auto-complete */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-gold" /> Nom du livreur :
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="Tapez le nom du livreur..."
                  value={driverInput}
                  onChange={e => {
                    setDriverInput(e.target.value);
                    setShowDriverSuggestions(true);
                  }}
                  onFocus={() => setShowDriverSuggestions(true)}
                  className="w-full rounded-xl border border-white/20 bg-zinc-950 py-2 px-3 text-sm text-foreground placeholder-foreground/40 outline-none focus:border-blue-400"
                />

                {/* Suggestions dropdown */}
                {showDriverSuggestions && matchingDriverSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-white/15 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 divide-y divide-white/[0.06]">
                    {matchingDriverSuggestions.map(driver => (
                      <button
                        key={driver.id || driver.name}
                        type="button"
                        onClick={() => {
                          setDriverInput(driver.name);
                          setShowDriverSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-blue-500/20 hover:text-blue-300 font-medium transition flex items-center justify-between"
                      >
                        <span>🛵 {driver.name}</span>
                        {driver.phone && <span className="text-[10px] text-foreground/50 font-mono">{driver.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-foreground/40 italic">
                💡 Les noms sont enregistrés en BD pour autocomplétion future.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                disabled={submitting}
                onClick={() => setDriverModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-foreground/70"
              >
                Annuler
              </button>
              <button
                disabled={submitting || !driverInput.trim()}
                onClick={confirmDriverAssignment}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs shadow flex items-center gap-1.5"
              >
                {submitting ? 'Enregistrement...' : '🚀 Valider & Passer en cours'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Marking as PAYEE or DELIVERED (Confirms Payment Method) */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-gold/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              {paymentActionType === 'PAY_ONLY' ? 'Enregistrement du Paiement d\'avance' : 'Validation de la livraison'}
            </h3>

            <p className="text-xs text-foreground/70 leading-relaxed">
              ⚠️ <strong>Confirmation comptable</strong> : Le passage au statut <strong>PAYÉE</strong> va intégrer immédiatement le montant dans la comptabilité et le rapport Z.
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
                onClick={() => {
                  if (paymentActionType === 'PAY_ONLY') {
                    handleUpdateStatus(null, null, { action: 'PAY', paymentConfirmed: true });
                  } else {
                    handleUpdateStatus('DELIVERED', null, { paymentConfirmed: true });
                  }
                }}
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

              {/* Status & Client & Driver Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground/60">Statut Comptable :</span>
                  <div>{getPaymentBadge(selectedDelivery)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground/60">Statut Logistique :</span>
                  <div>{getLogisticsBadge(selectedDelivery.deliveryStatus)}</div>
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
                  {selectedDelivery.deliveryPerson && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <div className="flex items-center gap-2 text-sky-400 font-medium">
                        <Truck className="h-4 w-4 shrink-0" />
                        <span>Livreur attribué : <strong>{selectedDelivery.deliveryPerson}</strong></span>
                      </div>
                      <button
                        onClick={() => {
                          const del = selectedDelivery;
                          setSelectedDelivery(null);
                          handleUnassignDriver(del);
                        }}
                        className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30"
                      >
                        Retirer du livreur
                      </button>
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
              <div className="rounded-xl bg-gold/10 border border-gold/30 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gold/80 font-bold uppercase">Total Articles (Comptabilité)</div>
                    <div className="text-xs text-foreground/60">Règlement : {selectedDelivery.paymentMethod || 'Espèces'}</div>
                  </div>
                  <div className="text-lg font-bold text-gold font-mono">
                    {formatFCFA(selectedDelivery.totalAmount)}
                  </div>
                </div>

                {Number(selectedDelivery.deliveryFee || 0) > 0 && (
                  <>
                    <div className="border-t border-gold/20 pt-2 flex items-center justify-between text-xs font-semibold">
                      <span className="text-sky-300">🚚 Frais de transport (Non comptabilisé) :</span>
                      <span className="font-mono text-sky-300">{formatFCFA(selectedDelivery.deliveryFee)}</span>
                    </div>
                    <div className="border-t border-gold/30 pt-2 flex items-center justify-between text-sm font-black">
                      <span className="text-white">TOTAL À PAYER PAR LE CLIENT :</span>
                      <span className="font-mono text-emerald-400">{formatFCFA(Number(selectedDelivery.totalAmount) + Number(selectedDelivery.deliveryFee))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={() => triggerPrint(selectedDelivery)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-foreground flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> Ticket
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {!selectedDelivery.isPaid && selectedDelivery.deliveryStatus !== 'DELIVERED' && (
                  <button
                    onClick={() => {
                      const del = selectedDelivery;
                      setSelectedDelivery(null);
                      handleUpdateStatus(null, del, { action: 'PAY' });
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <DollarSign className="h-4 w-4" /> Encaisser d'avance
                  </button>
                )}

                {selectedDelivery.deliveryStatus === 'PENDING' && (
                  <button
                    onClick={() => {
                      const del = selectedDelivery;
                      setSelectedDelivery(null);
                      openInDeliveryModal(del);
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <Truck className="h-4 w-4" /> Passer en cours
                  </button>
                )}

                {selectedDelivery.deliveryStatus !== 'DELIVERED' && (
                  <button
                    onClick={() => {
                      const del = selectedDelivery;
                      setSelectedDelivery(null);
                      openPaymentModal('DELIVERED', del);
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" /> Marquer Livrée
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
