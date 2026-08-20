export const formatFCFA = (amount = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' FCFA';

export const cx = (...classes) => classes.filter(Boolean).join(' ');

export const getTodayDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getPaymentMethodLabel = (method) => {
  if (method === 'CASH') return 'Espèces';
  if (method === 'ONLINE') return 'Mobile Money';
  if (method === 'ORANGE_MONEY') return 'Orange Money';
  return 'Non précisé';
};

export const showToast = (message, type = 'success') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos:toast', { detail: { message, type } }));
  }
};

let lastPrintedId = null;
let lastPrintTimestamp = 0;
let isPrintingBusy = false;

export const triggerPrint = (invoiceData) => {
  const now = Date.now();
  const printId = invoiceData.invoiceNumber || invoiceData.id || JSON.stringify(invoiceData.items || []);

  if (isPrintingBusy || (lastPrintedId === printId && now - lastPrintTimestamp < 6000) || (now - lastPrintTimestamp < 3500)) {
    showToast("⏳ Impression déjà en cours, veuillez patienter...", "info");
    return;
  }
  isPrintingBusy = true;
  lastPrintedId = printId;
  lastPrintTimestamp = now;

  const isZ = invoiceData.isZReport;
  const zr = invoiceData.zReport;

  const groupItems = (items = []) => {
    const map = {};
    items.forEach(item => {
      const key = `${item.categoryName}||${item.price}`;
      if (!map[key]) map[key] = { categoryName: item.categoryName, price: item.price, qty: 0 };
      map[key].qty += 1;
    });
    return Object.values(map);
  };

  const itemsRows = !isZ
    ? `
      <table style="width:100%;border-collapse:collapse;margin:0;font-size:10px;">
        <thead>
          <tr style="border-bottom:1px solid #000;">
            <th style="text-align:left;padding:2px 1px;font-weight:bold;">Désignation</th>
            <th style="text-align:center;padding:2px 1px;font-weight:bold;">Qté</th>
            <th style="text-align:right;padding:2px 1px;font-weight:bold;">P/U</th>
            <th style="text-align:right;padding:2px 1px;font-weight:bold;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${groupItems(invoiceData.items).map(item => `
          <tr>
            <td style="padding:2px 1px;text-align:left;">${item.categoryName}</td>
            <td style="padding:2px 1px;text-align:center;">${item.qty}</td>
            <td style="padding:2px 1px;text-align:right;">${Math.round(item.price).toLocaleString('fr-FR')}</td>
            <td style="padding:2px 1px;text-align:right;font-weight:bold;">${Math.round(item.price * item.qty).toLocaleString('fr-FR')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '';

  const topSellingRows = isZ
    ? (zr.topSelling || []).map(cat => `
        <div style="display:flex;justify-content:space-between;margin:3px 0;">
          <span>${cat.name} (x${cat.quantity})</span>
          <span>${Math.round(cat.revenue).toLocaleString('fr-FR')} FCFA</span>
        </div>`).join('')
    : '';

  const printHTML = isZ ? `
    <div style="text-align:center;margin-bottom:8px;">
      <h2 style="margin:0;font-size:18pt;letter-spacing:2px;">JOEL SHOP</h2>
      <h3 style="margin:2px 0;font-size:12pt;">RAPPORT DE CLÔTURE (Z)</h3>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
    </div>
    <div style="font-size:11pt;">
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Date:</span><span>${zr.date} ${zr.time}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Opérateur:</span><span>${invoiceData.createdBy?.name || 'Admin'}</span></div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="font-weight:bold;font-size:12pt;margin-bottom:4px;">SYNTHÈSE COMPTABLE</div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;font-size:13pt;font-weight:bold;margin:4px 0;"><span>TOTAL NET:</span><span>${Math.round(zr.totalSales).toLocaleString('fr-FR')} FCFA</span></div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Espèces:</span><span>${Math.round(zr.totalCash || zr.payments?.CASH || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Mobile Money:</span><span>${Math.round(zr.totalOnline || zr.payments?.ONLINE || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Orange Money:</span><span>${Math.round(zr.payments?.ORANGE_MONEY || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Ventes Validées:</span><span>${zr.validatedCount}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Ventes Annulées:</span><span>${zr.cancelledCount}</span></div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="font-weight:bold;font-size:12pt;margin-bottom:4px;">RÉPARTITION PAR CATÉGORIE</div>
      ${topSellingRows}
      <p style="text-align:center;margin-top:16px;font-size:11pt;font-weight:bold;">--- FIN DU RAPPORT Z ---</p>
    </div>
  ` : `
    <div style="text-align:center;margin-bottom:8px;">
      <h2 style="margin:0;font-size:20pt;font-weight:bold;letter-spacing:3px;">JOEL SHOP</h2>
      <p style="margin:2px 0;font-size:11pt;letter-spacing:1px;font-weight:bold;">─── TICKET DE CAISSE ───</p>
    </div>
    <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="font-size:11pt;">
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>N° Ticket:</span><b style="font-size:11pt;">${invoiceData.invoiceNumber}</b></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Date:</span><span>${new Date(invoiceData.createdAt).toLocaleString('fr-FR')}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Caissière:</span><span>${invoiceData.createdBy?.name || 'Caissière'}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Client:</span><span>${invoiceData.clientName || 'Client de passage'}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Règlement:</span><span>${getPaymentMethodLabel(invoiceData.paymentMethod)}</span></div>
    </div>
    <p style="margin:6px 0;border-bottom:1.5px dashed #000;"></p>
    ${itemsRows}
    <p style="margin:6px 0;border-top:2px solid #000;border-bottom:2px solid #000;"></p>
    <div style="font-size:13.5pt;font-weight:bold;display:flex;justify-content:space-between;align-items:center;white-space:nowrap;margin-top:6px;">
      <span>TOTAL À PAYER:</span><span>${Math.round(invoiceData.totalAmount).toLocaleString('fr-FR')} FCFA</span>
    </div>
    <p style="text-align:center;margin-top:18px;font-size:11pt;font-weight:bold;">Merci de votre visite !<br>À bientôt chez JOEL SHOP</p>
  `;

  const fullHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm 300mm; margin: 0mm; }
          * { box-sizing: border-box; }
          html, body {
            width: 76mm;
            margin: 0 auto;
            padding: 2mm 1mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11pt;
            font-weight: bold;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
          }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10.5pt; }
          th { padding: 3px 1px; font-weight: bold; border-bottom: 2px solid #000; white-space: nowrap; }
          td { padding: 3px 1px; white-space: nowrap; }
        </style>
      </head>
      <body>${printHTML}</body>
    </html>`;

  // Impression 100% silencieuse via le serveur backend — 0 popup, 0 aperçu, 0 dialog
  fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: fullHtml, invoiceData })
  })
    .then(async (res) => {
      if (res.ok) {
        showToast("🖨️ Ticket envoyé à l'imprimante !", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`⚠️ Problème d'impression : ${err.error || 'Imprimante non disponible'}`, "error");
      }
    })
    .catch((err) => {
      console.error('Print request failed:', err);
      showToast("⚠️ Erreur de connexion avec le service d'impression.", "error");
    })
    .finally(() => {
      setTimeout(() => { isPrintingBusy = false; }, 2000);
    });
};

export const triggerProformaPrint = (reservation) => {
  const now = Date.now();
  if (isPrintingBusy || now - lastPrintTimestamp < 3000) {
    showToast("⏳ Impression déjà en cours, veuillez patienter...", "info");
    return;
  }
  isPrintingBusy = true;
  lastPrintTimestamp = now;

  const paymentsList = (reservation.payments || []).map((p, idx) => `
    <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;">
      <span>Tranche ${p.installmentNumber || idx + 1}/3 (${getPaymentMethodLabel(p.paymentMethod)}):</span>
      <span>${Math.round(p.amount).toLocaleString('fr-FR')} FCFA</span>
    </div>
  `).join('');

  const itemsList = (reservation.items || []).map(item => `
    <tr>
      <td style="padding:3px 1px;text-align:left;white-space:nowrap;">${item.categoryName}</td>
      <td style="padding:3px 1px;text-align:center;">${item.qty || 1}</td>
      <td style="padding:3px 1px;text-align:right;">${Math.round(item.price).toLocaleString('fr-FR')}</td>
      <td style="padding:3px 1px;text-align:right;font-weight:bold;">${Math.round(item.price * (item.qty || 1)).toLocaleString('fr-FR')}</td>
    </tr>
  `).join('');

  const totalPaid = (reservation.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (Number(reservation.totalAmount) || 0) - totalPaid);

  const printHTML = `
    <div style="text-align:center;margin-bottom:8px;">
      <h2 style="margin:0;font-size:18pt;font-weight:bold;letter-spacing:3px;">JOEL SHOP</h2>
      <p style="margin:2px 0;font-size:10.5pt;letter-spacing:1px;font-weight:bold;">─── REÇU PROFORMA (RÉSERVATION) ───</p>
    </div>
    <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="font-size:11pt;">
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>N° Réservation:</span><b>${reservation.reservationNo}</b></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Date:</span><span>${new Date(reservation.createdAt).toLocaleString('fr-FR')}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Client:</span><span>${reservation.clientName}${reservation.clientPhone ? ` (${reservation.clientPhone})` : ''}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Enregistré par:</span><span>${reservation.createdBy?.name || 'Caissière'}</span></div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;margin:3px 0;"><span>Statut:</span><b>${reservation.status === 'COMPLETED' ? 'PAYÉE À 100%' : 'EN COURS DE PAIEMENT'}</b></div>
    </div>
    <p style="margin:6px 0;border-bottom:1.5px dashed #000;"></p>
    <table style="width:100%;border-collapse:collapse;margin:6px 0;font-size:10.5pt;">
      <thead>
        <tr style="border-bottom:2px solid #000;">
          <th style="text-align:left;padding:3px 1px;font-weight:bold;white-space:nowrap;">Désignation</th>
          <th style="text-align:center;padding:3px 1px;font-weight:bold;">Qté</th>
          <th style="text-align:right;padding:3px 1px;font-weight:bold;">P/U</th>
          <th style="text-align:right;padding:3px 1px;font-weight:bold;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsList}</tbody>
    </table>
    <p style="margin:6px 0;border-top:2px solid #000;border-bottom:2px solid #000;"></p>
    <div style="font-size:11pt;">
      <div style="display:flex;justify-content:space-between;white-space:nowrap;font-weight:bold;font-size:12pt;">
        <span>MONTANT TOTAL:</span><span>${Math.round(reservation.totalAmount).toLocaleString('fr-FR')} FCFA</span>
      </div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="font-weight:bold;margin:4px 0 2px 0;">HISTORIQUE DES VERSEMENTS (${reservation.payments?.length || 0}/3):</div>
      ${paymentsList || '<div style="font-style:italic;">Aucun versement effectué</div>'}
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;font-weight:bold;font-size:12pt;">
        <span>TOTAL DÉJÀ PAYÉ:</span><span>${Math.round(totalPaid).toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;white-space:nowrap;font-weight:bold;font-size:13pt;margin-top:3px;">
        <span>RESTE À PAYER:</span><span>${Math.round(remaining).toLocaleString('fr-FR')} FCFA</span>
      </div>
    </div>
    <p style="text-align:center;margin-top:18px;font-size:10pt;font-weight:bold;">
      Document Proforma de Réservation.<br>
      La facture définitive est remise après solde complet.<br>
      Merci pour votre confiance - JOEL SHOP
    </p>
  `;

  const fullHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm 300mm; margin: 0mm; }
          * { box-sizing: border-box; }
          html, body {
            width: 76mm;
            margin: 0 auto;
            padding: 2mm 1mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11pt;
            font-weight: bold;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
          }
          table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10.5pt; }
          th { padding: 3px 1px; font-weight: bold; border-bottom: 2px solid #000; white-space: nowrap; }
          td { padding: 3px 1px; white-space: nowrap; }
        </style>
      </head>
      <body>${printHTML}</body>
    </html>`;

  // Impression 100% silencieuse via le serveur backend — 0 popup, 0 aperçu, 0 dialog
  fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: fullHtml, reservation })
  })
    .then(async (res) => {
      if (res.ok) {
        showToast("🖨️ Reçu Proforma envoyé à l'imprimante !", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`⚠️ Problème d'impression : ${err.error || 'Imprimante non disponible'}`, "error");
      }
    })
    .catch((err) => {
      console.error('Proforma print request failed:', err);
      showToast("⚠️ Erreur de connexion avec le service d'impression.", "error");
    })
    .finally(() => {
      setTimeout(() => { isPrintingBusy = false; }, 2000);
    });
};