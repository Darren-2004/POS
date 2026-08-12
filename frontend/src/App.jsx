import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LoginView from './views/LoginView';
import CashierView from './views/CashierView';
import AdminView from './views/AdminView';
import { API_BASE } from './utils/constants';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [serverOnline, setServerOnline] = useState(true);
  const [currentView, setCurrentView] = useState('login');

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
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) setCategories(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('login');
  };

  return (
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
    </div>
  );
}