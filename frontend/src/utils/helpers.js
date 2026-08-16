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

export const triggerPrint = (invoiceData) => {
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
    <div style="text-align:center;margin-bottom:8px;font-family:monospace;">
      <h2 style="margin:0;font-size:13px;font-weight:bold;letter-spacing:2px;">JOEL SHOP</h2>
      <p style="margin:2px 0 0 0;font-size:11px;">RAPPORT DE CLÔTURE (Z)</p>
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
    </div>
    <div style="font-size:10px;font-family:monospace;">
      <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${zr.date} ${zr.time}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Operateur:</span><span>${invoiceData.createdBy?.name || 'Admin'}</span></div>
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      <div style="font-weight:bold;margin-bottom:4px;">SYNTHÈSE COMPTABLE</div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;"><span>TOTAL NET:</span><span>${Math.round(zr.totalSales).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Espèces:</span><span>${Math.round(zr.totalCash || zr.payments?.CASH || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Mobile Money:</span><span>${Math.round(zr.totalOnline || zr.payments?.ONLINE || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Orange Money:</span><span>${Math.round(zr.payments?.ORANGE_MONEY || 0).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Ventes Validées:</span><span>${zr.validatedCount}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Ventes Annulées:</span><span>${zr.cancelledCount}</span></div>
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      <div style="font-weight:bold;margin-bottom:4px;">RÉPARTITION PAR CATÉGORIE</div>
      ${topSellingRows}
      <p style="text-align:center;margin-top:12px;font-size:10px;">--- FIN DU RAPPORT Z ---</p>
    </div>
  ` : `
    <div style="text-align:center;margin-bottom:6px;font-family:monospace;">
      <h2 style="margin:0;font-size:15px;font-weight:bold;letter-spacing:3px;">JOEL SHOP</h2>
      <p style="margin:2px 0 0 0;font-size:10px;letter-spacing:1px;">--- TICKET DE CAISSE ---</p>
    </div>
    <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
    <div style="font-size:10px;font-family:monospace;">
      <div style="display:flex;justify-content:space-between;"><span>N° Ticket :</span><b>${invoiceData.invoiceNumber}</b></div>
      <div style="display:flex;justify-content:space-between;"><span>Date       :</span><span>${new Date(invoiceData.createdAt).toLocaleString('fr-FR')}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Caissière  :</span><span>${invoiceData.createdBy?.name || 'Caissière'}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Client     :</span><span>${invoiceData.clientName || 'Client de passage'}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Règlement  :</span><span>${getPaymentMethodLabel(invoiceData.paymentMethod)}</span></div>
    </div>
    <p style="margin:5px 0;border-bottom:1px dashed #000;"></p>
    ${itemsRows}
    <p style="margin:5px 0;border-top:1px solid #000;border-bottom:1px solid #000;"></p>
    <div style="font-size:11px;font-family:monospace;font-weight:bold;display:flex;justify-content:space-between;margin-top:4px;">
      <span>TOTAL À PAYER :</span><span>${Math.round(invoiceData.totalAmount).toLocaleString('fr-FR')} FCFA</span>
    </div>
    <p style="text-align:center;margin-top:14px;font-size:9px;font-family:monospace;">Merci de votre visite !<br>À bientôt chez JOEL SHOP</p>
  `;

  const fullHtml = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: 'Courier New', Courier, monospace; width: 74mm; margin: 0; padding: 0; color: #000; background: #fff; }
        </style>
      </head>
      <body>${printHTML}</body>
    </html>`;

  const doClientPrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(fullHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print iframe error:', e);
      }
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 2000);
    }, 150);
  };

  // Trigger browser print immediately
  doClientPrint();

  // Send background log to server (non-blocking)
  fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: fullHtml, invoiceData })
  }).catch(() => {});
};

export const triggerProformaPrint = (reservation) => {
  const paymentsList = (reservation.payments || []).map((p, idx) => `
    <div style="display:flex;justify-content:space-between;margin:2px 0;">
      <span>Tranche ${p.installmentNumber || idx + 1}/3 (${getPaymentMethodLabel(p.paymentMethod)}) :</span>
      <span>${Math.round(p.amount).toLocaleString('fr-FR')} FCFA</span>
    </div>
  `).join('');

  const itemsList = (reservation.items || []).map(item => `
    <tr>
      <td style="padding:2px 1px;text-align:left;">${item.categoryName}</td>
      <td style="padding:2px 1px;text-align:center;">${item.qty || 1}</td>
      <td style="padding:2px 1px;text-align:right;">${Math.round(item.price).toLocaleString('fr-FR')}</td>
      <td style="padding:2px 1px;text-align:right;font-weight:bold;">${Math.round(item.price * (item.qty || 1)).toLocaleString('fr-FR')}</td>
    </tr>
  `).join('');

  const totalPaid = (reservation.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (Number(reservation.totalAmount) || 0) - totalPaid);

  const printHTML = `
    <div style="text-align:center;margin-bottom:6px;font-family:monospace;">
      <h2 style="margin:0;font-size:15px;font-weight:bold;letter-spacing:3px;">JOEL SHOP</h2>
      <p style="margin:2px 0 0 0;font-size:10px;letter-spacing:1px;font-weight:bold;">--- REÇU PROFORMA (RÉSERVATION) ---</p>
    </div>
    <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
    <div style="font-size:10px;font-family:monospace;">
      <div style="display:flex;justify-content:space-between;"><span>N° Réservation :</span><b>${reservation.reservationNo}</b></div>
      <div style="display:flex;justify-content:space-between;"><span>Date           :</span><span>${new Date(reservation.createdAt).toLocaleString('fr-FR')}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Client         :</span><span>${reservation.clientName}${reservation.clientPhone ? ` (${reservation.clientPhone})` : ''}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Enregistré par :</span><span>${reservation.createdBy?.name || 'Caissière'}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Statut         :</span><b>${reservation.status === 'COMPLETED' ? 'PAYÉE À 100%' : 'EN COURS DE PAIEMENT'}</b></div>
    </div>
    <p style="margin:5px 0;border-bottom:1px dashed #000;"></p>
    <table style="width:100%;border-collapse:collapse;margin:0;font-size:10px;">
      <thead>
        <tr style="border-bottom:1px solid #000;">
          <th style="text-align:left;padding:2px 1px;font-weight:bold;">Désignation</th>
          <th style="text-align:center;padding:2px 1px;font-weight:bold;">Qté</th>
          <th style="text-align:right;padding:2px 1px;font-weight:bold;">P/U</th>
          <th style="text-align:right;padding:2px 1px;font-weight:bold;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsList}</tbody>
    </table>
    <p style="margin:5px 0;border-top:1px solid #000;border-bottom:1px solid #000;"></p>
    <div style="font-size:10px;font-family:monospace;">
      <div style="display:flex;justify-content:space-between;font-weight:bold;">
        <span>MONTANT TOTAL  :</span><span>${Math.round(reservation.totalAmount).toLocaleString('fr-FR')} FCFA</span>
      </div>
      <p style="margin:3px 0;border-bottom:1px dashed #000;"></p>
      <div style="font-weight:bold;margin:4px 0 2px 0;">HISTORIQUE DES VERSEMENTS (${reservation.payments?.length || 0}/3) :</div>
      ${paymentsList || '<div style="font-style:italic;">Aucun versement effectué</div>'}
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:11px;">
        <span>TOTAL DÉJÀ PAYÉ :</span><span>${Math.round(totalPaid).toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:11px;margin-top:2px;">
        <span>RESTE À PAYER    :</span><span>${Math.round(remaining).toLocaleString('fr-FR')} FCFA</span>
      </div>
    </div>
    <p style="text-align:center;margin-top:14px;font-size:8px;font-family:monospace;">
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
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: 'Courier New', Courier, monospace; width: 74mm; margin: 0; padding: 0; color: #000; background: #fff; }
        </style>
      </head>
      <body>${printHTML}</body>
    </html>`;

  const doClientPrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(fullHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print iframe error:', e);
      }
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 2000);
    }, 150);
  };

  // Trigger browser print immediately
  doClientPrint();

  // Send background log to server (non-blocking)
  fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: fullHtml, reservation })
  }).catch(() => {});
};