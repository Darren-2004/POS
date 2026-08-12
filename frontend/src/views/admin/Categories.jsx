import React, { useState } from 'react';
import IconButton from '../../components/IconButton';
import Modal from '../../components/Modal';
import Field, { inputCls } from '../../components/Field';
import ConfirmModal from '../../components/ConfirmModal';
import { Trash2, Pencil } from 'lucide-react';
import { API_BASE } from '../../utils/constants';

export default function Categories({ categories = [], fetchCategories, currentUser }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');

  const createCategory = async () => {
    if (!newName) return alert('Nom requis');
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName('');
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
  };

  const startEdit = (c) => { setEditing(c); setEditName(c.name); };

  const saveEdit = async () => {
    if (!editName) return alert('Nom requis');
    try {
      const res = await fetch(`${API_BASE}/categories/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
      });
      if (res.ok) {
        setEditing(null);
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
  };

  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteCategory = (c) => setPendingDelete(c);

  const confirmDeleteCategory = async () => {
    const c = pendingDelete;
    if (!c) return setPendingDelete(null);
    try {
      const res = await fetch(`${API_BASE}/categories/${c.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
    setPendingDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Catégories</h3>
        <button className="rounded-md bg-white/[0.04] px-3 py-1 text-sm" onClick={() => setShowCreate(true)}>Créer</button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white/[0.01] p-4">
        <div className="text-sm text-foreground/60 mb-3">Catégories configurées</div>
        <div className="grid gap-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/[0.03] h-8 w-8 flex items-center justify-center text-foreground/60"><div className="h-4 w-4" /></div>
                <div className="font-medium">{cat.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <IconButton icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => startEdit(cat)} title="Editer" />
                <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => deleteCategory(cat)} title="Supprimer" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer catégorie">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createCategory(); }}>
          <Field label="Nom">
            <input autoFocus className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de la catégorie" />
          </Field>
          <div className="flex justify-end">
            <button type="submit" className="rounded-md bg-white/[0.04] px-3 py-1">Créer</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editer catégorie">
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
      <ConfirmModal open={!!pendingDelete} title="Supprimer la catégorie" message={pendingDelete ? `Supprimer la catégorie ${pendingDelete.name} ?` : ''} onConfirm={confirmDeleteCategory} onCancel={() => setPendingDelete(null)} />
    </div>
  );
}
