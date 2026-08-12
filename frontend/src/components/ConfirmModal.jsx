import React from 'react';
import Modal from './Modal';

export default function ConfirmModal({ open, title = 'Confirmer', message, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} widthCls="max-w-sm">
      <div className="space-y-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-sm text-foreground/70">{message}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md bg-white/[0.04] px-3 py-1">Annuler</button>
          <button onClick={onConfirm} className="rounded-md bg-red-600 px-3 py-1 text-white">Supprimer</button>
        </div>
      </div>
    </Modal>
  );
}
