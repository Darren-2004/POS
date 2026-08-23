import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, User as UserIcon, Settings, Award, Clock } from 'lucide-react';
import { triggerPrint, cx } from '../utils/helpers';
import Dashboard from './admin/Dashboard';
import Users from './admin/Users';
import CategoriesView from './admin/Categories';
import ZReportView from './admin/ZReport';
import ReservationsPanel from './admin/ReservationsPanel';
import { API_BASE } from '../utils/constants';

export default function AdminView({ currentUser, users, categories, fetchUsers, fetchCategories }) {
  const [adminTab, setAdminTab] = useState('dashboard');
  const [stats, setStats] = useState({ today: {}, week: {}, month: {} });
  const [invoices, setInvoices] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterCashier, setFilterCashier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [zReportData, setZReportData] = useState(null);
  const [reservationPayments, setReservationPayments] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  // Independent filters for reservations tab
  const [reservationFilterDate, setReservationFilterDate] = useState('');
  const [reservationFilterCashier, setReservationFilterCashier] = useState('');
  // Ref to track the latest fetch — stale responses are discarded
  const fetchIdRef = useRef(0);

  // Unified atomic fetch function: ensures invoices, reservationPayments and reservations update together in sync (for dashboard)
  const refreshDashboardData = async (date = filterDate, cashierId = filterCashier, status = filterStatus) => {
    // Tag this fetch; ignore any response that arrives after a newer fetch has started
    const fetchId = ++fetchIdRef.current;
    setDashboardLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (cashierId) params.append('cashierId', cashierId);

      const invParams = new URLSearchParams(params);
      if (status) invParams.append('status', status);

      const [statsRes, invsRes, resPayRes] = await Promise.all([
        fetch(`${API_BASE}/stats?${params.toString()}`),
        fetch(`${API_BASE}/invoices?${invParams.toString()}`),
        fetch(`${API_BASE}/reservation-payments?${params.toString()}`)
      ]);

      // Discard result if a newer fetch has already been launched
      if (fetchId !== fetchIdRef.current) return;

      if (statsRes && statsRes.ok) {
        const data = await statsRes.json();
        if (data && typeof data === 'object') setStats(data);
      }

      if (invsRes && invsRes.ok) {
        const data = await invsRes.json();
        if (Array.isArray(data)) setInvoices(data);
      }

      if (resPayRes && resPayRes.ok) {
        const data = await resPayRes.json();
        if (Array.isArray(data)) setReservationPayments(data);
      }
    } catch (e) {
      console.error('refreshDashboardData error:', e);
    } finally {
      if (fetchId === fetchIdRef.current) setDashboardLoading(false);
    }
  };

  // Independent fetch function for reservations tab
  const refreshReservationsData = async (date = reservationFilterDate, cashierId = reservationFilterCashier) => {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (cashierId) params.append('cashierId', cashierId);

      const res = await fetch(`${API_BASE}/reservations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReservations(Array.isArray(data) ? data : []);
      } else {
        setReservations([]);
      }
    } catch (e) {
      console.error('refreshReservationsData error:', e);
    }
  };

  // Re-fetch dashboard data atomically whenever dashboard is active or filters change
  useEffect(() => {
    if (adminTab === 'dashboard') {
      refreshDashboardData(filterDate, filterCashier, filterStatus);
    }
  }, [adminTab, filterDate, filterCashier, filterStatus]);

  useEffect(() => {
    const handleDashboardRefresh = () => refreshDashboardData(filterDate, filterCashier, filterStatus);
    window.addEventListener('pos:dashboard-refresh', handleDashboardRefresh);
    return () => window.removeEventListener('pos:dashboard-refresh', handleDashboardRefresh);
  }, [filterDate, filterCashier, filterStatus]);

  // Re-fetch reservations data independently when reservations tab is active or reservation filters change
  useEffect(() => {
    if (adminTab === 'reservations') {
      setReservations([]);
      refreshReservationsData(reservationFilterDate, reservationFilterCashier);
    }
  }, [adminTab, reservationFilterDate, reservationFilterCashier]); // eslint-disable-line

  const generateZReport = async (filterParams) => {
    try {
      let url = `${API_BASE}/z-report`;
      if (filterParams?.startDate && filterParams?.endDate) {
        url += `?startDate=${filterParams.startDate}&endDate=${filterParams.endDate}`;
      } else if (filterParams?.date || filterDate) {
        url += `?date=${filterParams?.date || filterDate}`;
      }
      const res = await fetch(url);
      if (res.ok) setZReportData(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchInvoices = (dateValue = filterDate, cashierValue = filterCashier, statusValue = filterStatus) => {
    return refreshDashboardData(dateValue, cashierValue, statusValue);
  };

  const adminTabs = [
    { id: 'dashboard', label: 'Tableau', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'reservations', label: 'Réservations', icon: <Clock className="h-4 w-4" /> },
    { id: 'users', label: 'Caissières', icon: <UserIcon className="h-4 w-4" /> },
    { id: 'categories', label: 'Catégories', icon: <Settings className="h-4 w-4" /> },
    { id: 'z-report', label: 'Rapport Z', icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      <aside className="w-64 shrink-0 pr-4">
        <div className="sticky top-0 space-y-4">
          <div className="text-xs uppercase tracking-[0.24em] text-foreground/40">Espace Admin</div>
          <div className="space-y-1">
            {adminTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={cx(
                  'flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition cursor-pointer',
                  adminTab === tab.id ? 'bg-white/[0.08] text-gold' : 'text-foreground/70 hover:bg-white/[0.04]'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 pb-6">
          <h2 className="text-xl font-semibold text-foreground">Console Admin</h2>

          {adminTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              invoices={invoices}
              reservationPayments={reservationPayments}
              reservations={reservations}
              users={users}
              filterDate={filterDate}
              setFilterDate={setFilterDate}
              filterCashier={filterCashier}
              setFilterCashier={setFilterCashier}
              fetchInvoices={fetchInvoices}
              loading={dashboardLoading}
            />
          )}

          {adminTab === 'reservations' && (
            <ReservationsPanel
              reservations={reservations}
              users={users}
              filterDate={reservationFilterDate}
              setFilterDate={setReservationFilterDate}
              filterCashier={reservationFilterCashier}
              setFilterCashier={setReservationFilterCashier}
              selectedReservationId={selectedReservationId}
              setSelectedReservationId={setSelectedReservationId}
              onRefresh={() => refreshReservationsData(reservationFilterDate, reservationFilterCashier)}
            />
          )}

          {adminTab === 'users' && (
            <Users users={users} fetchUsers={fetchUsers} currentUser={currentUser} />
          )}

          {adminTab === 'categories' && (
            <CategoriesView categories={categories} fetchCategories={fetchCategories} />
          )}

          {adminTab === 'z-report' && (
            <ZReportView zReportData={zReportData} onGenerate={generateZReport} onPrint={(data) => triggerPrint(data)} />
          )}
        </div>
      </div>
    </div>
  );
}