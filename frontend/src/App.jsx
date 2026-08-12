// App.jsx
import React, { useState, useEffect } from 'react';
import {
  Lock, Shield, WifiOff, ShoppingCart, Plus, Trash2,
  Printer, User as UserIcon, BarChart3,
  Settings, PlusCircle, X, Ban, Award, FileText,
  Search, Filter, ArrowLeft, Pencil, RotateCcw, ChevronUp, ChevronDown, AlertTriangle
} from 'lucide-react';

const API_BASE = '/api';

// Currency formatter for Central African Francs (XAF / FCFA)
const formatFCFA = (amount = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' FCFA';

const cx = (...classes) => classes.filter(Boolean).join(' ');

const CANCEL_REASONS = [
  'Erreur de saisie',
  'Retour client',
  'Double saisie',
  'Article indisponible',
  'Erreur de prix',
  'Autre',
];

/* ==========================================================================
   SHARED PRIMITIVES
   ========================================================================== */

/** Dot + label status pill, reused everywhere a status needs to render */
function StatusChip({ tone = 'emerald', label }) {
  const tones = {
    emerald: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 ring-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
    red: 'text-red-400 bg-red-500/10 ring-red-500/20',
    purple: 'text-purple-400 bg-purple-500/10 ring-purple-500/20',
    gold: 'text-gold bg-gold/10 ring-gold/20',
  };
  const dots = {
    emerald: 'bg-emerald-400', blue: 'bg-blue-400', amber: 'bg-amber-400',
    red: 'bg-red-400', purple: 'bg-purple-400', gold: 'bg-gold',
  };
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset', tones[tone])}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dots[tone])} />
      {label}
    </span>
  );
}

/** Icon-only row/utility action button with a real touch target */
function IconButton({ icon, onClick, tone = 'default', title, disabled }) {
  const tones = {
    default: 'text-foreground/45 hover:text-gold hover:bg-white/6',
    danger: 'text-foreground/45 hover:text-red-400 hover:bg-red-500/10',
    info: 'text-foreground/45 hover:text-blue-400 hover:bg-blue-500/10',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx('rounded-md p-2 transition disabled:opacity-40 disabled:pointer-events-none', tones[tone])}
    >
      {icon}
    </button>
  );
}

/** Label + input wrapper used across every form field in the app */
function Field({ label, children, required }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
        {label}{required && <span className="ml-0.5 text-gold">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-foreground outline-none placeholder:text-foreground/30 focus:border-gold/50";

/** Small modal chrome shared by the popup dialogs in this file */
function Modal({ onClose, children, widthCls = 'max-w-xs' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={cx('relative w-full rounded-xl border border-white/10 bg-background p-6 max-h-[90vh] overflow-y-auto', widthCls)}>
        <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1.5 text-foreground/45 hover:bg-white/6 hover:text-foreground transition">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ==========================================================================
   SUB-COMPONENTS
   ========================================================================== */

/** Top Bar Header */
function Header({ currentUser, serverOnline, currentView, setCurrentView, onLogout }) {
  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-background px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-gold shrink-0">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-none text-foreground truncate">ApexPOS</h1>
          <p className="mt-0.5 text-[11px] text-foreground/40 hidden sm:block">Terminal Caissier & Management</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Connection Indicator */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-foreground/40">
          <span className={cx('h-1.5 w-1.5 rounded-full', serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
          {serverOnline ? 'Serveur actif' : 'Hors-ligne'}
        </div>
        <span className={cx('sm:hidden h-2 w-2 rounded-full', serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />

        {/* User Info */}
        <div className="flex items-center gap-2.5 border-l border-white/10 pl-3 sm:pl-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-foreground leading-tight">{currentUser.name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
              {isAdmin ? 'Administrateur' : 'Caissière'}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-xs font-semibold text-gold shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Navigation Switcher */}
        {isAdmin && (
          <button
            onClick={() => setCurrentView(currentView === 'admin' ? 'cashier' : 'admin')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-foreground/60 hover:bg-white/6 transition"
          >
            {currentView === 'admin' ? <ShoppingCart className="h-3.5 w-3.5 text-gold" /> : <Shield className="h-3.5 w-3.5 text-gold" />}
            <span className="hidden sm:inline">{currentView === 'admin' ? 'Mode Caisse' : 'Console Admin'}</span>
          </button>
        )}

        <IconButton
          icon={<Lock className="h-4 w-4" />}
          onClick={onLogout}
          tone="danger"
          title="Déconnexion"
        />
      </div>
    </header>
  );
}

/* ==========================================================================
   MAIN APP COMPONENT
   ========================================================================== */

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [serverOnline, setServerOnline] = useState(true);
  const [currentView, setCurrentView] = useState('login'); // 'login' | 'cashier' | 'admin'

  // Auth States
  const [selectedUser, setSelectedUser] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetPinStep, setResetPinStep] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [profileSearch, setProfileSearch] = useState('');

  // Cashier Cart States
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [selectedCategoryForPrice, setSelectedCategoryForPrice] = useState(null);
  const [articlePriceInput, setArticlePriceInput] = useState('');
  const [articleQuantityInput, setArticleQuantityInput] = useState('1');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [lastSale, setLastSale] = useState(null); // snapshot of cart for "repeat last sale"

  // Cart line edit
  const [editingCartItem, setEditingCartItem] = useState(null);
  const [cartEditPrice, setCartEditPrice] = useState('');
  const [cartEditQty, setCartEditQty] = useState('1');

  // Cashier Quick Add Category Modal
  const [showCashierAddCategory, setShowCashierAddCategory] = useState(false);
  const [cashierNewCatName, setCashierNewCatName] = useState('');
  const [cashierNewCatColor, setCashierNewCatColor] = useState('bg-gold');
  const [cashierCatPin, setCashierCatPin] = useState('');
  const [cashierCatError, setCashierCatError] = useState('');

  // Admin Panel States
  const [adminTab, setAdminTab] = useState('kpis');
  const [stats, setStats] = useState({ today: {}, week: {}, month: {}, topSelling: [] });
  const [invoices, setInvoices] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCashier, setFilterCashier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false); // presentational only
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [newCashierName, setNewCashierName] = useState('');
  const [cashierCreateError, setCashierCreateError] = useState('');
  const [cashierCreateSuccess, setCashierCreateSuccess] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('bg-gold');
  const [categoryCreateError, setCategoryCreateError] = useState('');
  const [categoryCreateSuccess, setCategoryCreateSuccess] = useState('');

  // Category edit / delete-confirm
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryDeleteError, setCategoryDeleteError] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('bg-gold');
  const [editCatPin, setEditCatPin] = useState('');
  const [editCatError, setEditCatError] = useState('');

  // Cancellation Modal
  const [invoiceToCancel, setInvoiceToCancel] = useState(null);
  const [cancelPin, setCancelPin] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonOption, setCancelReasonOption] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [zReportData, setZReportData] = useState(null);

  // Initial Sync & Polling
  useEffect(() => {
    checkServerConnection();
    fetchUsers();
    fetchCategories();
    const interval = setInterval(checkServerConnection, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'ADMIN' && currentView === 'admin') {
      fetchAdminStats();
      fetchInvoices();
    }
  }, [currentUser, currentView, adminTab, filterDate, filterCashier, filterStatus]);

  // Physical keyboard support for the PIN keypad
  useEffect(() => {
    if (currentView !== 'login' || !selectedUser) return;
    const onKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeypadClear();
      } else if (e.key === 'Enter') {
        if (resetPinStep) handleResetPinSubmit(); else handleLoginSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const checkServerConnection = async () => {
    try {
      const res = await fetch(`${API_BASE}/heartbeat`);
      setServerOnline(res.ok);
    } catch {
      setServerOnline(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error('Fetch users failed:', e); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) setCategories(await res.json());
    } catch (e) { console.error('Fetch categories failed:', e); }
  };

  const fetchAdminStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error('Fetch stats failed:', e); }
  };

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.append('date', filterDate);
      if (filterCashier) params.append('cashierId', filterCashier);
      if (filterStatus) params.append('status', filterStatus);
      const res = await fetch(`${API_BASE}/invoices?${params.toString()}`);
      if (res.ok) setInvoices(await res.json());
    } catch (e) { console.error('Fetch invoices failed:', e); }
  };

  /* --- AUTH HANDLERS --- */
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setEnteredPin('');
    setAuthError('');
    setResetPinStep(false);
  };

  const handleKeypadPress = (val) => {
    setAuthError('');
    if (resetPinStep) {
      if (newPin.length < 4) setNewPin(prev => prev + val);
      else if (confirmPin.length < 4) setConfirmPin(prev => prev + val);
    } else {
      if (enteredPin.length < 4) setEnteredPin(prev => prev + val);
    }
  };

  const handleKeypadClear = () => {
    if (resetPinStep) {
      if (confirmPin.length > 0) setConfirmPin('');
      else setNewPin('');
    } else {
      setEnteredPin('');
    }
  };

  const handleLoginSubmit = async () => {
    if (enteredPin.length < 4) {
      setAuthError('Code PIN à 4 chiffres requis');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, pin: enteredPin })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Identifiants invalides');
        setEnteredPin('');
        return;
      }
      if (data.needsPinReset) {
        setResetPinStep(true);
        setNewPin('');
        setConfirmPin('');
        return;
      }
      setCurrentUser(data);
      setCurrentView(data.role === 'ADMIN' ? 'admin' : 'cashier');
      if (data.role === 'ADMIN') setAdminTab('kpis');
    } catch {
      setAuthError('Connexion impossible au serveur central');
    }
  };

  const handleResetPinSubmit = async () => {
    if (newPin.length < 4 || confirmPin.length < 4) {
      setAuthError('Les deux codes PIN doivent contenir 4 chiffres');
      return;
    }
    if (newPin !== confirmPin) {
      setAuthError('Les codes PIN ne correspondent pas');
      setConfirmPin('');
      return;
    }
    if (newPin === '0000') {
      setAuthError('Le code PIN "0000" n\'est pas autorisé');
      setNewPin('');
      setConfirmPin('');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, oldPin: enteredPin, newPin })
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Erreur de réinitialisation'); return; }
      setCurrentUser({ ...selectedUser, needsPinReset: false });
      setCurrentView('cashier');
      fetchUsers();
    } catch {
      setAuthError('Erreur lors du changement de PIN');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedUser(null);
    setEnteredPin('');
    setNewPin('');
    setConfirmPin('');
    setResetPinStep(false);
    setCurrentView('login');
    setCart([]);
    setPaymentMethod('');
  };

  /* --- CART & CASHIER HANDLERS --- */
  const handleCategoryClick = (category) => {
    setSelectedCategoryForPrice(category);
    setArticlePriceInput('');
    setArticleQuantityInput('1');
  };

  const handleAddArticleToCart = () => {
    const price = parseFloat(articlePriceInput);
    const qty = parseInt(articleQuantityInput, 10);
    if (isNaN(price) || price <= 0) { alert('Saisissez un prix valide'); return; }
    if (isNaN(qty) || qty < 1) { alert('La quantité doit être supérieure ou égale à 1'); return; }

    setCart(prev => [...prev, {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      categoryName: selectedCategoryForPrice.name,
      price,
      qty
    }]);

    setSelectedCategoryForPrice(null);
    setArticlePriceInput('');
    setArticleQuantityInput('1');
  };

  const handleRemoveFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const handleOpenCartEdit = (item) => {
    setEditingCartItem(item);
    setCartEditPrice(String(item.price));
    setCartEditQty(String(item.qty));
  };

  const handleSaveCartEdit = () => {
    const price = parseFloat(cartEditPrice);
    const qty = parseInt(cartEditQty, 10);
    if (isNaN(price) || price <= 0) { alert('Saisissez un prix valide'); return; }
    if (isNaN(qty) || qty < 1) { alert('La quantité doit être supérieure ou égale à 1'); return; }
    setCart(prev => prev.map(item => item.id === editingCartItem.id ? { ...item, price, qty } : item));
    setEditingCartItem(null);
  };

  const handleRepeatLastSale = () => {
    if (!lastSale || lastSale.length === 0) return;
    setCart(prev => [
      ...prev,
      ...lastSale.map(item => ({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        categoryName: item.categoryName,
        price: item.price,
        qty: item.qty,
      })),
    ]);
  };

  const getCartTotal = () => cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const getCartItemsForServer = () =>
    cart.flatMap(item =>
      Array.from({ length: item.qty }, () => ({
        categoryName: item.categoryName,
        price: item.price
      }))
    );

  /* --- PRINTING SYSTEM --- */
  const triggerPrint = (invoiceData) => {
    const isZ = invoiceData.isZReport;
    const zr = invoiceData.zReport;

    // Group flat item lines by category+price so qty > 1 shows as one row
    const groupItems = (items = []) => {
      const map = {};
      items.forEach(item => {
        const key = `${item.categoryName}||${item.price}`;
        if (!map[key]) map[key] = { categoryName: item.categoryName, price: item.price, qty: 0 };
        map[key].qty += 1;
      });
      return Object.values(map);
    };

    const itemsRows = !isZ
      ? groupItems(invoiceData.items).map(item => `
          <div style="display:flex;justify-content:space-between;margin:3px 0;">
            <span>${item.categoryName}${item.qty > 1 ? ` x${item.qty}` : ''}</span>
            <span>${Math.round(item.price * item.qty).toLocaleString('fr-FR')} FCFA</span>
          </div>`).join('')
      : '';

    const topSellingRows = isZ
      ? (zr.topSelling || []).map(cat => `
          <div style="display:flex;justify-content:space-between;margin:3px 0;">
            <span>${cat.name} (x${cat.quantity})</span>
            <span>${Math.round(cat.revenue).toLocaleString('fr-FR')} FCFA</span>
          </div>`).join('')
      : '';

    const printHTML = isZ ? `
      <div style="text-align:center;margin-bottom:8px;font-family:monospace;">
        <h2 style="margin:0;font-size:13px;font-weight:bold;">POS TERMINAL</h2>
        <p style="margin:2px 0 0 0;font-size:11px;">RAPPORT DE CLÔTURE (Z)</p>
        <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      </div>
      <div style="font-size:10px;font-family:monospace;">
        <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${zr.date} ${zr.time}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Operateur:</span><span>${invoiceData.createdBy.name}</span></div>
        <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
        <div style="font-weight:bold;margin-bottom:4px;">SYNTHÈSE COMPTABLE</div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;"><span>TOTAL NET:</span><span>${Math.round(zr.totalSales).toLocaleString('fr-FR')} FCFA</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Espèces:</span><span>${Math.round(zr.totalCash).toLocaleString('fr-FR')} FCFA</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Mobile Money:</span><span>${Math.round(zr.totalOnline).toLocaleString('fr-FR')} FCFA</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Ventes Validées:</span><span>${zr.validatedCount}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Ventes Annulées:</span><span>${zr.cancelledCount}</span></div>
        <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
        <div style="font-weight:bold;margin-bottom:4px;">RÉPARTITION PAR CATÉGORIE</div>
        ${topSellingRows}
        <p style="text-align:center;margin-top:12px;font-size:10px;">--- FIN DU RAPPORT Z ---</p>
      </div>
    ` : `
      <div style="text-align:center;margin-bottom:8px;font-family:monospace;">
        <h2 style="margin:0;font-size:14px;font-weight:bold;">BOUTIQUE MODE</h2>
        <p style="margin:2px 0 0 0;font-size:10px;">Ticket de Caisse</p>
        <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      </div>
      <div style="font-size:10px;font-family:monospace;">
        <div style="display:flex;justify-content:space-between;"><span>N° Ticket:</span><b>${invoiceData.invoiceNumber}</b></div>
        <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${new Date(invoiceData.createdAt).toLocaleString('fr-FR')}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Caissière:</span><span>${invoiceData.createdBy.name}</span></div>
        <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
        ${itemsRows}
        <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;margin-top:4px;">
          <span>TOTAL COMPTANT:</span><span>${Math.round(invoiceData.totalAmount).toLocaleString('fr-FR')} FCFA</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:2px;">
          <span>Mode de Règlement:</span><span>${invoiceData.paymentMethod === 'CASH' ? 'Espèces' : 'Mobile / En Ligne'}</span>
        </div>
        <p style="text-align:center;margin-top:14px;font-size:9px;">Merci de votre visite !</p>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            body { font-family: 'Courier New', Courier, monospace; width: 74mm; margin: 0; padding: 0; color: #000; background: #fff; }
          </style>
        </head>
        <body>${printHTML}</body>
      </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  };

  const handleValidateAndPrint = async () => {
    if (!paymentMethod) { alert('Sélectionnez un mode de paiement'); return; }
    if (cart.length === 0) { alert('Le panier est vide'); return; }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: getCartTotal(),
          paymentMethod,
          items: getCartItemsForServer(),
          createdById: currentUser.id
        })
      });
      const invoiceData = await res.json();
      if (!res.ok) { alert(invoiceData.error || 'Erreur lors de l\'enregistrement'); setIsSubmittingOrder(false); return; }
      triggerPrint(invoiceData);
      setLastSale(cart.map(item => ({ categoryName: item.categoryName, price: item.price, qty: item.qty })));
      setCart([]);
      setPaymentMethod('');
      setIsSubmittingOrder(false);
    } catch {
      alert('Connexion serveur perdue. Facture non traitée.');
      setIsSubmittingOrder(false);
    }
  };

  /* --- ADMIN MANAGEMENT HANDLERS --- */
  const handleCashierAddCategory = async (e) => {
    e.preventDefault();
    setCashierCatError('');
    if (!cashierNewCatName.trim()) { setCashierCatError('Nom requis'); return; }
    if (cashierCatPin.length < 4) { setCashierCatError('Code PIN Admin à 4 chiffres requises'); return; }

    const adminUser = users.find(u => u.role === 'ADMIN');
    if (!adminUser) { setCashierCatError('Administrateur non localisé'); return; }

    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: adminUser.id, adminPin: cashierCatPin, name: cashierNewCatName.trim(), color: cashierNewCatColor })
      });
      const data = await res.json();
      if (!res.ok) { setCashierCatError(data.error || 'Erreur de création'); return; }
      await fetchCategories();
      setShowCashierAddCategory(false);
      setCashierNewCatName('');
      setCashierCatPin('');
    } catch {
      setCashierCatError('Erreur de communication avec le serveur central');
    }
  };

  const handleCreateCashier = async (e) => {
    e.preventDefault();
    setCashierCreateError('');
    setCashierCreateSuccess('');
    if (!newCashierName.trim()) { setCashierCreateError('Nom requis'); return; }

    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser.id, adminPin: enteredPin, name: newCashierName.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setCashierCreateError(data.error || 'Erreur de création'); return; }
      setCashierCreateSuccess(`Caissière "${data.name}" créée ! Code PIN par défaut : 0000`);
      setNewCashierName('');
      fetchUsers();
    } catch {
      setCashierCreateError('Erreur de communication');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setCategoryCreateError('');
    setCategoryCreateSuccess('');
    if (!newCategoryName.trim()) { setCategoryCreateError('Nom requis'); return; }

    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser.id, adminPin: enteredPin, name: newCategoryName.trim(), color: newCategoryColor })
      });
      const data = await res.json();
      if (!res.ok) { setCategoryCreateError(data.error || 'Erreur de création'); return; }
      setCategoryCreateSuccess(`Bouton "${data.name}" ajouté !`);
      setNewCategoryName('');
      fetchCategories();
    } catch {
      setCategoryCreateError('Erreur de communication');
    }
  };

  const handleDeleteCategory = async (id) => {
    setCategoryDeleteError('');
    try {
      const res = await fetch(`${API_BASE}/categories/${id}?adminId=${currentUser.id}&adminPin=${enteredPin}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setCategoryDeleteError(data.error || 'Erreur de suppression'); return; }
      setCategoryToDelete(null);
      fetchCategories();
    } catch {
      setCategoryDeleteError('Erreur réseau lors de la suppression');
    }
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatColor(cat.color || 'bg-gold');
    setEditCatPin('');
    setEditCatError('');
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    setEditCatError('');
    if (!editCatName.trim()) { setEditCatError('Nom requis'); return; }
    if (editCatPin.length < 4) { setEditCatError('Code PIN Admin à 4 chiffres requis'); return; }

    try {
      const res = await fetch(`${API_BASE}/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser.id, adminPin: editCatPin, name: editCatName.trim(), color: editCatColor })
      });
      const data = await res.json();
      if (!res.ok) { setEditCatError(data.error || 'Erreur de mise à jour'); return; }
      setEditingCategory(null);
      fetchCategories();
    } catch {
      setEditCatError('Erreur de communication');
    }
  };

  const handleCancelInvoiceSubmit = async () => {
    if (!cancelReason.trim()) { setCancelError('Motif d\'annulation obligatoire'); return; }
    if (cancelPin.length < 4) { setCancelError('PIN Administrateur requis'); return; }

    try {
      const res = await fetch(`${API_BASE}/invoices/${invoiceToCancel.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser.id, adminPin: cancelPin, cancellationReason: cancelReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.error || 'Erreur lors de l\'annulation'); return; }
      setInvoiceToCancel(null);
      fetchInvoices();
      fetchAdminStats();
    } catch {
      setCancelError('Erreur de communication');
    }
  };

  const handleGenerateZReport = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysInvoices = invoices.filter(inv => inv.createdAt.startsWith(todayStr));
    const validatedInvoices = todaysInvoices.filter(inv => inv.status === 'VALIDATED');
    const cancelledInvoices = todaysInvoices.filter(inv => inv.status === 'CANCELLED');

    let totalSales = 0, totalCash = 0, totalOnline = 0;
    validatedInvoices.forEach(inv => {
      totalSales += inv.totalAmount;
      if (inv.paymentMethod === 'CASH') totalCash += inv.totalAmount;
      else totalOnline += inv.totalAmount;
    });

    const categoryCounts = {};
    validatedInvoices.forEach(inv => inv.items.forEach(item => {
      if (!categoryCounts[item.categoryName]) categoryCounts[item.categoryName] = { quantity: 0, revenue: 0 };
      categoryCounts[item.categoryName].quantity += 1;
      categoryCounts[item.categoryName].revenue += item.price;
    }));

    const topSelling = Object.keys(categoryCounts).map(name => ({
      name,
      quantity: categoryCounts[name].quantity,
      revenue: categoryCounts[name].revenue
    })).sort((a, b) => b.revenue - a.revenue);

    setZReportData({
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR'),
      totalSales,
      totalCash,
      totalOnline,
      validatedCount: validatedInvoices.length,
      cancelledCount: cancelledInvoices.length,
      topSelling
    });
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const activeHistoryFilterCount = (filterCashier ? 1 : 0) + (filterStatus ? 1 : 0);

  const handleSort = (key) => {
    setSortConfig(prev => prev.key === key
      ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  const sortableValue = (inv, key) => {
    switch (key) {
      case 'invoiceNumber': return inv.invoiceNumber || '';
      case 'cashier': return inv.createdBy?.name || '';
      case 'amount': return inv.totalAmount || 0;
      default: return '';
    }
  };

  const filteredSortedInvoices = invoices
    .filter(inv => inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()))
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const va = sortableValue(a, sortConfig.key);
      const vb = sortableValue(b, sortConfig.key);
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  const adminTabs = [
    { id: 'kpis', label: 'Comptabilité', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'history', label: 'Journal Ventes', icon: <FileText className="h-4 w-4" /> },
    { id: 'z-report', label: 'Rapport Z', icon: <Award className="h-4 w-4" /> },
    { id: 'users', label: 'Caissières', icon: <UserIcon className="h-4 w-4" /> },
    { id: 'categories', label: 'Boutons / Articles', icon: <Settings className="h-4 w-4" /> },
  ];

  /* ==========================================================================
     LAYOUT RENDER
     ========================================================================== */
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans antialiased selection:bg-gold selection:text-black">

      {/* Network Alert */}
      {!serverOnline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs font-semibold text-red-400">
          <WifiOff className="h-4 w-4 animate-pulse" />
          <span>Connexion au serveur POS interrompue. Les transactions sont suspendues.</span>
        </div>
      )}

      {/* Global Header */}
      <Header
        currentUser={currentUser}
        serverOnline={serverOnline}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">

        {/* --------------------------------------------------------------------
            VIEW 1: LOGIN
           -------------------------------------------------------------------- */}
        {currentView === 'login' && (
          <div className="flex-1 flex items-center justify-center py-6">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">

              {!selectedUser ? (
                <div>
                  <div className="mb-6 text-center">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">Identification Terminal</h2>
                    <p className="mt-1 text-sm text-foreground/40">Sélectionnez votre compte caisse</p>
                  </div>

                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
                    <input
                      type="text"
                      placeholder="Chercher un profil..."
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      className={cx(inputCls, 'pl-9')}
                    />
                  </div>

                  <div className="grid max-h-[280px] grid-cols-2 gap-3 overflow-y-auto pr-1">
                    {users.filter(u => u.name.toLowerCase().includes(profileSearch.toLowerCase())).map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="group flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center transition hover:bg-white/6"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-semibold text-foreground group-hover:border-gold/50 group-hover:text-gold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold leading-tight text-foreground group-hover:text-gold">{u.name}</p>
                          <span className="mt-1 inline-block rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground/40">
                            {u.role === 'ADMIN' ? 'Admin' : 'Caissière'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {users.length === 0 && (
                    <p className="py-10 text-center text-sm italic text-foreground/30">Aucun profil disponible</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <button onClick={() => setSelectedUser(null)} className="mb-4 flex items-center gap-1 self-start text-xs text-foreground/40 hover:text-foreground transition">
                    <ArrowLeft className="h-3.5 w-3.5" /> Changer de compte
                  </button>

                  <h3 className="mb-0.5 text-base font-semibold text-foreground">
                    {resetPinStep ? 'Configuration du PIN' : selectedUser.name}
                  </h3>
                  <p className="mb-6 text-center text-xs text-foreground/40">
                    {resetPinStep ? 'Configurez votre nouveau code secret de 4 chiffres' : 'Entrez votre code PIN secret'}
                  </p>

                  <div className="mb-6 flex gap-3">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={cx(
                          'h-3.5 w-3.5 rounded-full border border-white/10 transition',
                          (resetPinStep ? (newPin.length > i || confirmPin.length > i) : enteredPin.length > i)
                            ? 'bg-gold border-gold'
                            : 'bg-background'
                        )}
                      />
                    ))}
                  </div>

                  {authError && <p className="mb-4 text-center text-xs font-semibold text-red-400">{authError}</p>}

                  <div className="grid w-full max-w-[240px] grid-cols-3 gap-2.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button
                        key={num}
                        onClick={() => handleKeypadPress(num.toString())}
                        className="h-12 rounded-lg border border-white/10 bg-white/[0.03] font-mono text-base font-semibold transition hover:bg-white/6 active:border-gold/50"
                      >
                        {num}
                      </button>
                    ))}
                    <button onClick={handleKeypadClear} className="h-12 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-semibold text-foreground/40 transition hover:bg-white/6 hover:text-red-400">
                      Effacer
                    </button>
                    <button onClick={() => handleKeypadPress('0')} className="h-12 rounded-lg border border-white/10 bg-white/[0.03] font-mono text-base font-semibold transition hover:bg-white/6">
                      0
                    </button>
                    <button
                      onClick={resetPinStep ? handleResetPinSubmit : handleLoginSubmit}
                      disabled={!serverOnline}
                      className="h-12 rounded-lg bg-gold text-xs font-semibold text-black transition hover:bg-gold/85 disabled:opacity-50"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------
            VIEW 2: CASHIER TERMINAL
           -------------------------------------------------------------------- */}
        {currentView === 'cashier' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">

            {/* Catalog Grid */}
            <div className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 lg:col-span-7">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Catalogue Vente</h2>
                  <p className="text-sm text-foreground/40">Sélectionnez une catégorie pour saisir le montant</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-foreground/40">
                    {filteredCategories.length} / {categories.length} items
                  </span>
                  <button
                    onClick={() => { setShowCashierAddCategory(true); setCashierCatError(''); setCashierNewCatName(''); setCashierCatPin(''); }}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-foreground/60 transition hover:bg-white/6"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-gold" />
                    <span>Nouveau</span>
                  </button>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
                <input
                  type="text"
                  placeholder="Filtrer les catégories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className={cx(inputCls, 'pl-9 pr-8')}
                />
                {categorySearch && (
                  <button onClick={() => setCategorySearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-foreground/40 hover:text-foreground transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filteredCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat)}
                      disabled={!serverOnline}
                      className="group relative flex h-28 sm:h-32 flex-col items-start justify-between overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:p-5 text-left transition hover:border-gold/50 hover:bg-white/6 disabled:opacity-40"
                    >
                      <div className={cx('absolute bottom-0 left-0 top-0 w-1.5', cat.color || 'bg-gold')} />
                      <span className="pl-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/35">Article</span>
                      <h3 className="pl-1 text-sm font-semibold leading-snug text-foreground group-hover:text-gold">{cat.name}</h3>
                    </button>
                  ))}
                </div>

                {filteredCategories.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Settings className="mb-2 h-8 w-8 stroke-[1.5] text-foreground/25" />
                    <p className="text-sm italic text-foreground/30">Aucun article trouvé</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Panel */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 lg:col-span-5">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-gold" />
                  <h2 className="text-base font-semibold text-foreground">Panier en cours</h2>
                </div>
                <div className="flex items-center gap-2">
                  {lastSale && lastSale.length > 0 && (
                    <button
                      onClick={handleRepeatLastSale}
                      title="Répéter la dernière vente"
                      className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold text-foreground/60 transition hover:bg-white/6"
                    >
                      <RotateCcw className="h-3 w-3 text-gold" />
                      <span className="hidden sm:inline">Répéter</span>
                    </button>
                  )}
                  {cart.length > 0 && (
                    <span className="rounded-full bg-gold px-2 py-0.5 font-mono text-[11px] font-semibold text-black">
                      {cart.reduce((s, i) => s + i.qty, 0)} items
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-4 flex-1 space-y-2 overflow-y-auto pr-1">
                {cart.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleOpenCartEdit(item)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left text-xs transition hover:border-gold/40 hover:bg-white/6"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{item.categoryName}</p>
                      <p className="font-mono text-[11px] text-foreground/40">{item.qty} × {formatFCFA(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-gold">{formatFCFA(item.price * item.qty)}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleRemoveFromCart(item.id); }}
                        className="rounded-md p-2 text-foreground/45 transition hover:bg-red-500/10 hover:text-red-400"
                        title="Retirer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                ))}

                {cart.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-16">
                    <ShoppingCart className="mb-2 h-7 w-7 stroke-[1.5] text-foreground/25" />
                    <p className="text-sm italic text-foreground/30">Panier vide</p>
                    {lastSale && lastSale.length > 0 && (
                      <button
                        onClick={handleRepeatLastSale}
                        className="mt-3 flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-foreground/60 transition hover:bg-white/6"
                      >
                        <RotateCcw className="h-3 w-3 text-gold" />
                        Répéter la dernière vente
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-auto border-t border-white/10 pt-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground/40">Total Net:</span>
                  <span className="font-mono text-xl font-semibold tabular-nums text-gold">
                    {formatFCFA(getCartTotal())}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/35">Mode de règlement</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('CASH')}
                      className={cx(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition',
                        paymentMethod === 'CASH'
                          ? 'border-gold bg-gold text-black'
                          : 'border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/6'
                      )}
                    >
                      <span>💵 Espèces</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('ONLINE')}
                      className={cx(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition',
                        paymentMethod === 'ONLINE'
                          ? 'border-gold bg-gold text-black'
                          : 'border-white/10 bg-white/[0.03] text-foreground/60 hover:bg-white/6'
                      )}
                    >
                      <span>📱 Mobile Money</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleValidateAndPrint}
                  disabled={isSubmittingOrder || cart.length === 0 || !paymentMethod || !serverOnline}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-3 text-xs font-semibold text-black transition hover:bg-gold/85 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Printer className="h-4 w-4" />
                  <span>{isSubmittingOrder ? 'Enregistrement...' : 'Valider & Imprimer Ticket'}</span>
                </button>
              </div>
            </div>

            {/* Cart Line Edit Modal */}
            {editingCartItem && (
              <Modal onClose={() => setEditingCartItem(null)}>
                <h3 className="mb-0.5 text-base font-semibold text-foreground">{editingCartItem.categoryName}</h3>
                <p className="mb-4 text-xs text-foreground/40">Modifier le prix ou la quantité</p>

                <div className="mb-3">
                  <Field label="Prix unitaire (FCFA)">
                    <input
                      type="number"
                      step="1"
                      autoFocus
                      value={cartEditPrice}
                      onChange={(e) => setCartEditPrice(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center font-mono text-lg font-semibold text-gold outline-none focus:border-gold/50"
                    />
                  </Field>
                </div>

                <div className="mb-5">
                  <Field label="Quantité">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCartEditQty(q => String(Math.max(1, parseInt(q || '1') - 1)))}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] font-mono text-sm font-semibold text-foreground transition hover:bg-white/6"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={cartEditQty}
                        onChange={(e) => setCartEditQty(e.target.value)}
                        className="flex-1 rounded-md border border-white/10 bg-white/[0.03] py-1.5 text-center font-mono text-base font-semibold text-foreground outline-none focus:border-gold/50"
                      />
                      <button
                        onClick={() => setCartEditQty(q => String(parseInt(q || '1') + 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] font-mono text-sm font-semibold text-foreground transition hover:bg-white/6"
                      >
                        +
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { handleRemoveFromCart(editingCartItem.id); setEditingCartItem(null); }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2.5 text-xs font-semibold text-foreground/60 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Retirer
                  </button>
                  <button
                    onClick={handleSaveCartEdit}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold py-2.5 text-xs font-semibold text-black transition hover:bg-gold/85"
                  >
                    Enregistrer
                  </button>
                </div>
              </Modal>
            )}

            {/* Item Price Modal */}
            {selectedCategoryForPrice && (
              <Modal onClose={() => setSelectedCategoryForPrice(null)}>
                <h3 className="mb-0.5 text-base font-semibold text-foreground">{selectedCategoryForPrice.name}</h3>
                <p className="mb-4 text-xs text-foreground/40">Saisie du montant et de la quantité</p>

                <div className="mb-3">
                  <Field label="Prix unitaire (FCFA)">
                    <input
                      type="number"
                      step="1"
                      autoFocus
                      placeholder="0"
                      value={articlePriceInput}
                      onChange={(e) => setArticlePriceInput(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center font-mono text-lg font-semibold text-gold outline-none focus:border-gold/50"
                    />
                  </Field>
                </div>

                {/* Quick Price Shortcuts */}
                <div className="mb-4 grid grid-cols-4 gap-1.5">
                  {[500, 1000, 2000, 5000, 10000, 15000, 20000, 25000].map(val => (
                    <button
                      key={val}
                      onClick={() => setArticlePriceInput(val.toString())}
                      className="rounded-md border border-white/10 bg-white/[0.03] py-1.5 font-mono text-[11px] font-semibold text-foreground transition hover:bg-white/6"
                    >
                      {val >= 1000 ? `${val / 1000}k` : val}
                    </button>
                  ))}
                </div>

                <div className="mb-5">
                  <Field label="Quantité">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setArticleQuantityInput(q => String(Math.max(1, parseInt(q || '1') - 1)))}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] font-mono text-sm font-semibold text-foreground transition hover:bg-white/6"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={articleQuantityInput}
                        onChange={(e) => setArticleQuantityInput(e.target.value)}
                        className="flex-1 rounded-md border border-white/10 bg-white/[0.03] py-1.5 text-center font-mono text-base font-semibold text-foreground outline-none focus:border-gold/50"
                      />
                      <button
                        onClick={() => setArticleQuantityInput(q => String(parseInt(q || '1') + 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] font-mono text-sm font-semibold text-foreground transition hover:bg-white/6"
                      >
                        +
                      </button>
                    </div>
                  </Field>
                </div>

                <button
                  onClick={handleAddArticleToCart}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold py-2.5 text-xs font-semibold text-black transition hover:bg-gold/85"
                >
                  <Plus className="h-4 w-4" />
                  <span>Ajouter au panier</span>
                </button>
              </Modal>
            )}

            {/* Quick Add Category Modal */}
            {showCashierAddCategory && (
              <Modal onClose={() => setShowCashierAddCategory(false)}>
                <h3 className="mb-0.5 text-base font-semibold text-foreground">Nouvelle Catégorie</h3>
                <p className="mb-4 text-xs text-foreground/40">Code PIN Admin requis pour validation</p>

                <form onSubmit={handleCashierAddCategory} className="space-y-3">
                  <Field label="Nom de la catégorie">
                    <input
                      type="text"
                      placeholder="Ex: Sac, Chaussure..."
                      autoFocus
                      value={cashierNewCatName}
                      onChange={(e) => setCashierNewCatName(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="PIN Admin">
                    <input
                      type="password"
                      maxLength="4"
                      placeholder="••••"
                      value={cashierCatPin}
                      onChange={(e) => setCashierCatPin(e.target.value)}
                      className={cx(inputCls, 'text-center text-sm font-semibold font-mono')}
                    />
                  </Field>
                  {cashierCatError && <p className="text-[11px] font-semibold text-red-400">{cashierCatError}</p>}
                  <button type="submit" className="w-full rounded-lg bg-gold py-2.5 text-xs font-semibold text-black transition hover:bg-gold/85">
                    Créer la catégorie
                  </button>
                </form>
              </Modal>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------------
            VIEW 3: ADMIN CONSOLE
           -------------------------------------------------------------------- */}
        {currentView === 'admin' && currentUser?.role === 'ADMIN' && (
          <div className="flex-1 flex flex-col gap-5 overflow-hidden">

            <div>
              <h2 className="text-xl font-semibold text-foreground">Console Admin</h2>
              <p className="text-sm text-foreground/40">Comptabilité, ventes et configuration du terminal</p>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 overflow-x-auto border-b border-white/10">
              {adminTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id)}
                  className={cx(
                    'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition',
                    adminTab === tab.id ? 'border-gold text-gold' : 'border-transparent text-foreground/45 hover:text-foreground'
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Main Panel Content */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">

              {/* KPIs TAB */}
              {adminTab === 'kpis' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Tableau de Bord Comptable</h3>
                    <p className="text-xs text-foreground/40">Aperçu financier synthétique en temps réel</p>
                  </div>

                  <div className="grid grid-cols-2 divide-white/8 rounded-xl border border-white/10 sm:grid-cols-3 sm:divide-x">
                    {[
                      { label: "Aujourd'hui", data: stats.today },
                      { label: 'Cette Semaine', data: stats.week },
                      { label: 'Ce Mois', data: stats.month },
                    ].map(({ label, data }) => (
                      <div key={label} className="border border-white/10 p-4 sm:border-0">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/35">{label}</p>
                        <h4 className="font-mono text-xl font-semibold tabular-nums text-gold">{formatFCFA(data?.total || 0)}</h4>
                        <p className="mt-1 font-mono text-xs text-foreground/40">{data?.count || 0} ventes validées</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HISTORY TAB */}
              {adminTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold text-foreground">Journal des Ventes</h3>
                  </div>

                  {/* Toolbar */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
                      <input
                        type="text"
                        placeholder="Rechercher un numéro de ticket..."
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        className={cx(inputCls, 'w-full pl-9')}
                      />
                    </div>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className={cx(inputCls, 'w-full sm:w-auto')}
                    />
                    <button
                      onClick={() => setShowHistoryFilters(v => !v)}
                      className={cx(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition',
                        showHistoryFilters ? 'border-gold/50 text-gold' : 'border-white/10 text-foreground/60 hover:bg-white/6'
                      )}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      <span>Filtres</span>
                      {activeHistoryFilterCount > 0 && (
                        <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-black">{activeHistoryFilterCount}</span>
                      )}
                    </button>
                  </div>

                  {showHistoryFilters && (
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
                      <Field label="Caissière">
                        <select
                          value={filterCashier}
                          onChange={(e) => setFilterCashier(e.target.value)}
                          className={inputCls}
                        >
                          <option value="" className="bg-background">Tous les utilisateurs</option>
                          {users.map(u => <option key={u.id} value={u.id} className="bg-background">{u.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Statut">
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className={inputCls}
                        >
                          <option value="" className="bg-background">Tous les statuts</option>
                          <option value="VALIDATED" className="bg-background">Validée</option>
                          <option value="CANCELLED" className="bg-background">Annulée</option>
                        </select>
                      </Field>
                    </div>
                  )}

                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-xl border border-white/10 md:block">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wider text-foreground/35">
                          <th className="p-3">
                            <button onClick={() => handleSort('invoiceNumber')} className="flex items-center gap-1 hover:text-foreground/60 transition">
                              Numéro
                              {sortConfig.key === 'invoiceNumber' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                            </button>
                          </th>
                          <th className="p-3">
                            <button onClick={() => handleSort('cashier')} className="flex items-center gap-1 hover:text-foreground/60 transition">
                              Caissière
                              {sortConfig.key === 'cashier' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                            </button>
                          </th>
                          <th className="p-3">Mode</th>
                          <th className="p-3 text-right">
                            <button onClick={() => handleSort('amount')} className="ml-auto flex items-center gap-1 hover:text-foreground/60 transition">
                              Montant
                              {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                            </button>
                          </th>
                          <th className="p-3">Statut</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredSortedInvoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-semibold text-foreground">{inv.invoiceNumber}</td>
                            <td className="p-3 font-medium">{inv.createdBy.name}</td>
                            <td className="p-3 text-foreground/50">{inv.paymentMethod === 'CASH' ? 'Espèces' : 'Mobile'}</td>
                            <td className="p-3 text-right font-mono font-semibold text-gold">{formatFCFA(inv.totalAmount)}</td>
                            <td className="p-3">
                              <StatusChip tone={inv.status === 'VALIDATED' ? 'emerald' : 'red'} label={inv.status === 'VALIDATED' ? 'Validée' : 'Annulée'} />
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <IconButton icon={<Printer className="h-3.5 w-3.5" />} onClick={() => triggerPrint(inv)} title="Réimprimer" />
                                {inv.status === 'VALIDATED' && (
                                  <IconButton
                                    icon={<Ban className="h-3.5 w-3.5" />}
                                    onClick={() => { setInvoiceToCancel(inv); setCancelError(''); setCancelPin(''); setCancelReason(''); setCancelReasonOption(''); }}
                                    tone="danger"
                                    title="Annuler"
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredSortedInvoices.length === 0 && (
                      <p className="py-10 text-center text-sm italic text-foreground/30">Aucune vente ne correspond à la recherche</p>
                    )}
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {filteredSortedInvoices.map(inv => (
                      <div key={inv.id} className="rounded-xl border border-white/10 p-3 text-xs">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono font-semibold text-foreground">{inv.invoiceNumber}</span>
                          <StatusChip tone={inv.status === 'VALIDATED' ? 'emerald' : 'red'} label={inv.status === 'VALIDATED' ? 'Validée' : 'Annulée'} />
                        </div>
                        <div className="mb-2 flex items-center justify-between text-foreground/50">
                          <span>{inv.createdBy.name} · {inv.paymentMethod === 'CASH' ? 'Espèces' : 'Mobile'}</span>
                          <span className="font-mono font-semibold text-gold">{formatFCFA(inv.totalAmount)}</span>
                        </div>
                        <div className="flex items-center gap-1 border-t border-white/10 pt-2">
                          <IconButton icon={<Printer className="h-3.5 w-3.5" />} onClick={() => triggerPrint(inv)} title="Réimprimer" />
                          {inv.status === 'VALIDATED' && (
                            <IconButton
                              icon={<Ban className="h-3.5 w-3.5" />}
                              onClick={() => { setInvoiceToCancel(inv); setCancelError(''); setCancelPin(''); setCancelReason(''); setCancelReasonOption(''); }}
                              tone="danger"
                              title="Annuler"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredSortedInvoices.length === 0 && (
                      <p className="py-10 text-center text-sm italic text-foreground/30">Aucune vente ne correspond à la recherche</p>
                    )}
                  </div>
                </div>
              )}

              {/* CATEGORIES TAB */}
              {adminTab === 'categories' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Gestion des Boutons Articles</h3>
                    <p className="text-xs text-foreground/40">Configurez les catégories disponibles sur la caisse</p>
                  </div>

                  <form onSubmit={handleCreateCategory} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Ajouter un bouton</h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Nom">
                        <input
                          type="text"
                          placeholder="Ex: Robe, Chaussures..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Couleur">
                        <select
                          value={newCategoryColor}
                          onChange={(e) => setNewCategoryColor(e.target.value)}
                          className={inputCls}
                        >
                          <option value="bg-gold" className="bg-background">Gold</option>
                          <option value="bg-emerald-500" className="bg-background">Vert</option>
                          <option value="bg-amber-500" className="bg-background">Amber</option>
                          <option value="bg-red-500" className="bg-background">Rouge</option>
                        </select>
                      </Field>
                    </div>
                    <button type="submit" className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/85">
                      Créer le bouton
                    </button>
                    {categoryCreateError && <p className="text-xs font-semibold text-red-400">{categoryCreateError}</p>}
                    {categoryCreateSuccess && <p className="text-xs font-semibold text-emerald-400">{categoryCreateSuccess}</p>}
                  </form>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {categories.map(cat => (
                      <div key={cat.id} className="relative flex items-center justify-between overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className={cx('absolute bottom-0 left-0 top-0 w-1.5', cat.color || 'bg-gold')} />
                        <span className="pl-2 text-xs font-semibold text-foreground">{cat.name}</span>
                        <div className="flex items-center gap-0.5">
                          <IconButton icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => handleOpenEditCategory(cat)} title="Modifier" />
                          <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { setCategoryToDelete(cat); setCategoryDeleteError(''); }} tone="danger" title="Supprimer" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {categories.length === 0 && (
                    <p className="py-6 text-center text-sm italic text-foreground/30">Aucune catégorie configurée</p>
                  )}
                </div>
              )}

              {/* Category Delete Confirm Modal */}
              {categoryToDelete && (
                <Modal onClose={() => setCategoryToDelete(null)}>
                  <div className="mb-4 flex items-start gap-3">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400 shrink-0">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Supprimer la catégorie</h3>
                      <p className="mt-0.5 text-xs text-foreground/40">
                        Confirmez-vous la suppression de "{categoryToDelete.name}" ? Cette action est irréversible.
                      </p>
                    </div>
                  </div>
                  {categoryDeleteError && <p className="mb-3 text-xs font-semibold text-red-400">{categoryDeleteError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCategoryToDelete(null)}
                      className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-semibold text-foreground/60 transition hover:bg-white/6"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(categoryToDelete.id)}
                      className="flex-1 rounded-lg bg-red-500/90 py-2.5 text-xs font-semibold text-white transition hover:bg-red-500"
                    >
                      Supprimer
                    </button>
                  </div>
                </Modal>
              )}

              {/* Category Edit Modal */}
              {editingCategory && (
                <Modal onClose={() => setEditingCategory(null)}>
                  <h3 className="mb-0.5 text-base font-semibold text-foreground">Modifier la Catégorie</h3>
                  <p className="mb-4 text-xs text-foreground/40">Code PIN Admin requis pour validation</p>

                  <form onSubmit={handleUpdateCategory} className="space-y-3">
                    <Field label="Nom de la catégorie">
                      <input
                        type="text"
                        autoFocus
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Couleur">
                      <select
                        value={editCatColor}
                        onChange={(e) => setEditCatColor(e.target.value)}
                        className={inputCls}
                      >
                        <option value="bg-gold" className="bg-background">Gold</option>
                        <option value="bg-emerald-500" className="bg-background">Vert</option>
                        <option value="bg-amber-500" className="bg-background">Amber</option>
                        <option value="bg-red-500" className="bg-background">Rouge</option>
                      </select>
                    </Field>
                    <Field label="PIN Admin">
                      <input
                        type="password"
                        maxLength="4"
                        placeholder="••••"
                        value={editCatPin}
                        onChange={(e) => setEditCatPin(e.target.value)}
                        className={cx(inputCls, 'text-center text-sm font-semibold font-mono')}
                      />
                    </Field>
                    {editCatError && <p className="text-[11px] font-semibold text-red-400">{editCatError}</p>}
                    <button type="submit" className="w-full rounded-lg bg-gold py-2.5 text-xs font-semibold text-black transition hover:bg-gold/85">
                      Enregistrer les modifications
                    </button>
                  </form>
                </Modal>
              )}

              {/* USERS TAB */}
              {adminTab === 'users' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Gestion du Personnel</h3>
                    <p className="text-xs text-foreground/40">Ajoutez des comptes caissières</p>
                  </div>

                  <form onSubmit={handleCreateCashier} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Ajouter une caissière</h4>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        placeholder="Nom complet..."
                        value={newCashierName}
                        onChange={(e) => setNewCashierName(e.target.value)}
                        className={cx(inputCls, 'flex-1')}
                      />
                      <button type="submit" className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-gold/85">
                        Créer
                      </button>
                    </div>
                    {cashierCreateError && <p className="text-xs font-semibold text-red-400">{cashierCreateError}</p>}
                    {cashierCreateSuccess && <p className="text-xs font-semibold text-emerald-400">{cashierCreateSuccess}</p>}
                  </form>

                  <div className="space-y-2">
                    {users.map(u => (
                      <div key={u.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xs font-semibold text-gold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-foreground">{u.name}</span>
                        </div>
                        <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-foreground/40">
                          {u.role === 'ADMIN' ? 'Admin' : 'Caissière'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Z-REPORT TAB */}
              {adminTab === 'z-report' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Rapport Z de Clôture</h3>
                    <p className="text-xs text-foreground/40">Générez la clôture journalière</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center sm:py-8">
                    <Award className="mx-auto mb-3 h-9 w-9 text-gold" />
                    <h4 className="mb-1 text-sm font-semibold text-foreground">Clôturer la journée comptable</h4>
                    <p className="mx-auto mb-4 max-w-xs text-xs text-foreground/40">Génère le récapitulatif définitif des ventes pour impression.</p>
                    <button onClick={handleGenerateZReport} className="rounded-lg bg-gold px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-gold/85">
                      Générer le rapport Z
                    </button>
                  </div>

                  {zReportData && (
                    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
                      <div className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-sm font-semibold text-foreground">Synthèse du {zReportData.date}</h4>
                        <button onClick={() => triggerPrint({ isZReport: true, zReport: zReportData, createdBy: currentUser })} className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-gold/85">
                          <Printer className="h-3.5 w-3.5" />
                          <span>Imprimer Z</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-foreground/35">Total CA</span>
                          <span className="font-mono text-sm font-semibold tabular-nums text-gold">{formatFCFA(zReportData.totalSales)}</span>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-foreground/35">Espèces</span>
                          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatFCFA(zReportData.totalCash)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Cancel Modal */}
            {invoiceToCancel && (
              <Modal onClose={() => setInvoiceToCancel(null)}>
                <h3 className="mb-1 text-base font-semibold text-red-400">Annuler la Facture</h3>
                <p className="mb-4 text-xs text-foreground/40">Saisissez le motif et votre code PIN Admin</p>

                <div className="mb-4 space-y-3">
                  <Field label="Motif">
                    <select
                      value={cancelReasonOption}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCancelReasonOption(val);
                        setCancelReason(val === 'Autre' ? '' : val);
                      }}
                      className={inputCls}
                    >
                      <option value="" className="bg-background">Sélectionner un motif...</option>
                      {CANCEL_REASONS.map(r => <option key={r} value={r} className="bg-background">{r}</option>)}
                    </select>
                  </Field>
                  {cancelReasonOption === 'Autre' && (
                    <input
                      type="text"
                      placeholder="Précisez le motif..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className={inputCls}
                      autoFocus
                    />
                  )}
                  <Field label="PIN Admin">
                    <input
                      type="password"
                      maxLength="4"
                      placeholder="••••"
                      value={cancelPin}
                      onChange={(e) => setCancelPin(e.target.value)}
                      className={cx(inputCls, 'text-center text-sm font-semibold font-mono')}
                    />
                  </Field>
                </div>

                {cancelError && <p className="mb-3 text-xs font-semibold text-red-400">{cancelError}</p>}

                <button onClick={handleCancelInvoiceSubmit} className="w-full rounded-lg bg-red-500/90 py-2.5 text-xs font-semibold text-white transition hover:bg-red-500">
                  Confirmer l'annulation
                </button>
              </Modal>
            )}

          </div>
        )}
      </main>
    </div>
  );
}