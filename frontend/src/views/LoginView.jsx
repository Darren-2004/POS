import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowLeft, ShieldCheck } from 'lucide-react';
import Field, { inputCls } from '../components/Field';
import { cx } from '../utils/helpers';
import { API_BASE } from '../utils/constants';

export default function LoginView({ users, serverOnline, setCurrentUser, setCurrentView }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetPinStep, setResetPinStep] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    if (!selectedUser) return;
    const onKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') handleKeypadPress(e.key);
      else if (e.key === 'Backspace') handleKeypadClear();
      else if (e.key === 'Enter') resetPinStep ? handleResetPinSubmit() : handleLoginSubmit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedUser, resetPinStep, newPin, confirmPin, enteredPin]);

  const pinInputRef = useRef(null);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setEnteredPin('');
    setAuthError('');
    setResetPinStep(false);
    setTimeout(() => pinInputRef.current?.focus(), 0);
  };

  const handleKeypadPress = (val) => {
    setAuthError('');
    if (resetPinStep) {
      if (newPin.length < 4) setNewPin(prev => prev + val);
      else if (confirmPin.length < 4) {
        const next = confirmPin + val;
        setConfirmPin(next);
        if (next.length === 4) {
          // auto-confirm when both pins are 4 digits
          setTimeout(handleResetPinSubmit, 0);
        }
      }
    } else {
      if (enteredPin.length < 4) {
        const next = enteredPin + val;
        setEnteredPin(next);
        if (next.length === 4) {
          // auto-login on 4th digit
          setTimeout(() => handleLoginSubmitWith(next), 0);
        }
      }
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

  const handleLoginSubmitWith = async (pin) => {
    if (!pin || pin.length < 4) {
      setAuthError('Code PIN à 4 chiffres requis');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, pin })
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
    } catch {
      setAuthError('Connexion impossible au serveur central');
      setEnteredPin('');
    }
  };

  const handleLoginSubmit = () => handleLoginSubmitWith(enteredPin);

  const handleResetPinSubmit = async () => {
    if (newPin.length < 4) {
      setAuthError('Le code PIN doit comporter 4 chiffres');
      return;
    }
    if (confirmPin.length > 0) {
      if (confirmPin.length < 4) {
        setAuthError('Le code de confirmation doit comporter 4 chiffres');
        return;
      }
      if (newPin !== confirmPin) {
        setAuthError('Les codes PIN ne correspondent pas');
        setConfirmPin('');
        return;
      }
    }
    try {
      const res = await fetch(`${API_BASE}/auth/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, oldPin: enteredPin, newPin })
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Erreur de réinitialisation'); return; }
      
      const updatedUser = { ...selectedUser, needsPinReset: false };
      setCurrentUser(updatedUser);
      setCurrentView(updatedUser.role === 'ADMIN' ? 'admin' : 'cashier');
    } catch {
      setAuthError('Erreur lors du changement de PIN');
    }
  };

  const filteredUsers = users.filter(u => {
    const nameMatch = u.name.toLowerCase().includes(profileSearch.toLowerCase());
    if (!nameMatch) return false;
    return isAdminMode ? u.role === 'ADMIN' : u.role !== 'ADMIN';
  });

  return (
    <div className="flex-1 flex items-center justify-center py-6">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
        {!selectedUser ? (
          <div>
            <div className="mb-6 text-center">
              <div className="text-gold font-black text-2xl tracking-[0.2em] mb-1">JOEL SHOP</div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {isAdminMode ? 'Espace Administrateur' : 'Identification Terminal'}
              </h2>
              <p className="mt-1 text-sm text-foreground/40">
                {isAdminMode ? 'Sélectionnez le compte administrateur' : 'Sélectionnez votre compte caisse'}
              </p>
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
            <div className="grid max-h-[calc(100vh-280px)] grid-cols-2 gap-3 overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <div className="col-span-2 text-center text-xs text-foreground/40 py-6 italic">
                  Aucun compte trouvé.
                </div>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className="group flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center transition hover:bg-white/6 cursor-pointer"
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
                ))
              )}
            </div>

            {/* Toggle button for Admin Mode confidentiality */}
            {!isAdminMode ? (
              <button
                type="button"
                onClick={() => setIsAdminMode(true)}
                className="mt-5 flex items-center justify-center gap-2 w-full rounded-xl border border-gold/20 bg-gold/5 hover:bg-gold/15 py-2.5 text-xs font-bold text-gold transition cursor-pointer shadow-sm"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Accès Espace Administrateur</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdminMode(false)}
                className="mt-5 flex items-center justify-center gap-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] py-2.5 text-xs font-semibold text-foreground/70 transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour aux comptes caissières</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <input ref={pinInputRef} aria-hidden="true" className="sr-only" onKeyDown={(e) => {
              // prevent the global window key handler from also receiving this event
              e.stopPropagation();
              if (e.key >= '0' && e.key <= '9') { e.preventDefault(); handleKeypadPress(e.key); }
              else if (e.key === 'Backspace') { e.preventDefault(); handleKeypadClear(); }
              else if (e.key === 'Enter') { e.preventDefault(); resetPinStep ? handleResetPinSubmit() : handleLoginSubmit(); }
            }} />
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
  );
}