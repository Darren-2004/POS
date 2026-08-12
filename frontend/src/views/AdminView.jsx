import React, { useState, useEffect } from 'react';
import { BarChart3, User as UserIcon, Settings, Award, Search, Printer, Ban, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import StatusChip from '../components/StatusChip';
import IconButton from '../components/IconButton';
import Field, { inputCls } from '../components/Field';
import Modal from '../components/Modal';
import { formatFCFA, triggerPrint, cx } from '../utils/helpers';
import Dashboard from './admin/Dashboard';
import Users from './admin/Users';
import CategoriesView from './admin/Categories';
import ZReportView from './admin/ZReport';
import { API_BASE, CANCEL_REASONS } from '../utils/constants';

export default function AdminView({ currentUser, users, categories, fetchUsers, fetchCategories }) {
  const [adminTab, setAdminTab] = useState('dashboard');
  const [stats, setStats] = useState({ today: {}, week: {}, month: {} });
  const [invoices, setInvoices] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCashier, setFilterCashier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Modals
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState(null);
  const [cancelPin, setCancelPin] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [zReportData, setZReportData] = useState(null);

  useEffect(() => {
    fetchAdminStats();
    fetchInvoices();
  }, [adminTab, filterDate, filterCashier, filterStatus]);

  const generateZReport = async (date) => {
    try {
      const d = date || filterDate;
      const res = await fetch(`${API_BASE}/z-report?date=${d}`);
      if (res.ok) setZReportData(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAdminStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.append('date', filterDate);
      if (filterCashier) params.append('cashierId', filterCashier);
      if (filterStatus) params.append('status', filterStatus);
      const res = await fetch(`${API_BASE}/invoices?${params.toString()}`);
      if (res.ok) setInvoices(await res.json());
    } catch (e) { console.error(e); }
  };

  const adminTabs = [
    { id: 'dashboard', label: 'Tableau', icon: <BarChart3 className="h-4 w-4" /> },
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
                  'flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition',
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
              users={users}
              filterDate={filterDate}
              setFilterDate={setFilterDate}
              filterCashier={filterCashier}
              setFilterCashier={setFilterCashier}
              fetchInvoices={fetchInvoices}
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