import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LoginView from './views/LoginView';
import CashierView from './views/CashierView';
import AdminView from './views/AdminView';
import { API_BASE } from './utils/constants';
import { WifiOff, Printer, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cx } from './utils/helpers';

// Error Boundary to prevent full blank-screen crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('React ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#f87171', background: '#0a0a0a', minHeight: '100vh' }}>
          <h2 style={{ color: '#fbbf24' }}>⚠ Une erreur est survenue</h2>
          <p style={{ color: '#a1a1aa' }}>{this.state.error?.message || 'Erreur inconnue'}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{ marginTop: 16, padding: '8px 20px', background: '#fbbf24', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [serverOnline, setServerOnline] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type = 'success' } = e.detail || {};
      setToast({ message, type });
      setTimeout(() => setToast(null), 4500);
    };
    window.addEventListener('pos:toast', handleToast);
    return () => window.removeEventListener('pos:toast', handleToast);
  }, []);

  const [currentView, setCurrentView] = useState(() => {
    try {
      const savedUser = localStorage.getItem('pos_user');
      const savedView = localStorage.getItem('pos_view');
      if (savedUser && savedView) return savedView;
      if (savedUser) {
        const u = JSON.parse(savedUser);
        return u.role === 'ADMIN' ? 'admin' : 'cashier';
      }
      return 'login';
    } catch {
      return 'login';
    }
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pos_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('pos_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentView && currentView !== 'login') {
      localStorage.setItem('pos_view', currentView);
    } else {
      localStorage.removeItem('pos_view');
    }
  }, [currentView]);

  useEffect(() => {
    checkServerConnection();
    fetchUsers();
    fetchCategories();
    const interval = setInterval(checkServerConnection, 4000);
    return () => clearInterval(interval);
  }, []);

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
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('login');
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_view');
  };

  return (
    <ErrorBoundary>
      <div className="h-screen overflow-hidden flex flex-col bg-background text-foreground font-sans antialiased">
        {!serverOnline && (
          <div className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400">
            <WifiOff className="h-4 w-4 animate-pulse" />
            <span>Connexion au serveur POS interrompue.</span>
          </div>
        )}

        <Header
          currentUser={currentUser}
          serverOnline={serverOnline}
          currentView={currentView}
          setCurrentView={setCurrentView}
          onLogout={handleLogout}
        />

        <main className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
          {currentView === 'login' && (
            <LoginView
              users={users}
              serverOnline={serverOnline}
              setCurrentUser={setCurrentUser}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'cashier' && (
            <CashierView
              categories={categories}
              currentUser={currentUser}
              serverOnline={serverOnline}
            />
          )}

          {currentView === 'admin' && currentUser?.role === 'ADMIN' && (
            <AdminView
              currentUser={currentUser}
              users={users}
              categories={categories}
              fetchUsers={fetchUsers}
              fetchCategories={fetchCategories}
            />
          )}
        </main>

        {/* Global Toast Notification for Printer & System status */}
        {toast && (
          <div className={cx(
            'fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl animate-in slide-in-from-bottom-5 duration-200 text-xs font-bold transition-all',
            toast.type === 'error'
              ? 'bg-red-950/95 border-red-500/50 text-red-300 shadow-red-500/20'
              : 'bg-emerald-950/95 border-emerald-500/50 text-emerald-300 shadow-emerald-500/20'
          )}>
            {toast.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-red-400" /> : <Printer className="h-4 w-4 shrink-0 text-emerald-400" />}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}