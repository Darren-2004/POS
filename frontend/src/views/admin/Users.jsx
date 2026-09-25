import React, { useState } from 'react';
import IconButton from '../../components/IconButton';
import Modal from '../../components/Modal';
import Field, { inputCls } from '../../components/Field';
import ConfirmModal from '../../components/ConfirmModal';
import { Trash2, Pencil, User as UserIcon } from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { cx } from '../../utils/helpers';

export default function Users({ users = [], fetchUsers, currentUser }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPermissions, setNewPermissions] = useState('ALL');

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editPermissions, setEditPermissions] = useState('ALL');

  const createUser = async () => {
    try {
      if (!newName) return alert('Nom requis');
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, pin: newPin, permissions: newPermissions })
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName('');
        setNewPin('');
        setNewPermissions('ALL');
        fetchUsers && fetchUsers();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la création');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
  };

  const startEdit = (u) => {
    setEditing(u);
    setEditName(u.name);
    setEditPin('');
    setEditPermissions(u.permissions || 'ALL');
  };

  const saveEdit = async () => {
    try {
      if (!editName) return alert('Nom requis');
      const bodyData = {
        name: editName,
        permissions: editPermissions
      };
      if (editPin && editPin.trim().length >= 4) {
        bodyData.pin = editPin.trim();
      }

      const res = await fetch(`${API_BASE}/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        setEditing(null);
        fetchUsers && fetchUsers();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la mise à jour');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
  };

  const deleteUser = async (u) => {
    setPendingDeleteUser(u);
  };

  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);

  const confirmDeleteUser = async () => {
    const u = pendingDeleteUser;
    if (!u) return setPendingDeleteUser(null);
    try {
      const res = await fetch(`${API_BASE}/users/${u.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers && fetchUsers();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la suppression');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
    setPendingDeleteUser(null);
  };

  const renderPermissionsBadge = (perm) => {
    switch (perm) {
      case 'DIRECT_SALE':
        return <span className="inline-block rounded-md bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-400">Caisse (Ventes &amp; Réservations)</span>;
      case 'CUSTOMER_SERVICE':
        return <span className="inline-block rounded-md bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-400">Service client (Livraisons & Réservations)</span>;
      case 'ALL':
      default:
        return <span className="inline-block rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Tous les droits</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Gestion des caissières</h3>
        <button className="rounded-md bg-gold text-black font-bold px-3 py-1 text-xs cursor-pointer" onClick={() => setShowCreate(true)}>+ Créer une caissière</button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white/[0.01]">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase text-foreground/35">
              <th className="p-3">Nom</th>
              <th className="p-3">Rôle</th>
              <th className="p-3">Droits d'accès</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-3 font-medium text-foreground">{u.name}</td>
                <td className="p-3 text-xs text-foreground/60">{u.role === 'ADMIN' ? 'Administrateur' : 'Caissière'}</td>
                <td className="p-3 text-xs">{u.role === 'ADMIN' ? <span className="text-gold font-bold">Accès Admin complet</span> : renderPermissionsBadge(u.permissions)}</td>
                <td className="p-3 text-center">
                  <IconButton icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => startEdit(u)} title="Editer" />
                  {u.role !== 'ADMIN' && (
                    <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => deleteUser(u)} title="Supprimer" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Création */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer une caissière">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createUser(); }}>
          <Field label="Nom de la caissière *">
            <input autoFocus className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Marie" />
          </Field>
          <Field label="Code PIN initial (Optionnel, 4 chiffres)">
            <input
              type="text"
              maxLength="6"
              className={inputCls}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Ex: 1234 (0000 par défaut)"
            />
          </Field>
          <Field label="Droits d'accès">
            <select
              value={newPermissions}
              onChange={(e) => setNewPermissions(e.target.value)}
              className={cx(inputCls, 'bg-zinc-900 border-white/10 text-foreground text-xs font-semibold cursor-pointer')}
            >
              <option value="ALL">Tous les droits (Ventes, Livraisons &amp; Réservations)</option>
              <option value="DIRECT_SALE">Caisse — Ventes directes &amp; Réservations (sans livraisons)</option>
              <option value="CUSTOMER_SERVICE">Service client — Livraisons &amp; Réservations (sans vente directe)</option>
            </select>
          </Field>
          <div className="flex justify-end pt-2">
            <button type="submit" className="rounded-xl bg-gold text-black font-bold px-4 py-2 text-xs cursor-pointer">Créer le compte</button>
          </div>
        </form>
      </Modal>

      {/* Modal Édition */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editer les accès de la caissière">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
          <Field label="Nom de la caissière *">
            <input autoFocus className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" />
          </Field>
          <Field label="Nouveau Code PIN / Mot de passe (Optionnel)">
            <input
              type="text"
              maxLength="6"
              className={inputCls}
              value={editPin}
              onChange={(e) => setEditPin(e.target.value)}
              placeholder="Laissez vide pour conserver le PIN actuel"
            />
          </Field>
          {editing?.role !== 'ADMIN' && (
            <Field label="Droits d'accès">
              <select
                value={editPermissions}
                onChange={(e) => setEditPermissions(e.target.value)}
                className={cx(inputCls, 'bg-zinc-900 border-white/10 text-foreground text-xs font-semibold cursor-pointer')}
              >
                <option value="ALL">Tous les droits (Ventes, Livraisons &amp; Réservations)</option>
                <option value="DIRECT_SALE">Caisse — Ventes directes &amp; Réservations (sans livraisons)</option>
                <option value="CUSTOMER_SERVICE">Service client — Livraisons &amp; Réservations (sans vente directe)</option>
              </select>
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-xl bg-white/[0.04] px-4 py-2 text-xs font-semibold" onClick={() => setEditing(null)}>Annuler</button>
            <button type="submit" className="rounded-xl bg-gold text-black font-bold px-4 py-2 text-xs cursor-pointer">Enregistrer les modifications</button>
          </div>
        </form>
      </Modal>
      <ConfirmModal open={!!pendingDeleteUser} title="Supprimer la caissière" message={pendingDeleteUser ? `Supprimer la caissière ${pendingDeleteUser.name} ?` : ''} onConfirm={confirmDeleteUser} onCancel={() => setPendingDeleteUser(null)} />
    </div>
  );
}
