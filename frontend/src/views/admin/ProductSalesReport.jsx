import React, { useState } from 'react';
import { PackageSearch, Printer, TrendingUp, RefreshCw } from 'lucide-react';
import { formatFCFA, getTodayDateStr } from '../../utils/helpers';
import { API_BASE } from '../../utils/constants';

const SHOP_NAME = 'JOEL SHOP';

export default function ProductSalesReport() {
  const today = getTodayDateStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePreset = (type) => {
    const now = new Date();
    const todayStr = getTodayDateStr();
    if (type === 'today') {
      setStartDate(todayStr); setEndDate(todayStr);
    } else if (type === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (type === 'month') {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setReportData(null);
    try {
      const url = `${API_BASE}/product-sales-report?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url);
      if (!res.ok) { setError('Erreur lors de la récupération du rapport.'); return; }
      const data = await res.json();
      setReportData(data);
    } catch (e) {
      console.error(e);
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!reportData) return;

    const formatNum = (n) => Math.round(n).toLocaleString('fr-FR');

    const rows = reportData.products.map(p =>
      `<tr style="border-bottom:0.5px solid #ddd;">
        <td style="padding:5px 4px;word-break:break-word;">${p.name}</td>
        <td style="padding:5px 4px;text-align:center;font-weight:bold;">${p.quantity}</td>
        <td style="padding:5px 4px;text-align:right;font-weight:bold;">${formatNum(p.total)} FCFA</td>
      </tr>`
    ).join('');

    const dateLabel = startDate === endDate
      ? new Date(startDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : `Du ${new Date(startDate + 'T12:00:00').toLocaleDateString('fr-FR')} au ${new Date(endDate + 'T12:00:00').toLocaleDateString('fr-FR')}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 10pt; color: #000; background: #fff; }
    h1 { text-align: center; font-size: 16pt; letter-spacing: 3px; margin: 0 0 4px; }
    .subtitle { text-align: center; font-size: 9pt; margin: 2px 0; }
    .period { text-align: center; font-size: 10pt; font-weight: bold; margin: 6px 0 2px; }
    .niu { text-align: center; font-size: 8.5pt; margin-bottom: 8px; }
    hr { border: none; border-top: 1.5px dashed #000; margin: 6px 0; }
    hr.solid { border-top: 2px solid #000; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th { font-size: 9pt; font-weight: bold; border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 5px 4px; text-align: left; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3) { text-align: right; }
    tbody tr:nth-child(even) { background: #f5f5f5; }
    tfoot td { font-weight: bold; border-top: 2px solid #000; padding: 6px 4px; }
    .total-box { margin-top: 10px; border: 2px solid #000; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 12pt; font-weight: bold; }
    .footer { margin-top: 20px; text-align: center; font-size: 8pt; }
  </style>
</head>
<body>
  <h1>${SHOP_NAME}</h1>
  <div class="subtitle">─── RAPPORT DÉTAILLÉ DES VENTES PAR CATÉGORIE ───</div>
  <div class="niu">NIU: P079216781512Z</div>
  <hr>
  <div class="period">Période : ${dateLabel}</div>
  <div class="subtitle">Généré le ${new Date().toLocaleString('fr-FR')}</div>
  <hr class="solid">
  <table>
    <thead>
      <tr>
        <th style="width:50%">Désignation / Catégorie</th>
        <th style="width:20%;text-align:center;">Qté</th>
        <th style="width:30%;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTAL GÉNÉRAL (${reportData.products.length} catégories — ${reportData.totalQuantity} articles)</td>
        <td style="text-align:right;font-size:12pt;">${formatNum(reportData.grandTotal)} FCFA</td>
      </tr>
    </tfoot>
  </table>
  <hr class="solid">
  <div class="footer">
    Rapport généré automatiquement — Fait par © TriSpark Digital
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const dateLabel = reportData
    ? (startDate === endDate
        ? new Date(startDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        : `Du ${new Date(startDate + 'T12:00:00').toLocaleDateString('fr-FR')} au ${new Date(endDate + 'T12:00:00').toLocaleDateString('fr-FR')}`)
    : '';

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="rounded-2xl bg-white/[0.03] p-5 border border-white/10 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-gold" />
            Rapport Détaillé des Ventes par Catégorie
          </h3>

          <div className="flex gap-2">
            {['today', 'week', 'month'].map((p, i) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePreset(p)}
                className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-foreground/80 transition cursor-pointer"
              >
                {i === 0 ? "Aujourd'hui" : i === 1 ? 'Cette semaine' : 'Ce mois-ci'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground/90">Du :</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-800 text-white font-bold border-2 border-gold/70 hover:border-gold rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer transition shadow-md"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground/90">Au :</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-800 text-white font-bold border-2 border-gold/70 hover:border-gold rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gold/50 [color-scheme:dark] cursor-pointer transition shadow-md"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gold hover:bg-gold/90 text-black px-6 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-gold/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {loading
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <TrendingUp className="h-4 w-4" />}
              {loading ? 'Chargement...' : 'Générer le rapport'}
            </button>

            {reportData && (
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-foreground px-4 py-2.5 text-xs font-bold transition border border-white/20 shadow-md cursor-pointer"
              >
                <Printer className="h-4 w-4 text-gold" />
                Imprimer le rapport
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-sm font-semibold text-red-400">
          ⚠ {error}
        </div>
      )}

      {/* Results Table */}
      {reportData ? (
        <div className="rounded-2xl bg-white/[0.015] border border-white/5 overflow-hidden">
          {/* Summary Banner */}
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-white/[0.02]">
            <div>
              <div className="text-xs uppercase font-bold text-gold tracking-wider">{dateLabel}</div>
              <div className="text-2xl font-black text-foreground mt-0.5">
                {formatFCFA(reportData.grandTotal)}
              </div>
              <div className="text-xs text-foreground/50 mt-0.5">
                {reportData.products.length} catégories · {reportData.totalQuantity} articles vendus
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-gold hover:bg-gold/90 text-black px-4 py-2 text-xs font-black shadow-lg shadow-gold/20 transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>
          </div>

          {/* Product Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-foreground/50 text-[10px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Désignation / Catégorie</th>
                  <th className="px-4 py-3 text-center">Quantité</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {reportData.products.map((product, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? 'bg-white/[0.008]' : ''}
                  >
                    <td className="px-4 py-3 font-medium text-foreground/90">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-gold/15 text-gold border border-gold/30 rounded-lg px-2.5 py-0.5 font-black tabular-nums">
                        ×{product.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                      {formatFCFA(product.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gold/5 border-t-2 border-gold/30">
                  <td className="px-4 py-3 font-black text-foreground text-sm" colSpan={2}>
                    TOTAL GÉNÉRAL · {reportData.totalQuantity} articles
                  </td>
                  <td className="px-4 py-3 text-right font-black text-gold text-base tabular-nums">
                    {formatFCFA(reportData.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : !loading && (
        <div className="rounded-2xl bg-white/[0.01] p-8 text-center text-sm text-foreground/40 italic border border-white/5">
          Sélectionnez la période et cliquez sur &quot;GÉNÉRER LE RAPPORT&quot; pour afficher le détail des ventes par catégorie.
        </div>
      )}
    </div>
  );
}
