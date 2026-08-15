import React, { useState } from 'react';
import IconButton from '../../components/IconButton';
import Modal from '../../components/Modal';
import Field, { inputCls } from '../../components/Field';
import ConfirmModal from '../../components/ConfirmModal';
import { Trash2, Pencil, Plus, FolderPlus, Tag, Check, X } from 'lucide-react';
import { API_BASE } from '../../utils/constants';

export default function Categories({ categories = [], fetchCategories }) {
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [pendingDeleteCat, setPendingDeleteCat] = useState(null);

  // Subcategory inline addition state per category: { [catId]: string }
  const [addingSubForCat, setAddingSubForCat] = useState(null);
  const [newSubName, setNewSubName] = useState('');

  // Subcategory inline editing state: { id, name }
  const [editingSub, setEditingSub] = useState(null);
  const [editSubName, setEditSubName] = useState('');
  const [pendingDeleteSub, setPendingDeleteSub] = useState(null);

  // --- Category CRUD ---
  const createCategory = async () => {
    if (!newCatName.trim()) return alert('Nom de la catégorie requis');
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() })
      });
      if (res.ok) {
        setShowCreateCat(false);
        setNewCatName('');
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la création');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
    }
  };

  const saveEditCategory = async () => {
    if (!editCatName.trim()) return alert('Nom requis');
    try {
      const res = await fetch(`${API_BASE}/categories/${editingCat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCatName.trim() })
      });
      if (res.ok) {
        setEditingCat(null);
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la mise à jour');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
    }
  };

  const confirmDeleteCategory = async () => {
    const c = pendingDeleteCat;
    if (!c) return setPendingDeleteCat(null);
    try {
      const res = await fetch(`${API_BASE}/categories/${c.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la suppression');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
    }
    setPendingDeleteCat(null);
  };

  // --- SubCategory CRUD ---
  const createSubCategory = async (categoryId) => {
    if (!newSubName.trim()) return alert('Nom de la sous-catégorie requis');
    try {
      const res = await fetch(`${API_BASE}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubName.trim(), categoryId })
      });
      if (res.ok) {
        setAddingSubForCat(null);
        setNewSubName('');
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la création de la sous-catégorie');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
    }
  };

  const saveEditSubCategory = async () => {
    if (!editSubName.trim()) return alert('Nom requis');
    try {
      const res = await fetch(`${API_BASE}/subcategories/${editingSub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editSubName.trim() })
      });
      if (res.ok) {
        setEditingSub(null);
        setEditSubName('');
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la mise à jour');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
    }
  };

  const confirmDeleteSubCategory = async () => {
    const sub = pendingDeleteSub;
    if (!sub) return setPendingDeleteSub(null);
    try {
      const res = await fetch(`${API_BASE}/subcategories/${sub.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories && fetchCategories();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la suppression');
      }
    } catch (e) {
      console.error(e);
      alert('Erreur réseau');
    }
    setPendingDeleteSub(null);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/[0.015] p-4 border border-white/5">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-gold" />
            Catégories & Sous-Catégories
          </h3>
          <p className="text-xs text-foreground/50 mt-0.5">
            Gérez vos catégories principales et ajoutez des sous-catégories directement sur le même écran.
          </p>
        </div>
        <button
          onClick={() => setShowCreateCat(true)}
          className="flex items-center gap-1.5 rounded-xl bg-gold text-black px-4 py-2 text-xs font-bold hover:bg-gold/90 transition shadow-md cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Nouvelle Catégorie
        </button>
      </div>

      {/* Categories Grid / List */}
      <div className="grid gap-4 md:grid-cols-2">
        {categories.length === 0 ? (
          <div className="md:col-span-2 rounded-2xl bg-white/[0.01] border border-white/5 p-8 text-center text-foreground/40 italic">
            Aucune catégorie configurée pour l'instant. Cliquez sur "Nouvelle Catégorie" pour commencer.
          </div>
        ) : (
          categories.map(cat => (
            <div
              key={cat.id}
              className="rounded-2xl bg-white/[0.015] border border-white/10 p-4 space-y-4 hover:border-white/20 transition shadow-sm"
            >
              {/* Category Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-sm">
                    {cat.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{cat.name}</h4>
                    <span className="text-[10px] text-foreground/40">
                      {cat.subCategories?.length || 0} sous-catégorie(s)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setAddingSubForCat(cat.id);
                      setNewSubName('');
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-gold bg-gold/10 hover:bg-gold/20 border border-gold/30 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    title="Ajouter une sous-catégorie sur ce même écran"
                  >
                    <Plus className="h-3 w-3" />
                    Sous-catégorie
                  </button>
                  <IconButton
                    icon={<Pencil className="h-3.5 w-3.5 text-foreground/70" />}
                    onClick={() => {
                      setEditingCat(cat);
                      setEditCatName(cat.name);
                    }}
                    title="Éditer catégorie"
                  />
                  <IconButton
                    icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />}
                    onClick={() => setPendingDeleteCat(cat)}
                    title="Supprimer catégorie"
                  />
                </div>
              </div>

              {/* Inline Form to Add Subcategory (Without changing screen) */}
              {addingSubForCat === cat.id && (
                <div className="bg-neutral-900 border border-gold/40 rounded-xl p-3 space-y-2 animate-in fade-in duration-150">
                  <div className="text-[11px] font-bold text-gold flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Ajouter une sous-catégorie dans "{cat.name}"
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nom de la sous-catégorie (ex: Mocassins, Baskets...)"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          createSubCategory(cat.id);
                        } else if (e.key === 'Escape') {
                          setAddingSubForCat(null);
                        }
                      }}
                      className="flex-1 bg-white/[0.05] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold"
                    />
                    <button
                      type="button"
                      onClick={() => createSubCategory(cat.id)}
                      className="bg-gold text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-gold/90 transition cursor-pointer"
                    >
                      Ajouter
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingSubForCat(null)}
                      className="bg-white/10 text-foreground/60 text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/20 transition cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Subcategories List */}
              <div className="space-y-2">
                {(!cat.subCategories || cat.subCategories.length === 0) ? (
                  <div className="text-xs text-foreground/35 italic py-1">
                    Aucune sous-catégorie enregistrée. Cliquer sur "+ Sous-catégorie" pour en ajouter une.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cat.subCategories.map(sub => (
                      <div
                        key={sub.id}
                        className="group flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl px-2.5 py-1 text-xs transition"
                      >
                        {editingSub?.id === sub.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={editSubName}
                              onChange={(e) => setEditSubName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); saveEditSubCategory(); }
                                else if (e.key === 'Escape') setEditingSub(null);
                              }}
                              className="bg-neutral-900 border border-gold rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none w-28"
                            />
                            <button onClick={saveEditSubCategory} className="text-emerald-400 p-0.5 hover:scale-110">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingSub(null)} className="text-foreground/50 p-0.5 hover:scale-110">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Tag className="h-3 w-3 text-gold/70" />
                            <span className="text-foreground/85 font-medium">{sub.name}</span>
                            <div className="flex items-center gap-1 ml-1 opacity-60 group-hover:opacity-100 transition">
                              <button
                                onClick={() => {
                                  setEditingSub(sub);
                                  setEditSubName(sub.name);
                                }}
                                className="text-foreground/50 hover:text-gold p-0.5 transition"
                                title="Modifier sous-catégorie"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setPendingDeleteSub(sub)}
                                className="text-foreground/50 hover:text-red-400 p-0.5 transition"
                                title="Supprimer sous-catégorie"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Création de Catégorie */}
      <Modal open={showCreateCat} onClose={() => setShowCreateCat(false)} title="Créer une nouvelle catégorie">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createCategory(); }}>
          <Field label="Nom de la catégorie">
            <input
              autoFocus
              className={inputCls}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="ex: Chaussures, Sacs, Accessoires..."
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs text-foreground/80 hover:bg-white/10 font-medium"
              onClick={() => setShowCreateCat(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gold text-black px-4 py-2 text-xs font-bold hover:bg-gold/90 transition shadow-sm"
            >
              Créer Catégorie
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Édition de Catégorie */}
      <Modal open={!!editingCat} onClose={() => setEditingCat(null)} title="Modifier la catégorie">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveEditCategory(); }}>
          <Field label="Nom de la catégorie">
            <input
              autoFocus
              className={inputCls}
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
              placeholder="Nom"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs text-foreground/80 hover:bg-white/10 font-medium"
              onClick={() => setEditingCat(null)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gold text-black px-4 py-2 text-xs font-bold hover:bg-gold/90 transition shadow-sm"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Category Modal */}
      <ConfirmModal
        open={!!pendingDeleteCat}
        title="Supprimer la catégorie"
        message={pendingDeleteCat ? `Supprimer la catégorie "${pendingDeleteCat.name}" et toutes ses sous-catégories ?` : ''}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setPendingDeleteCat(null)}
      />

      {/* Confirm Delete SubCategory Modal */}
      <ConfirmModal
        open={!!pendingDeleteSub}
        title="Supprimer la sous-catégorie"
        message={pendingDeleteSub ? `Supprimer la sous-catégorie "${pendingDeleteSub.name}" ?` : ''}
        onConfirm={confirmDeleteSubCategory}
        onCancel={() => setPendingDeleteSub(null)}
      />
    </div>
  );
}
