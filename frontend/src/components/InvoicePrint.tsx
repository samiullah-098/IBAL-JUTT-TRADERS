import { forwardRef } from 'react';

interface InvoicePrintProps { sale: any; amountPaidPreview?: number; }
const money = (n: any) => `Rs ${Number(n || 0).toLocaleString()}`;

export const InvoicePrint = forwardRef<HTMLDivElement, InvoicePrintProps>(({ sale, amountPaidPreview }, ref) => {
  if (!sale) return null;
  const items = sale.Items || [];
  const itemSubtotal = items.reduce((sum: number, i: any) => sum + Number(i.total || 0), 0);
  const paid = Number(amountPaidPreview ?? sale.amountPaid ?? 0);
  const remaining = Math.max(0, Number(sale.amount || 0) - paid);
  return (
    <div ref={ref} className="hidden print:block bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', width: '80mm', padding: '4mm', margin: '0 auto', fontSize: '11px', lineHeight: '1.35' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: '8px', marginBottom: '8px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '60px', height: '60px', margin: '0 auto 4px', display: 'block', objectFit: 'contain' }} />
        <h1 style={{ fontSize: '17px', margin: '0', fontWeight: 900, letterSpacing: '0.5px' }}>IQBAL JUTT TRADER</h1>
        <p style={{ margin: '2px 0', fontSize: '10px', fontWeight: 700 }}>Wholesale Yarn / Bardanay / Sootar</p>
        <p style={{ margin: '2px 0', fontSize: '10px' }}>Main Yarn Market • Phone: 0300-1234567</p>
      </div>
      <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}><span>Invoice</span><span>{sale.invoiceId || `INV-${String(sale.id).padStart(6,'0')}`}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Date</span><span>{new Date(sale.date).toLocaleString()}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Customer</span><span style={{ fontWeight: 800 }}>{sale.party?.name || '-'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Phone</span><span>{sale.party?.phone || '-'}</span></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
        <thead><tr style={{ borderBottom: '1px solid #111827' }}><th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
        <tbody>{items.map((i:any, idx:number) => {
          let bagInfo = `Bags: ${i.bags || 0}`;
          try {
            if (i.bagWeights) {
              const weights = typeof i.bagWeights === 'string' ? JSON.parse(i.bagWeights) : i.bagWeights;
              if (Array.isArray(weights) && weights.length > 0) bagInfo = `Bags: ${weights.length} (${weights.join(', ')})`;
            }
          } catch(e) {}
          return <tr key={idx} style={{ borderBottom: '1px dashed #d1d5db' }}><td style={{ padding: '5px 0', fontWeight: 700 }}>{i.inventoryItem?.variant || i.item || '-'}<br/><span style={{ fontSize: '9px', fontWeight: 400 }}>Lot: {i.inventoryItem?.lotNumber || '-'} • {bagInfo}</span></td><td style={{ textAlign: 'right' }}>{Number(i.quantity || 0).toFixed(2)} {i.unit || 'kg'}</td><td style={{ textAlign: 'right' }}>{Number(i.rate || 0).toLocaleString()}</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{Number(i.total || 0).toLocaleString()}</td></tr>;
        })}</tbody>
      </table>
      <div style={{ borderTop: '2px solid #111827', paddingTop: '7px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><strong>{money(itemSubtotal)}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Discount</span><strong>- {money(sale.discount)}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Mazdoori / Freight</span><strong>+ {money(sale.freight)}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px', borderTop: '1px dashed #111827', paddingTop: '4px' }}><span style={{ fontWeight: 900 }}>Grand Total</span><span style={{ fontWeight: 900 }}>{money(sale.amount)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 800 }}><span>Paid / Jama</span><span>{money(paid)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: remaining > 0 ? '#dc2626' : '#059669', fontWeight: 900 }}><span>Remaining Udhar</span><span>{money(remaining)}</span></div>
      </div>
      <div style={{ marginTop: '10px', textAlign: 'center', borderTop: '1px dashed #111827', paddingTop: '8px' }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Thank you for your business</p>
        <p style={{ margin: '2px 0', fontSize: '9px' }}>Software by WebDecoders</p>
      </div>
    </div>
  );
});
