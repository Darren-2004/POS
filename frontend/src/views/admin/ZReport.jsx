import React, { useState } from 'react';
import IconButton from '../../components/IconButton';
import { Award, Printer } from 'lucide-react';
import { formatFCFA } from '../../utils/helpers';

export default function ZReport({ zReportData, onGenerate, onPrint }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Rapport Z</h3>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border border-white/6 rounded-md px-2 py-1 text-sm" />
          <IconButton icon={<Award className="h-4 w-4" />} onClick={() => onGenerate && onGenerate(date)} title="Générer" />
          {zReportData && <IconButton icon={<Printer className="h-3.5 w-3.5" />} onClick={() => onPrint && onPrint(zReportData)} title="Imprimer" />}
        </div>
      </div>

      {zReportData ? (
        <div className="rounded-2xl bg-white/[0.01] p-4 text-foreground/90">
          <div className="text-2xl font-semibold">Total ventes: {formatFCFA(zReportData.total)}</div>
          <div className="text-lg mt-2">Transactions: {zReportData.count}</div>
          {zReportData.payments && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.keys(zReportData.payments).map(key => (
                <div key={key} className="rounded-md bg-white/[0.02] p-2 text-sm">
                  <div className="text-xs text-foreground/60">Mode: {key}</div>
                  <div className="mt-1 text-lg font-semibold text-gold">{formatFCFA(zReportData.payments[key])}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.01] p-4 text-sm text-foreground/60">Aucun rapport généré.</div>
      )}
    </div>
  );
}
