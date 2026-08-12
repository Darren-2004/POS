import React from 'react';
import StatusChip from '../../components/StatusChip';
import IconButton from '../../components/IconButton';
import ConfirmModal from '../../components/ConfirmModal';
import { formatFCFA, triggerPrint } from '../../utils/helpers';
import { Printer, Trash2 } from 'lucide-react';
import { API_BASE } from '../../utils/constants';

export default function Dashboard({ stats = {}, invoices = [], users = [], filterDate, setFilterDate, filterCashier, setFilterCashier, fetchInvoices }) {
  const totalsByCashier = Object.values(invoices.reduce((acc, inv) => {
    const id = inv.createdBy?.id || 'unknown';
    const name = inv.createdBy?.name || 'N/A';
    if (!acc[id]) acc[id] = { id, name, total: 0, count: 0 };
    acc[id].total += Number(inv.totalAmount) || 0;
    acc[id].count += 1;
    return acc;
  }, {}));

  const [pendingDeleteInvoice, setPendingDeleteInvoice] = React.useState(null);

  const confirmDeleteInvoice = async () => {
    const inv = pendingDeleteInvoice;
    if (!inv) return setPendingDeleteInvoice(null);
    try {
      const res = await fetch(`${API_BASE}/invoices/${inv.id}`, { method: 'DELETE' });
      if (res.ok) {
        // refresh invoices via passed callback if available
        if (typeof fetchInvoices === 'function') fetchInvoices();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Erreur lors de la suppression');
      }
    } catch (e) { console.error(e); alert('Erreur'); }
    setPendingDeleteInvoice(null);
  };
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Aujourd’hui', data: stats.today },
          { label: 'Cette semaine', data: stats.week },
          { label: 'Ce mois', data: stats.month },
        ].map(({ label, data }) => (
          <div key={label} className="rounded-2xl bg-white/[0.015] p-4 text-sm text-foreground/80">
            <div className="text-[10px] uppercase tracking-[0.24em] text-foreground/40">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-gold">{formatFCFA(data?.total || 0)}</div>
            <div className="mt-1 text-xs text-foreground/40">{data?.count || 0} ventes</div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-foreground/60">Caissière</label>
            <select value={filterCashier || ''} onChange={(e) => setFilterCashier(e.target.value)} className="bg-white/[0.04] border border-white/6 rounded-md px-2 py-1 text-sm text-foreground">
              <option value="">Toutes</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-foreground/60">Date</label>
            <input type="date" value={filterDate || ''} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent border border-white/6 rounded-md px-2 py-1 text-sm" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white/[0.01]">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase text-foreground/35">
                <th className="p-3">Numéro</th>
                <th className="p-3">Caissière</th>
                <th className="p-3 text-right">Montant</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td className="p-3 font-mono font-semibold">{inv.invoiceNumber}</td>
                  <td className="p-3 font-medium">{inv.createdBy?.name || 'N/A'}</td>
                  <td className="p-3 text-right font-mono text-gold">{formatFCFA(inv.totalAmount)}</td>
                  <td className="p-3"><StatusChip tone={inv.status === 'VALIDATED' ? 'emerald' : 'red'} label={inv.status === 'VALIDATED' ? 'Validée' : 'Annulée'} /></td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <IconButton icon={<Printer className="h-3.5 w-3.5" />} onClick={() => triggerPrint(inv)} title="Imprimer" />
                      <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setPendingDeleteInvoice(inv)} title="Supprimer" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ConfirmModal open={!!pendingDeleteInvoice} title="Supprimer la facture" message={pendingDeleteInvoice ? `Supprimer la facture ${pendingDeleteInvoice.invoiceNumber} ?` : ''} onConfirm={confirmDeleteInvoice} onCancel={() => setPendingDeleteInvoice(null)} />
    </div>
  );
}
