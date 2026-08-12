export const formatFCFA = (amount = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' FCFA';

export const cx = (...classes) => classes.filter(Boolean).join(' ');

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
    ? groupItems(invoiceData.items).map(item => `
        <div style="display:flex;justify-content:space-between;margin:3px 0;">
          <span>${item.categoryName}${item.qty > 1 ? ` x${item.qty}` : ''}</span>
          <span>${Math.round(item.price * item.qty).toLocaleString('fr-FR')} FCFA</span>
        </div>`).join('')
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
      <h2 style="margin:0;font-size:13px;font-weight:bold;">POS TERMINAL</h2>
      <p style="margin:2px 0 0 0;font-size:11px;">RAPPORT DE CLÔTURE (Z)</p>
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
    </div>
    <div style="font-size:10px;font-family:monospace;">
      <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${zr.date} ${zr.time}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Operateur:</span><span>${invoiceData.createdBy.name}</span></div>
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      <div style="font-weight:bold;margin-bottom:4px;">SYNTHÈSE COMPTABLE</div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;"><span>TOTAL NET:</span><span>${Math.round(zr.totalSales).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Espèces:</span><span>${Math.round(zr.totalCash).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Mobile Money:</span><span>${Math.round(zr.totalOnline).toLocaleString('fr-FR')} FCFA</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Ventes Validées:</span><span>${zr.validatedCount}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Ventes Annulées:</span><span>${zr.cancelledCount}</span></div>
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      <div style="font-weight:bold;margin-bottom:4px;">RÉPARTITION PAR CATÉGORIE</div>
      ${topSellingRows}
      <p style="text-align:center;margin-top:12px;font-size:10px;">--- FIN DU RAPPORT Z ---</p>
    </div>
  ` : `
    <div style="text-align:center;margin-bottom:8px;font-family:monospace;">
      <h2 style="margin:0;font-size:14px;font-weight:bold;">BOUTIQUE MODE</h2>
      <p style="margin:2px 0 0 0;font-size:10px;">Ticket de Caisse</p>
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
    </div>
    <div style="font-size:10px;font-family:monospace;">
      <div style="display:flex;justify-content:space-between;"><span>N° Ticket:</span><b>${invoiceData.invoiceNumber}</b></div>
      <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${new Date(invoiceData.createdAt).toLocaleString('fr-FR')}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Caissière:</span><span>${invoiceData.createdBy.name}</span></div>
      ${invoiceData.clientName ? `<div style="display:flex;justify-content:space-between;"><span>Client:</span><span>${invoiceData.clientName}</span></div>` : ''}
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      ${itemsRows}
      <p style="margin:4px 0;border-bottom:1px dashed #000;"></p>
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;margin-top:4px;">
        <span>TOTAL COMPTANT:</span><span>${Math.round(invoiceData.totalAmount).toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2px;">
        <span>Mode de Règlement:</span><span>${invoiceData.paymentMethod === 'CASH' ? 'Espèces' : invoiceData.paymentMethod === 'ONLINE' ? 'Mobile / En Ligne' : 'Non précisé'}</span>
      </div>
      <p style="text-align:center;margin-top:14px;font-size:9px;">Merci de votre visite !</p>
    </div>
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
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  };

  // Try sending print job to backend for server-side printing (silent).
  // If backend is unavailable or returns error, fall back to client print dialog.
  fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: fullHtml, invoiceData })
  }).then(res => {
    if (!res.ok) throw new Error('Print server error');
    return res.json();
  }).then(() => {
    console.info('Print job sent to server');
  }).catch((err) => {
    console.warn('Server print failed, falling back to client print', err);
    doClientPrint();
  });
};