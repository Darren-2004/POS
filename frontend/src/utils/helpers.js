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
      <div style="width:100%; margin:4px 0; font-size:8.5pt;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:2px;">
          <span style="flex:1; text-align:left;">Désignation</span>
          <span style="width:180px; display:flex; justify-content:space-between;">
            <span style="width:40px; text-align:center;">Qté</span>
            <span style="width:10px; text-align:center;"></span>
            <span style="width:60px; text-align:right;">P/U</span>
            <span style="width:10px; text-align:center;"></span>
            <span style="width:60px; text-align:right;">Total</span>
          </span>
        </div>
        <!-- Items -->
        ${groupItems(invoiceData.items).map(item => `
        <div style="display:flex; justify-content:space-between; border-bottom:0.5px solid #eee; padding:3px 0; align-items:flex-start;">
          <span style="flex:1; text-align:left; word-break:break-word; overflow-wrap:break-word; padding-right:4px;">${item.categoryName}</span>
          <span style="width:180px; display:flex; justify-content:space-between; flex-wrap:wrap; align-items:flex-start;">
            <span style="width:40px; text-align:center;">${item.qty}</span>
            <span style="width:10px; text-align:center;">|</span>
            <span style="width:60px; text-align:right;">${Math.round(item.price).toLocaleString('fr-FR')}</span>
            <span style="width:10px; text-align:center;">|</span>
            <span style="width:60px; text-align:right; font-weight:bold; word-break:break-all;">${Math.round(item.price * item.qty).toLocaleString('fr-FR')}</span>
          </span>
        </div>
        `).join('')}
      </div>`
    : '';

  const topSellingRows = isZ
    ? (zr.topSelling || []).map(cat => `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;word-break:break-word;">
          <span style="flex:1;min-width:0;word-break:break-word;">${cat.name} (x${cat.quantity})</span>
          <span style="word-break:break-all;margin-left:4px;">${Math.round(cat.revenue).toLocaleString('fr-FR')} FCFA</span>
        </div>`).join('')
    : '';

  let clientNameStr = invoiceData.clientName || '';
  let clientPhoneStr = invoiceData.clientPhone || '';

  if (!clientPhoneStr && clientNameStr.includes('(') && clientNameStr.includes(')')) {
    const match = clientNameStr.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      clientNameStr = match[1].trim();
      clientPhoneStr = match[2].trim();
    }
  } else if (!clientPhoneStr && /^[0-9+\s-]+$/.test(clientNameStr.trim())) {
    clientPhoneStr = clientNameStr.trim();
    clientNameStr = '';
  }

  const hasName = clientNameStr && clientNameStr !== 'Client de passage';
  const hasPhone = Boolean(clientPhoneStr);

  const printHTML = isZ ? `
    <div style="text-align:center;margin-bottom:8px;">
      <h2 style="margin:0;font-size:16pt;letter-spacing:2px;">JOEL SHOP</h2>
      <h3 style="margin:2px 0;font-size:11pt;">RAPPORT DE CLÔTURE (Z)</h3>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
    </div>
    <div style="font-size:9pt;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Date:</span><span style="white-space:nowrap;">${zr.date} ${zr.time}</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Opérateur:</span><span style="word-break:break-word;">${invoiceData.createdBy?.name || 'Admin'}</span></div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="font-weight:bold;font-size:10pt;margin-bottom:4px;">SYNTHÈSE COMPTABLE</div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-size:11pt;font-weight:bold;margin:4px 0;"><span>TOTAL NET:</span><span>${Math.round(zr.totalSales).toLocaleString('fr-FR')} FCFA</span></div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Espèces:</span><span>${Math.round(zr.totalCash || zr.payments?.CASH || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Mobile Money:</span><span>${Math.round(zr.totalOnline || zr.payments?.ONLINE || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Orange Money:</span><span>${Math.round(zr.payments?.ORANGE_MONEY || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Ventes Validées:</span><span>${zr.validatedCount}</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Ventes Annulées:</span><span>${zr.cancelledCount}</span></div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="font-weight:bold;font-size:10pt;margin-bottom:4px;">RÉPARTITION PAR CATÉGORIE</div>
      ${topSellingRows}
      <p style="text-align:center;margin-top:16px;font-size:9pt;font-weight:bold;">--- FIN DU RAPPORT Z ---</p>
    </div>
  ` : `
    <div style="text-align:center;margin-bottom:2px;">
      <h2 style="margin:0;font-size:16pt;font-weight:bold;letter-spacing:2px;">JOEL SHOP</h2>
      <p style="margin:2px 0;font-size:9pt;letter-spacing:1px;font-weight:bold;">─── TICKET DE CAISSE ───</p>
      <p style="margin:2px 0;font-size:8.5pt;font-weight:bold;">NIU: P079216781512Z</p>
    </div>
    <p style="margin:3px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="font-size:9pt;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;">
        <span>N° Ticket:</span>
        <span style="font-weight:bold;word-break:break-all;">${invoiceData.invoiceNumber}</span>
      </div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;"><span>Date:</span><span style="white-space:nowrap;">${new Date(invoiceData.createdAt).toLocaleString('fr-FR')}</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;"><span>Caissière:</span><span style="word-break:break-word;">${invoiceData.createdBy?.name || 'Caissière'}</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;"><span>Règlement:</span><span>${getPaymentMethodLabel(invoiceData.paymentMethod)}</span></div>
      ${hasName ? `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;">
        <span>Nom client:</span>
        <span style="font-weight:bold;word-break:break-word;text-align:right;flex:1;min-width:0;">${clientNameStr}</span>
      </div>` : ''}
      ${hasPhone ? `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;">
        <span>Tél client:</span>
        <span style="font-weight:bold;word-break:break-all;text-align:right;">${clientPhoneStr}</span>
      </div>` : ''}
    </div>
    <p style="margin:5px 0;border-bottom:1.5px dashed #000;"></p>
    ${itemsRows}
    <p style="margin:5px 0;border-top:2px solid #000;border-bottom:2px solid #000;"></p>
    <div style="font-size:11pt;font-weight:bold;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-top:5px;">
      <span>TOTAL À PAYER:</span><span style="word-break:break-all;">${Math.round(invoiceData.totalAmount).toLocaleString('fr-FR')} FCFA</span>
    </div>
    <p style="text-align:center;margin-top:14px;font-size:9pt;font-weight:bold;">Merci de votre visite !</p>
    <div style="text-align:center;margin-top:8px;font-size:7.5pt;color:#000;font-weight:bold;">Fait par © TriSpark Digital</div>
  `;

  const fullHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm 300mm; margin: 0mm; }
          * { box-sizing: border-box; }
          html, body {
            width: 70mm;
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 9pt;
            font-weight: bold;
            color: #000;
            background: #fff;
            word-break: break-word;
            overflow-wrap: break-word;
            -webkit-print-color-adjust: exact;
          }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 8.5pt; table-layout: fixed; }
          th { padding: 2px 1px; font-weight: bold; border-bottom: 2px solid #000; word-break: break-word; }
          td { padding: 2px 1px; word-break: break-word; }
        </style>
      </head>
      <body>${printHTML}</body>
    </html>`;

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
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;">
      <span>Tranche ${p.installmentNumber || idx + 1}/3 (${getPaymentMethodLabel(p.paymentMethod)}):</span>
      <span style="word-break:break-all;">${Math.round(p.amount).toLocaleString('fr-FR')} FCFA</span>
    </div>
  `).join('');

  const itemsList = (reservation.items || []).map(item => `
    <div style="display:flex; justify-content:space-between; border-bottom:0.5px solid #eee; padding:3px 0; align-items:flex-start;">
      <span style="flex:1; text-align:left; word-break:break-word; overflow-wrap:break-word; padding-right:4px;">${item.categoryName}</span>
      <span style="width:180px; display:flex; justify-content:space-between; flex-wrap:wrap; align-items:flex-start;">
        <span style="width:40px; text-align:center;">${item.qty || 1}</span>
        <span style="width:10px; text-align:center;">|</span>
        <span style="width:60px; text-align:right;">${Math.round(item.price).toLocaleString('fr-FR')}</span>
        <span style="width:10px; text-align:center;">|</span>
        <span style="width:60px; text-align:right; font-weight:bold; word-break:break-all;">${Math.round(item.price * (item.qty || 1)).toLocaleString('fr-FR')}</span>
      </span>
    </div>
  `).join('');

  const totalPaid = (reservation.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (Number(reservation.totalAmount) || 0) - totalPaid);

  const printHTML = `
    <div style="text-align:center;margin-bottom:2px;">
      <h2 style="margin:0;font-size:16pt;font-weight:bold;letter-spacing:2px;">JOEL SHOP</h2>
      <p style="margin:2px 0;font-size:9pt;letter-spacing:1px;font-weight:bold;">─── REÇU PROFORMA (RÉSERVATION) ───</p>
      <p style="margin:2px 0;font-size:8.5pt;font-weight:bold;">NIU: P079216781512Z</p>
    </div>
    <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="font-size:9pt;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>N° Réservation:</span><span style="font-weight:bold;word-break:break-all;">${reservation.reservationNo}</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Date:</span><span style="white-space:nowrap;">${new Date(reservation.createdAt).toLocaleString('fr-FR')}</span></div>
      ${reservation.clientName ? `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;">
        <span>Nom client:</span>
        <span style="font-weight:bold;word-break:break-word;text-align:right;flex:1;min-width:0;">${reservation.clientName}</span>
      </div>` : ''}
      ${reservation.clientPhone ? `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;">
        <span>Tél client:</span>
        <span style="font-weight:bold;word-break:break-all;text-align:right;">${reservation.clientPhone}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Enregistré par:</span><span style="word-break:break-word;">${reservation.createdBy?.name || 'Caissière'}</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;"><span>Statut:</span><b>${reservation.status === 'COMPLETED' ? 'PAYÉE À 100%' : 'EN COURS DE PAIEMENT'}</b></div>
    </div>
    <p style="margin:6px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="width:100%; margin:4px 0; font-size:8.5pt;">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:2px;">
        <span style="flex:1; text-align:left;">Désignation</span>
        <span style="width:180px; display:flex; justify-content:space-between;">
          <span style="width:40px; text-align:center;">Qté</span>
          <span style="width:10px; text-align:center;"></span>
          <span style="width:60px; text-align:right;">P/U</span>
          <span style="width:10px; text-align:center;"></span>
          <span style="width:60px; text-align:right;">Total</span>
        </span>
      </div>
      ${itemsList}
    </div>
    <p style="margin:6px 0;border-top:2px solid #000;border-bottom:2px solid #000;"></p>
    <div style="font-size:9pt;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-weight:bold;font-size:10pt;">
        <span>MONTANT TOTAL:</span><span style="word-break:break-all;">${Math.round(reservation.totalAmount).toLocaleString('fr-FR')} FCFA</span>
      </div>
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="font-weight:bold;margin:4px 0 2px 0;">HISTORIQUE DES VERSEMENTS (${reservation.payments?.length || 0}/3):</div>
      ${paymentsList || '<div style="font-style:italic;">Aucun versement effectué</div>'}
      <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-weight:bold;font-size:10pt;">
        <span>TOTAL DÉJÀ PAYÉ:</span><span style="word-break:break-all;">${Math.round(totalPaid).toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-weight:bold;font-size:11pt;margin-top:3px;">
        <span>RESTE À PAYER:</span><span style="word-break:break-all;">${Math.round(remaining).toLocaleString('fr-FR')} FCFA</span>
      </div>
    </div>
    <p style="text-align:center;margin-top:14px;font-size:8.5pt;font-weight:bold;">
      Document Proforma de Réservation.<br>
      La facture définitive est remise après solde complet.<br>
      Merci pour votre confiance - JOEL SHOP
    </p>
    <div style="text-align:center;margin-top:8px;font-size:7.5pt;color:#000;font-weight:bold;">Fait par © TriSpark Digital</div>
  `;

  const fullHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm 300mm; margin: 0mm; }
          * { box-sizing: border-box; }
          html, body {
            width: 70mm;
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 9pt;
            font-weight: bold;
            color: #000;
            background: #fff;
            word-break: break-word;
            overflow-wrap: break-word;
            -webkit-print-color-adjust: exact;
          }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 8.5pt; table-layout: fixed; }
          th { padding: 2px 1px; font-weight: bold; border-bottom: 2px solid #000; word-break: break-word; }
          td { padding: 2px 1px; word-break: break-word; }
        </style>
      </head>
      <body>${printHTML}</body>
    </html>`;

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

// ─── Final Definitive Invoice print (from reservation settlement) ───────────
export const triggerFinalReservationPrint = (invoiceData) => {
  if (isPrintingBusy) {
    showToast("⏳ Impression déjà en cours, veuillez patienter...", "info");
    return;
  }
  isPrintingBusy = true;

  const payments = invoiceData.reservationPayments || [];
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const groupItems = (items = []) => {
    const map = {};
    items.forEach(item => {
      const key = `${item.categoryName}||${item.price}`;
      if (!map[key]) map[key] = { categoryName: item.categoryName, price: item.price, qty: 0 };
      map[key].qty += 1;
    });
    return Object.values(map);
  };

  const itemsRows = `
    <div style="width:100%; margin:4px 0; font-size:8.5pt;">
      <div style="display:flex; justify-content:space-between; font-weight:bold; border-bottom:1.5px solid #000; padding-bottom:2px;">
        <span style="flex:1; text-align:left;">Désignation</span>
        <span style="width:180px; display:flex; justify-content:space-between;">
          <span style="width:40px; text-align:center;">Qté</span>
          <span style="width:10px; text-align:center;"></span>
          <span style="width:60px; text-align:right;">P/U</span>
          <span style="width:10px; text-align:center;"></span>
          <span style="width:60px; text-align:right;">Total</span>
        </span>
      </div>
      ${groupItems(invoiceData.items || []).map(item => `
      <div style="display:flex; justify-content:space-between; border-bottom:0.5px solid #eee; padding:3px 0; align-items:flex-start;">
        <span style="flex:1; text-align:left; word-break:break-word; overflow-wrap:break-word; padding-right:4px;">${item.categoryName}</span>
        <span style="width:180px; display:flex; justify-content:space-between; flex-wrap:wrap; align-items:flex-start;">
          <span style="width:40px; text-align:center;">${item.qty}</span>
          <span style="width:10px; text-align:center;">|</span>
          <span style="width:60px; text-align:right;">${Math.round(item.price).toLocaleString('fr-FR')}</span>
          <span style="width:10px; text-align:center;">|</span>
          <span style="width:60px; text-align:right; font-weight:bold; word-break:break-all;">${Math.round(item.price * item.qty).toLocaleString('fr-FR')}</span>
        </span>
      </div>
      `).join('')}
    </div>`;

  const paymentsRows = payments.map((p, idx) => `
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:3px 0;font-size:8.5pt;">
      <span>Tranche ${p.installmentNumber || idx + 1}/3 (${getPaymentMethodLabel(p.paymentMethod)}):</span>
      <span style="font-weight:bold;word-break:break-all;">${Math.round(p.amount).toLocaleString('fr-FR')} FCFA</span>
    </div>
  `).join('');

  const printHTML = `
    <div style="text-align:center;margin-bottom:2px;">
      <h2 style="margin:0;font-size:16pt;font-weight:bold;letter-spacing:2px;">JOEL SHOP</h2>
      <p style="margin:2px 0;font-size:9pt;letter-spacing:1px;font-weight:bold;">─── FACTURE DÉFINITIVE ───</p>
      <p style="margin:2px 0;font-size:8.5pt;font-weight:bold;">NIU: P079216781512Z</p>
    </div>
    <p style="margin:3px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="font-size:8.5pt;background:#f0f0f0;padding:4px 3px;border-radius:3px;margin-bottom:4px;text-align:center;font-weight:bold;">
       SOLDE FINAL — Réservation N° ${invoiceData.sourceReservationNo || ''}
    </div>
    <div style="font-size:9pt;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;">
        <span>N° Facture:</span>
        <span style="font-weight:bold;word-break:break-all;">${invoiceData.invoiceNumber}</span>
      </div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;"><span>Date:</span><span>${new Date(invoiceData.createdAt).toLocaleString('fr-FR')}</span></div>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;"><span>Caissière:</span><span>${invoiceData.createdBy?.name || 'Caissière'}</span></div>
      ${invoiceData.clientName ? `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;"><span>Client:</span><span style="font-weight:bold;word-break:break-word;">${invoiceData.clientName}</span></div>` : ''}
      ${invoiceData.clientPhone ? `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin:2px 0;"><span>Tél:</span><span style="font-weight:bold;">${invoiceData.clientPhone}</span></div>` : ''}
    </div>
    <p style="margin:5px 0;border-bottom:1.5px dashed #000;"></p>
    ${itemsRows}
    <p style="margin:5px 0;border-top:2px solid #000;border-bottom:2px solid #000;"></p>
    <div style="font-size:11pt;font-weight:bold;display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:5px;">
      <span>TOTAL COMMANDE:</span><span style="word-break:break-all;">${Math.round(invoiceData.totalAmount).toLocaleString('fr-FR')} FCFA</span>
    </div>
    <p style="margin:6px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="font-weight:bold;margin:4px 0 2px 0;font-size:9pt;">HISTORIQUE DES VERSEMENTS (${payments.length}/3) :</div>
    ${paymentsRows || '<div style="font-style:italic;font-size:8.5pt;">Aucun versement enregistré</div>'}
    <p style="margin:4px 0;border-bottom:1.5px dashed #000;"></p>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-weight:bold;font-size:10pt;">
      <span>TOTAL PAYÉ:</span><span style="word-break:break-all;">${Math.round(totalPaid).toLocaleString('fr-FR')} FCFA</span>
    </div>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-weight:bold;font-size:11pt;margin-top:3px;color:#000;">
      <span>SOLDE RESTANT:</span><span>0 FCFA </span>
    </div>
    <p style="text-align:center;margin-top:12px;font-size:9pt;font-weight:bold;border:1.5px solid #000;padding:4px;">
      RÉSERVATION ENTIÈREMENT SOLDÉE<br>Merci de votre confiance !
    </p>
    <p style="text-align:center;margin-top:14px;font-size:9pt;font-weight:bold;">Merci de votre visite !</p>
    <div style="text-align:center;margin-top:8px;font-size:7.5pt;color:#000;font-weight:bold;">Fait par © TriSpark Digital</div>
  `;

  const fullHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm 300mm; margin: 0mm; }
          * { box-sizing: border-box; }
          html, body {
            width: 70mm;
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 9pt;
            font-weight: bold;
            color: #000;
            background: #fff;
            word-break: break-word;
            overflow-wrap: break-word;
            -webkit-print-color-adjust: exact;
          }
        </style>
      </head>
      <body>${printHTML}</body>
    </html>`;

  fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: fullHtml, invoiceData })
  })
    .then(async (res) => {
      if (res.ok) {
        showToast("🖨️ Facture définitive envoyée à l'imprimante !", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`⚠️ Problème d'impression : ${err.error || 'Imprimante non disponible'}`, "error");
      }
    })
    .catch((err) => {
      console.error('Final invoice print request failed:', err);
      showToast("⚠️ Erreur de connexion avec le service d'impression.", "error");
    })
    .finally(() => {
      setTimeout(() => { isPrintingBusy = false; }, 2000);
    });
};