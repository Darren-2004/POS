import React, { useState } from 'react';
import IconButton from '../../components/IconButton';
import Modal from '../../components/Modal';
import Field, { inputCls } from '../../components/Field';
import ConfirmModal from '../../components/ConfirmModal';
import { Trash2, Pencil, User as UserIcon } from 'lucide-react';
import { API_BASE } from '../../utils/constants';

export default function Users({ users = [], fetchUsers, currentUser }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [newPin, setNewPin] = useState('');

  const createUser = async () => {
    try {
      if (!newName) return alert('Nom requis');
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, pin: newPin })
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName('');
        setNewPin('');
        fetchUsers && fetchUsers();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la création');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
  };

  const startEdit = (u) => { setEditing(u); setEditName(u.name); };

  const saveEdit = async () => {
    try {
      if (!editName) return alert('Nom requis');
      const res = await fetch(`${API_BASE}/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Gestion des caissières</h3>
        <button className="rounded-md bg-white/[0.04] px-3 py-1 text-sm" onClick={() => setShowCreate(true)}>Créer</button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white/[0.01]">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase text-foreground/35">
              <th className="p-3">Nom</th>
              <th className="p-3">Rôle</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 text-sm text-foreground/60">{u.role}</td>
                <td className="p-3 text-center">
                  <IconButton icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => startEdit(u)} title="Editer" />
                  <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => deleteUser(u)} title="Supprimer" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer une caissière">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createUser(); }}>
          <Field label="Nom de la caissière">
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
          <div className="flex justify-end pt-2">
            <button type="submit" className="rounded-xl bg-gold text-black font-bold px-4 py-2 text-xs">Créer le compte</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editer caissière">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
          <Field label="Nom">
            <input autoFocus className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md bg-white/[0.04] px-3 py-1" onClick={() => setEditing(null)}>Annuler</button>
            <button type="submit" className="rounded-md bg-white/[0.06] px-3 py-1">Sauvegarder</button>
          </div>
        </form>
      </Modal>
      <ConfirmModal open={!!pendingDeleteUser} title="Supprimer la caissière" message={pendingDeleteUser ? `Supprimer la caissière ${pendingDeleteUser.name} ?` : ''} onConfirm={confirmDeleteUser} onCancel={() => setPendingDeleteUser(null)} />
    </div>
  );
}
