import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Deal, DealLineItem } from '@/types/deals';

interface QuoteOptions {
  includeTerms?: boolean;
  expirationDays?: number;
}

interface DealerInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export function generateQuotePdf(
  deal: Deal & { line_items?: DealLineItem[] },
  dealerInfo: DealerInfo,
  options: QuoteOptions = {}
): Uint8Array {
  const { includeTerms = true, expirationDays = 30 } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Header with dealer info
  doc.setFillColor(0, 102, 204);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(dealerInfo.name, margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (dealerInfo.phone) {
    doc.text(dealerInfo.phone, margin, 26);
  }
  if (dealerInfo.email) {
    doc.text(dealerInfo.email, margin, 31);
  }

  // Quote title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTE', pageWidth - margin, 18, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(deal.deal_number, pageWidth - margin, 25, { align: 'right' });

  const quoteDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(quoteDate, pageWidth - margin, 31, { align: 'right' });

  let currentY = 50;

  // Quote To section
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text('QUOTE TO:', margin, currentY);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(deal.buyer_name, margin, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (deal.buyer_company) {
    doc.text(deal.buyer_company, margin, currentY + 12);
  }
  if (deal.buyer_email) {
    doc.text(deal.buyer_email, margin, currentY + 18);
  }
  if (deal.buyer_phone) {
    doc.text(deal.buyer_phone, margin, currentY + 24);
  }

  // Expiration date
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text('VALID UNTIL:', pageWidth - margin - 50, currentY);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(
    expirationDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    pageWidth - margin - 50,
    currentY + 6
  );

  currentY += 40;

  // Equipment/Listing info
  if (deal.listing) {
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, currentY, contentWidth, 25, 'F');

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text('EQUIPMENT', margin + 5, currentY + 6);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(deal.listing.title || 'Equipment', margin + 5, currentY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const details = [
      deal.listing.year,
      deal.listing.make,
      deal.listing.model,
      deal.listing.stock_number ? `Stock #${deal.listing.stock_number}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    doc.text(details, margin + 5, currentY + 21);

    currentY += 35;
  }

  // Line items table
  const lineItems = deal.line_items || [];

  if (lineItems.length > 0) {
    const tableHead = [['Description', 'Qty', 'Unit Price', 'Amount']];
    const tableBody = lineItems.map((item) => [
      item.description,
      item.quantity.toString(),
      `$${item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      `$${item.total_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: tableHead,
      body: tableBody,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      margin: { left: margin, right: margin },
    });

    currentY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY + 50;
  }

  // Totals section
  currentY += 5;

  const totalsData = [
    ['Subtotal', `$${deal.sale_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
  ];

  if (deal.total_fees > 0) {
    totalsData.push(['Fees', `$${deal.total_fees.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
  }

  if (deal.total_taxes > 0) {
    totalsData.push(['Taxes', `$${deal.total_taxes.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
  }

  if (deal.trade_in_allowance > 0) {
    totalsData.push(['Trade-In Allowance', `-$${deal.trade_in_allowance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);
  }

  totalsData.push(['Total Due', `$${deal.total_due.toLocaleString('en-US', { minimumFractionDigits: 2 })}`]);

  autoTable(doc, {
    startY: currentY,
    body: totalsData,
    theme: 'plain',
    styles: {
      fontSize: 11,
    },
    columnStyles: {
      0: { cellWidth: 100, halign: 'right', fontStyle: 'normal' },
      1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: pageWidth - margin - 150, right: margin },
    didParseCell: (data) => {
      // Make the last row (Total Due) bold and larger
      if (data.row.index === totalsData.length - 1) {
        data.cell.styles.fontSize = 13;
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 1) {
          data.cell.styles.textColor = [0, 102, 204];
        }
      }
    },
  });

  currentY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || currentY + 40;

  // Special terms
  if (deal.special_terms) {
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Special Terms:', margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const termLines = doc.splitTextToSize(deal.special_terms, contentWidth);
    doc.text(termLines, margin, currentY + 6);
    currentY += 6 + termLines.length * 4;
  }

  // Trade-in information
  if (deal.trade_in_year || deal.trade_in_make || deal.trade_in_model) {
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Trade-In:', margin, currentY);

    doc.setFont('helvetica', 'normal');
    const tradeIn = [deal.trade_in_year, deal.trade_in_make, deal.trade_in_model]
      .filter(Boolean)
      .join(' ');
    doc.text(tradeIn, margin, currentY + 6);
    if (deal.trade_in_vin) {
      doc.text(`VIN: ${deal.trade_in_vin}`, margin, currentY + 12);
    }
    currentY += 20;
  }

  // Terms and conditions
  if (includeTerms && currentY < pageHeight - 60) {
    currentY += 15;
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, currentY, contentWidth, 40, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('TERMS & CONDITIONS', margin + 5, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    const terms = [
      '1. This quote is valid for ' + expirationDays + ' days from the date issued.',
      '2. Prices are subject to change without notice after the expiration date.',
      '3. Payment terms: As agreed upon at time of purchase.',
      '4. Equipment is sold as-is unless otherwise specified.',
      '5. Buyer is responsible for all applicable taxes, registration, and transportation costs.',
    ];

    terms.forEach((term, index) => {
      doc.text(term, margin + 5, currentY + 12 + index * 5);
    });
  }

  // Footer
  doc.setFillColor(0, 102, 204);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business!', margin, pageHeight - 7);
  doc.text('Questions? Contact us at ' + (dealerInfo.email || dealerInfo.phone || ''), pageWidth - margin, pageHeight - 7, { align: 'right' });

  // Return as Uint8Array for API use
  return doc.output('arraybuffer') as unknown as Uint8Array;
}

export function generateQuoteFilename(dealNumber: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `quote-${dealNumber}-${date}.pdf`;
}
