import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, DollarSign, CreditCard, Calendar, Truck, PackageCheck, CheckCircle, Receipt, Eye, Printer, X, UserCheck, Clock } from 'lucide-react';
import { formatFCFA, getTodayDateStr, cx, getPaymentMethodLabel, triggerPrint, isReservationInvoice, isDeliveryInvoice } from '../utils/helpers';
import { API_BASE } from '../utils/constants';
import DeliveriesView from './DeliveriesView';

export default function CashierStatsView({ currentUser }) {
  const [period, setPeriod] = useState('today'); // 'today' | 'custom' | 'week'
  const [customDate, setCustomDate] = useState(getTodayDateStr());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('ALL'); // 'ALL' | 'DIRECT' | 'DELIVERIES' | 'RESERVATIONS'

  const [invoices, setInvoices] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [onlyMyOps, setOnlyMyOps] = useState(true);
  const [includeDeliveryFees, setIncludeDeliveryFees] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetchStats();
      fetchDetails();
    }
  }, [currentUser?.id, period, customDate, onlyMyOps]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchStats();
      fetchDetails();
    };
    window.addEventListener('pos:dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('pos:dashboard-refresh', handleRefresh);
  }, [currentUser?.id, period, customDate, onlyMyOps]);

  const getDateParams = () => {
    const now = new Date();
    let startDateStr = '', endDateStr = '';
    if (period === 'today') {
      const todayStr = getTodayDateStr();
      startDateStr = todayStr;
      endDateStr = todayStr;
    } else if (period === 'custom') {
      startDateStr = customDate || getTodayDateStr();
      endDateStr = customDate || getTodayDateStr();
    } else if (period === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      startDateStr = getTodayDateStr(d);
      endDateStr = getTodayDateStr();
    } else if (period === 'all') {
      startDateStr = '';
      endDateStr = '';
    }
    return { startDateStr, endDateStr };
  };

  const { startDateStr, endDateStr } = getDateParams();

  const fetchStats = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const cashierParam = onlyMyOps ? `cashierId=${currentUser.id}` : '';
      const dateParams = (startDateStr && endDateStr) ? `startDate=${startDateStr}&endDate=${endDateStr}` : '';
      const queryStr = [dateParams, cashierParam].filter(Boolean).join('&');
      const res = await fetch(`${API_BASE}/stats${queryStr ? '?' + queryStr : ''}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.filtered || data.today);
      }
    } catch (e) {
      console.error('Fetch cashier stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async () => {
    if (!currentUser?.id) return;
    try {
      const cashierParam = onlyMyOps ? `cashierId=${currentUser.id}` : '';
      const dateParams = (startDateStr && endDateStr) ? `startDate=${startDateStr}&endDate=${endDateStr}` : '';
      const baseQuery = [dateParams, cashierParam].filter(Boolean).join('&');
      const invQuery = ['includeAllDeliveries=true', baseQuery].filter(Boolean).join('&');

      const [invRes, delRes, resRes] = await Promise.all([
        fetch(`${API_BASE}/invoices?${invQuery}`),
        fetch(`${API_BASE}/deliveries${baseQuery ? '?' + baseQuery : ''}`),
        fetch(`${API_BASE}/reservations${baseQuery ? '?' + baseQuery : ''}`)
      ]);
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(Array.isArray(invData) ? invData : []);
      }
      if (delRes.ok) {
        const delData = await delRes.json();
        setDeliveries(Array.isArray(delData) ? delData : []);
      }
      if (resRes.ok) {
        const resData = await resRes.json();
        setReservations(Array.isArray(resData) ? resData : []);
      }
    } catch (e) {
      console.error('Fetch cashier details error:', e);
    }
  };

  // Determine user permissions / role for section visibility
  const userPermissions = currentUser?.role === 'ADMIN' ? 'ALL' : (currentUser?.permissions || 'ALL');
  const isCustomerService = userPermissions === 'CUSTOMER_SERVICE';
  const isDirectSaleOnly = userPermissions === 'DIRECT_SALE';

  // Filtered lists for Dashboard
  const directInvoices = isCustomerService ? [] : invoices.filter(inv => !isReservationInvoice(inv) && !isDeliveryInvoice(inv));
  const reservationInvoices = reservations;
  // Dashboard requirement: Filter deliveries that are PAYÉES OU LIVRÉES
  const deliveryInvoices = isDirectSaleOnly ? [] : invoices.filter(inv => isDeliveryInvoice(inv) && (inv.isPaid || inv.deliveryStatus === 'DELIVERED'));

  // Synthèse des Ventes Directes calculations
  const directTotalValue = directInvoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
  const directInvoiceCount = directInvoices.length;
  const directAvgBasket = directInvoiceCount > 0 ? directTotalValue / directInvoiceCount : 0;

  // Synthèse des Réservations calculations
  const activeReservations = reservations.filter(r => r.status !== 'CANCELLED');
  const resTotalValue = activeReservations.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
  const resTotalPaid = activeReservations.reduce((sum, r) => {
    if (r.totalPaid !== undefined) return sum + (parseFloat(r.totalPaid) || 0);
    const sumPayments = r.payments?.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) || 0;
    return sum + sumPayments;
  }, 0);
  const resTotalRemaining = activeReservations.reduce((sum, r) => {
    const paid = r.totalPaid !== undefined ? (parseFloat(r.totalPaid) || 0) : (r.payments?.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) || 0);
    const total = parseFloat(r.totalAmount) || 0;
    return sum + Math.max(0, total - paid);
  }, 0);

  const totalOperationsCount = directInvoices.length + deliveryInvoices.length + reservationInvoices.length;

  const getDisplayedList = () => {
    switch (activeFilterTab) {
      case 'DIRECT':
        return directInvoices.map(item => ({ ...item, _type: 'DIRECT' }));
      case 'DELIVERIES':
        return deliveryInvoices.map(item => ({ ...item, _type: 'DELIVERY' }));
      case 'RESERVATIONS':
        return reservationInvoices.map(item => ({
          ...item,
          _type: 'RESERVATION',
          totalAmount: item.totalPaid !== undefined ? item.totalPaid : (item.payments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) || 0)
        }));
      case 'ALL':
      default:
        return [
          ...directInvoices.map(item => ({ ...item, _type: 'DIRECT' })),
          ...deliveryInvoices.map(item => ({ ...item, _type: 'DELIVERY' })),
          ...reservationInvoices.map(item => ({
            ...item,
            _type: 'RESERVATION',
            totalAmount: item.totalPaid !== undefined ? item.totalPaid : (item.payments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) || 0)
          }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  };

  const displayedList = getDisplayedList();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white/[0.01] p-2 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-gold" />
          <h2 className="text-sm font-bold text-foreground">Mon Tableau de Bord Ventes</h2>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-400 uppercase">
            Session Active ({currentUser?.name || 'Caissière'})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => { setPeriod('today'); setCustomDate(getTodayDateStr()); }}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                period === 'today' ? "bg-gold text-black shadow" : "text-foreground/60 hover:text-foreground"
              )}
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                period === 'week' ? "bg-gold text-black shadow" : "text-foreground/60 hover:text-foreground"
              )}
            >
              Cette Semaine
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={cx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer",
                period === 'all' ? "bg-gold text-black shadow" : "text-foreground/60 hover:text-foreground"
              )}
            >
              Toutes les dates
            </button>
          </div>

          {/* Custom Date Input */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-foreground/90 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gold shrink-0" />
              <span>Choisir une date :</span>
            </label>
            <input
              type="date"
              value={period === 'custom' ? customDate : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setCustomDate(e.target.value);
                  setPeriod('custom');
                }
              }}
              className={cx(
                "bg-zinc-800 text-white font-bold border-2 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer transition shadow-md",
                period === 'custom' ? "border-gold bg-gold/20 text-gold" : "border-white/30 hover:border-gold/60 text-foreground"
              )}
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyMyOps(v => !v)}
            title={onlyMyOps ? 'Afficher toutes les opérations du magasin' : 'Afficher uniquement mes opérations'}
            className={cx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap cursor-pointer',
              onlyMyOps
                ? 'bg-gold/20 border-gold/50 text-gold shadow-sm'
                : 'bg-zinc-950 border-white/10 text-foreground/60 hover:text-foreground hover:border-white/20'
            )}
          >
            <UserCheck className="h-3.5 w-3.5" />
            {onlyMyOps ? 'Mes opérations' : 'Toutes les opérations'}
          </button>

          <button
            type="button"
            onClick={() => { fetchStats(); fetchDetails(); }}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-foreground/70 transition cursor-pointer border border-white/5"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {loading && !stats ? (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            Chargement des statistiques...
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Chiffre d'Affaires Card with AVEC/SANS Frais Toggle */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gold/15 to-transparent p-4 relative overflow-hidden shadow-lg flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Chiffre d'Affaires Encaissé</div>
                  <button
                    type="button"
                    onClick={() => setIncludeDeliveryFees(v => !v)}
                    className={cx(
                      "px-2 py-0.5 rounded-lg text-[9px] font-extrabold transition cursor-pointer border shrink-0",
                      includeDeliveryFees
                        ? "bg-gold/20 text-gold border-gold/40 hover:bg-gold/30"
                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                    )}
                    title={includeDeliveryFees ? "Cliquer pour afficher SANS les frais de livraison" : "Cliquer pour afficher AVEC les frais de livraison"}
                  >
                    {includeDeliveryFees ? 'AVEC Frais' : 'SANS Frais'}
                  </button>
                </div>

                <div>
                  <div className="text-xl font-black text-gold mt-1.5">
                    {formatFCFA(includeDeliveryFees ? (stats.total || 0) : ((stats.total || 0) - (stats.deliveryFeesTotal || 0)))}
                  </div>
                  <div className="text-[9px] text-foreground/40 mt-1 leading-relaxed">
                    {(() => {
                      const directSales = (stats.total || 0) - (stats.reservationTotal || 0) - (stats.deliveryTotalWithFees || 0);
                      const resAcomptes = stats.reservationTotal || 0;
                      const delivWithFees = stats.deliveryTotalWithFees || 0;
                      const delivWithout = (stats.deliveryTotalWithoutFees || 0);
                      const parts = [];
                      if (!isCustomerService && directSales > 0) parts.push(`Ventes: ${formatFCFA(directSales)}`);
                      if (resAcomptes > 0) parts.push(`Acomptes: ${formatFCFA(resAcomptes)}`);
                      if (!isDirectSaleOnly && delivWithFees > 0) {
                        parts.push(includeDeliveryFees
                          ? `Livr. (avec frais): ${formatFCFA(delivWithFees)}`
                          : `Livr. (sans frais): ${formatFCFA(delivWithout)}`
                        );
                      }
                      return parts.join(' + ') || '—';
                    })()}
                  </div>
                </div>
              </div>

              {/* Cash Card */}
              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 relative overflow-hidden shadow flex flex-col justify-between">
                <div className="absolute top-3 right-3 text-emerald-400/20">
                  <DollarSign className="h-10 w-10" />
                </div>
                <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Espèces (Cash)</div>
                <div>
                  <div className="text-xl font-black text-emerald-400 mt-1.5">{formatFCFA(stats.cash || 0)}</div>
                  <div className="text-[9px] text-foreground/40 mt-1">
                    {isCustomerService
                      ? `Livraisons: ${formatFCFA(stats.directCash || 0)} | Rés: ${formatFCFA(stats.resCash || 0)}`
                      : `Ventes: ${formatFCFA(stats.directCash || 0)} | Rés: ${formatFCFA(stats.resCash || 0)}`
                    }
                  </div>
                </div>
              </div>

              {/* Mobile Money Card */}
              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 relative overflow-hidden shadow flex flex-col justify-between">
                <div className="absolute top-3 right-3 text-amber-500/20">
                  <CreditCard className="h-10 w-10" />
                </div>
                <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Mobile Money</div>
                <div>
                  <div className="text-xl font-black text-amber-400 mt-1.5">{formatFCFA(stats.online || 0)}</div>
                  <div className="text-[9px] text-foreground/40 mt-1">
                    {isCustomerService
                      ? `Livraisons: ${formatFCFA(stats.directOnline || 0)} | Rés: ${formatFCFA(stats.resOnline || 0)}`
                      : `Ventes: ${formatFCFA(stats.directOnline || 0)} | Rés: ${formatFCFA(stats.resOnline || 0)}`
                    }
                  </div>
                </div>
              </div>

              {/* Orange Money Card */}
              <div className="rounded-2xl border border-white/5 bg-black/40 p-4 relative overflow-hidden shadow flex flex-col justify-between">
                <div className="absolute top-3 right-3 text-orange-500/20">
                  <CreditCard className="h-10 w-10" />
                </div>
                <div className="text-[10px] text-foreground/50 font-bold uppercase tracking-wider">Orange Money</div>
                <div>
                  <div className="text-xl font-black text-orange-400 mt-1.5">{formatFCFA(stats.orangeMoney || 0)}</div>
                  <div className="text-[9px] text-foreground/40 mt-1">
                    {isCustomerService
                      ? `Livraisons: ${formatFCFA(stats.directOrange || 0)} | Rés: ${formatFCFA(stats.resOrange || 0)}`
                      : `Ventes: ${formatFCFA(stats.directOrange || 0)} | Rés: ${formatFCFA(stats.resOrange || 0)}`
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Focus spécifique sur les Ventes Directes (Masqué pour le service livraison) */}
            {!isCustomerService && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <Receipt className="h-4 w-4 text-emerald-400" />
                  <span>Synthèse des Ventes Directes ({directInvoiceCount} vente{directInvoiceCount > 1 ? 's' : ''} encaissée{directInvoiceCount > 1 ? 's' : ''})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                    <div className="text-[10px] font-bold uppercase text-sky-300">Nombre de Factures</div>
                    <div className="text-base font-black text-sky-400 mt-1">{directInvoiceCount}</div>
                    <div className="text-[9px] text-sky-300/60 mt-0.5">Total des ventes comptant validées</div>
                  </div>

                  <div className="rounded-xl border border-gold/40 bg-gold/15 p-3">
                    <div className="text-[10px] font-bold uppercase text-gold">Panier Moyen</div>
                    <div className="text-base font-black text-gold mt-1">{formatFCFA(directAvgBasket)}</div>
                    <div className="text-[9px] text-gold/60 mt-0.5">Montant moyen par vente directe</div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3">
                    <div className="text-[10px] font-bold uppercase text-emerald-300">Total Encaissé Ventes</div>
                    <div className="text-base font-black text-emerald-400 mt-1">{formatFCFA(directTotalValue)}</div>
                    <div className="text-[9px] text-emerald-300/60 mt-0.5">Chiffre d'affaires des ventes directes</div>
                  </div>
                </div>
              </div>
            )}

            {/* Focus spécifique sur les Livraisons (Masqué pour les caissiers de vente directe) */}
            {!isDirectSaleOnly && (
              <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <Truck className="h-4 w-4" />
                  <span>Synthèse des Livraisons ({stats.deliveryCount || 0} livraisons encaissées)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="text-[10px] font-bold uppercase text-emerald-300">Total SANS Frais</div>
                    <div className="text-base font-black text-emerald-400 mt-1">{formatFCFA(stats.deliveryTotalWithoutFees || 0)}</div>
                    <div className="text-[9px] text-emerald-300/60 mt-0.5">Montant des marchandises uniquement</div>
                  </div>

                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                    <div className="text-[10px] font-bold uppercase text-sky-300">Total Frais de Livraison</div>
                    <div className="text-base font-black text-sky-400 mt-1">{formatFCFA(stats.deliveryFeesTotal || 0)}</div>
                    <div className="text-[9px] text-sky-300/60 mt-0.5">Frais de transport encaissés</div>
                  </div>

                  <div className="rounded-xl border border-gold/40 bg-gold/15 p-3">
                    <div className="text-[10px] font-bold uppercase text-gold">Total AVEC Frais (Global)</div>
                    <div className="text-base font-black text-gold mt-1">{formatFCFA(stats.deliveryTotalWithFees || 0)}</div>
                    <div className="text-[9px] text-gold/60 mt-0.5">Marchandises + Frais de livraison</div>
                  </div>
                </div>
              </div>
            )}

            {/* Focus spécifique sur les Réservations & Acomptes */}
            <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                <Clock className="h-4 w-4 text-purple-400" />
                <span>Synthèse des Réservations ({activeReservations.length} réservation{activeReservations.length > 1 ? 's' : ''})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
                  <div className="text-[10px] font-bold uppercase text-purple-300">Valeur Totale Réservée</div>
                  <div className="text-base font-black text-purple-300 mt-1">{formatFCFA(resTotalValue)}</div>
                  <div className="text-[9px] text-purple-300/60 mt-0.5">Montant total des marchandises réservées</div>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="text-[10px] font-bold uppercase text-amber-300">Solde Restant Dû</div>
                  <div className="text-base font-black text-amber-400 mt-1">{formatFCFA(resTotalRemaining)}</div>
                  <div className="text-[9px] text-amber-300/60 mt-0.5">Reste à percevoir pour solder</div>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="text-[10px] font-bold uppercase text-emerald-300">Acomptes & Règlements Perçus</div>
                  <div className="text-base font-black text-emerald-400 mt-1">{formatFCFA(resTotalPaid)}</div>
                  <div className="text-[9px] text-emerald-300/60 mt-0.5">Montant déjà encaissé en caisse</div>
                </div>
              </div>
            </div>

            {/* Interactive Category Filter Cards (Boutons de filtre) */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                Filtrer vos opérations enregistrées :
              </div>

              <div className={cx(
                "grid gap-3",
                isCustomerService || isDirectSaleOnly ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"
              )}>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('ALL')}
                  className={cx(
                    "p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between",
                    activeFilterTab === 'ALL'
                      ? "bg-gold/15 border-gold shadow-lg shadow-gold/10"
                      : "bg-black/20 border-white/5 hover:bg-white/5"
                  )}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Toutes les opérations</div>
                  <div className={cx("text-lg font-black mt-1", activeFilterTab === 'ALL' ? "text-gold" : "text-foreground")}>
                    {totalOperationsCount}
                  </div>
                </button>

                {!isCustomerService && (
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('DIRECT')}
                    className={cx(
                      "p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between",
                      activeFilterTab === 'DIRECT'
                        ? "bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/10"
                        : "bg-black/20 border-white/5 hover:bg-white/5"
                    )}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Factures Directes</div>
                    <div className={cx("text-lg font-black mt-1", activeFilterTab === 'DIRECT' ? "text-emerald-400" : "text-foreground")}>
                      {directInvoices.length}
                    </div>
                  </button>
                )}

                {!isDirectSaleOnly && (
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('DELIVERIES')}
                    className={cx(
                      "p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between",
                      activeFilterTab === 'DELIVERIES'
                        ? "bg-sky-500/15 border-sky-500 shadow-lg shadow-sky-500/10"
                        : "bg-black/20 border-white/5 hover:bg-white/5"
                    )}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Livraisons ({deliveryInvoices.length})</div>
                    <div className={cx("text-lg font-black mt-1", activeFilterTab === 'DELIVERIES' ? "text-sky-400" : "text-foreground")}>
                      {deliveryInvoices.length}
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveFilterTab('RESERVATIONS')}
                  className={cx(
                    "p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between",
                    activeFilterTab === 'RESERVATIONS'
                      ? "bg-purple-500/15 border-purple-500 shadow-lg shadow-purple-500/10"
                      : "bg-black/20 border-white/5 hover:bg-white/5"
                  )}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Acomptes Réservations</div>
                  <div className={cx("text-lg font-black mt-1", activeFilterTab === 'RESERVATIONS' ? "text-purple-400" : "text-foreground")}>
                    {reservationInvoices.length}
                  </div>
                </button>
              </div>
            </div>

            {/* List Table or Full Deliveries Management View */}
            {activeFilterTab === 'DELIVERIES' ? (
              <div className="rounded-2xl border border-sky-500/20 bg-black/40 p-2 overflow-hidden shadow-xl">
                <DeliveriesView
                  currentUser={currentUser}
                  cashierId={currentUser.id}
                  hideTopTotals={true}
                  onlyPaidOrDelivered={true}
                  startDate={startDateStr}
                  endDate={endDateStr}
                />
              </div>
            ) : (
              <div className="bg-black/20 rounded-2xl border border-white/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gold" />
                    <span>Détail des opérations ({displayedList.length})</span>
                  </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 shadow-inner relative">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-zinc-900 text-[10px] uppercase text-foreground/50 font-semibold border-b border-white/10 z-10">
                      <tr>
                        <th className="p-2.5">Type & N° Document</th>
                        <th className="p-2.5">Date & Heure</th>
                        <th className="p-2.5">Client</th>
                        {activeFilterTab === 'ALL' && <th className="p-2.5">Livreur / Info</th>}
                        <th className="p-2.5">Règlement</th>

                        {activeFilterTab === 'DIRECT' && (
                          <th className="p-2.5 text-right text-emerald-400 font-bold">Montant Total</th>
                        )}
                        {activeFilterTab === 'RESERVATIONS' && (
                          <th className="p-2.5 text-right text-purple-400 font-bold">Acompte Versé</th>
                        )}
                        {activeFilterTab === 'ALL' && (
                          <>
                            <th className="p-2.5 text-right text-emerald-400 font-bold">Montant Commande</th>
                            <th className="p-2.5 text-right text-sky-400 font-bold">Frais Livraison</th>
                            <th className="p-2.5 text-right text-gold font-black">Total (AVEC Frais)</th>
                          </>
                        )}
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {displayedList.length === 0 ? (
                        <tr>
                          <td colSpan={activeFilterTab === 'ALL' ? 9 : 6} className="text-center py-8 text-foreground/40 italic">
                            Aucune transaction trouvée pour cette catégorie.
                          </td>
                        </tr>
                      ) : (
                        displayedList.map((item) => {
                          const itemsAmt = Number(item.totalAmount) || 0;
                          const feeAmt = Number(item.deliveryFee) || 0;
                          const totalAmtWithFee = itemsAmt + feeAmt;
                          // For reservations, get the last payment method
                          const itemPaymentMethod = item._type === 'RESERVATION'
                            ? (item.payments && item.payments.length > 0 ? item.payments[item.payments.length - 1].paymentMethod : null)
                            : item.paymentMethod;
                          const docNumber = item.invoiceNumber || item.deliveryNo || item.reservationNo;

                          return (
                            <tr key={item.id} className="hover:bg-white/[0.03] transition">
                              <td className="p-2.5 font-mono font-bold text-gold">
                                <div>{docNumber}</div>
                                {item._type === 'DIRECT' && (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    Vente Directe
                                  </span>
                                )}
                                {item._type === 'DELIVERY' && (
                                  <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                    🚚 Livraison ({item.deliveryStatus === 'DELIVERED' ? 'Livrée' : item.deliveryStatus || 'En cours'})
                                  </span>
                                )}
                                {item._type === 'RESERVATION' && (
                                  <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                    🏷️ Réservation ({item.payments?.length || 0} versement{(item.payments?.length || 0) > 1 ? 's' : ''})
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-foreground/60 text-[11px]">
                                {new Date(item.createdAt).toLocaleString('fr-FR')}
                              </td>
                              <td className="p-2.5 font-semibold text-foreground">
                                {item.clientName || 'Client de passage'}
                              </td>

                              {activeFilterTab === 'ALL' && (
                                <td className="p-2.5 text-foreground/70 text-[11px]">
                                  {item.deliveryPerson ? `🛵 ${item.deliveryPerson}` : item.deliveryAddress || '-'}
                                </td>
                              )}

                              <td className="p-2.5 text-foreground/80 font-medium">
                                {getPaymentMethodLabel(itemPaymentMethod)}
                              </td>

                              {activeFilterTab === 'DIRECT' && (
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-400 text-sm">
                                  {formatFCFA(itemsAmt)}
                                </td>
                              )}

                              {activeFilterTab === 'RESERVATIONS' && (
                                <td className="p-2.5 text-right font-mono font-bold text-purple-400 text-sm">
                                  {formatFCFA(itemsAmt)}
                                </td>
                              )}

                              {activeFilterTab === 'ALL' && (
                                <>
                                  <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                                    {formatFCFA(itemsAmt)}
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-bold text-sky-400">
                                    {formatFCFA(feeAmt)}
                                  </td>
                                  <td className="p-2.5 font-mono font-black text-right text-gold text-sm">
                                    {formatFCFA(totalAmtWithFee)}
                                  </td>
                                </>
                              )}

                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedItem(item)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/80 text-[11px] font-semibold transition cursor-pointer border border-white/10"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span>Détails</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => triggerPrint(item)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/15 hover:bg-gold/30 text-gold text-[11px] font-bold transition cursor-pointer border border-gold/30"
                                    title="Réimprimer le reçu"
                                  >
                                    <Printer className="h-3 w-3" />
                                    <span>Ticket</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-zinc-900 border-t-2 border-gold/40 text-xs font-bold z-10 shadow-2xl">
                      <tr className="bg-zinc-900/95 backdrop-blur">
                        <td colSpan={activeFilterTab === 'ALL' ? 5 : 4} className="p-2.5 text-gold uppercase tracking-wider font-extrabold">
                          TOTAL {activeFilterTab === 'DIRECT' ? 'VENTES DIRECTES' : activeFilterTab === 'RESERVATIONS' ? 'ACOMPTES RÉSERVATIONS' : 'TOUTES OPÉRATIONS'} ({displayedList.length})
                        </td>

                        {activeFilterTab === 'DIRECT' && (
                          <td className="p-2.5 text-right font-mono text-emerald-400 text-sm font-black">
                            {formatFCFA(displayedList.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0))}
                          </td>
                        )}

                        {activeFilterTab === 'RESERVATIONS' && (
                          <td className="p-2.5 text-right font-mono text-purple-400 text-sm font-black">
                            {formatFCFA(displayedList.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0))}
                          </td>
                        )}

                        {activeFilterTab === 'ALL' && (
                          <>
                            <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">
                              {formatFCFA(displayedList.reduce((sum, item) => {
                                if (item._type === 'DELIVERY') {
                                  const isPaid = item.isPaid || item.deliveryStatus === 'DELIVERED';
                                  if (!isPaid) return sum;
                                  return sum + (Number(item.totalAmount) || 0);
                                }
                                const base = item._type === 'RESERVATION' ? (item.totalPaid || item.totalAmount || 0) : item.totalAmount;
                                return sum + (Number(base) || 0);
                              }, 0))}
                            </td>
                            <td className="p-2.5 text-right font-mono text-sky-400 font-bold">
                              {formatFCFA(displayedList.reduce((sum, item) => {
                                if (item._type === 'DELIVERY') {
                                  const isPaid = item.isPaid || item.deliveryStatus === 'DELIVERED';
                                  if (!isPaid) return sum;
                                }
                                return sum + (Number(item.deliveryFee) || 0);
                              }, 0))}
                            </td>
                            <td className="p-2.5 text-right font-mono text-gold text-sm font-black">
                              {formatFCFA(displayedList.reduce((sum, item) => {
                                if (item._type === 'DELIVERY') {
                                  const isPaid = item.isPaid || item.deliveryStatus === 'DELIVERED';
                                  if (!isPaid) return sum;
                                  return sum + (Number(item.totalAmount) || 0) + (Number(item.deliveryFee) || 0);
                                }
                                const base = Number(item._type === 'RESERVATION' ? (item.totalPaid || item.totalAmount || 0) : item.totalAmount) || 0;
                                const fee = Number(item.deliveryFee) || 0;
                                return sum + base + fee;
                              }, 0))}
                            </td>
                          </>
                        )}
                        <td className="p-2.5 text-center text-foreground/40 text-[10px]">
                          Filtre actif
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[11px] text-foreground/60 leading-relaxed">
              💡 Ce tableau inclut uniquement les encaissements validés par <strong>{currentUser?.name || 'vous'}</strong>. Cliquez sur les filtres ci-dessus pour consulter le détail des Ventes Directes, Livraisons et Réservations.
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            Aucune statistique disponible pour cette période.
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border-l border-white/10 h-full flex flex-col shadow-2xl p-5 overflow-hidden animate-in slide-in-from-right duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-gold" />
                <div>
                  <h3 className="text-sm font-black text-gold font-mono">{selectedItem.invoiceNumber || selectedItem.deliveryNo || selectedItem.reservationNo}</h3>
                  <div className="text-xs text-foreground/50">Détails de l'opération</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-xl p-1 text-foreground/50 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="space-y-2 rounded-2xl bg-white/[0.02] p-3 border border-white/5 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-foreground/50">Date & Heure</span>
                  <span className="font-semibold">{new Date(selectedItem.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-foreground/50">Client</span>
                  <span className="font-semibold text-gold">{selectedItem.clientName || 'Client de passage'}</span>
                </div>
                {selectedItem.deliveryPerson && (
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-foreground/50">Livreur</span>
                    <span className="font-semibold text-sky-400">🛵 {selectedItem.deliveryPerson}</span>
                  </div>
                )}
                {selectedItem.deliveryAddress && (
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-foreground/50">Adresse</span>
                    <span className="font-semibold">{selectedItem.deliveryAddress}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-foreground/50">Mode de paiement</span>
                  <span className="font-bold text-emerald-400">{getPaymentMethodLabel(selectedItem.paymentMethod)}</span>
                </div>
              </div>

              {/* Items List */}
              {selectedItem.items && selectedItem.items.length > 0 && (
                <div className="space-y-2 rounded-2xl bg-white/[0.02] p-3 border border-white/5">
                  <div className="text-xs font-bold uppercase tracking-wider text-foreground/50">Articles enregistrés</div>
                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-zinc-900 text-[10px] uppercase text-foreground/50 font-semibold border-b border-white/5">
                        <tr>
                          <th className="p-2">Désignation</th>
                          <th className="p-2 text-right">P/U</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {selectedItem.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 text-foreground font-medium">{item.categoryName}</td>
                            <td className="p-2 text-right font-mono text-gold">{formatFCFA(item.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Total Box */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 text-center space-y-1">
                <div className="text-xs uppercase font-bold text-foreground/40">Montant Total Encaissé</div>
                <div className="text-xl font-black text-gold">
                  {formatFCFA(Number(selectedItem.totalAmount) + Number(selectedItem.deliveryFee || 0))}
                </div>
                {Number(selectedItem.deliveryFee || 0) > 0 && (
                  <div className="text-[10px] text-sky-400 font-bold">
                    (Marchandises: {formatFCFA(selectedItem.totalAmount)} + Frais livraison: {formatFCFA(selectedItem.deliveryFee)})
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 shrink-0">
              <button
                type="button"
                onClick={() => triggerPrint(selectedItem)}
                className="w-full rounded-2xl bg-gold py-3 px-4 text-xs font-extrabold text-black hover:bg-gold/85 transition shadow-lg shadow-gold/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Réimprimer ce Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
