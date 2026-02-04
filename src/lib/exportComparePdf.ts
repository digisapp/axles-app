import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CompareListing {
  id: string;
  title: string;
  price: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  hours: number | null;
  condition: string | null;
  image_url: string | null;
}

interface SpecRow {
  key: string;
  label: string;
  format: (v: unknown) => string;
}

const specs: SpecRow[] = [
  { key: 'price', label: 'Price', format: (v) => (v as number) ? `$${(v as number).toLocaleString()}` : 'Call for Price' },
  { key: 'year', label: 'Year', format: (v) => (v as number)?.toString() || '-' },
  { key: 'make', label: 'Make', format: (v) => (v as string) || '-' },
  { key: 'model', label: 'Model', format: (v) => (v as string) || '-' },
  { key: 'mileage', label: 'Mileage', format: (v) => (v as number) ? `${(v as number).toLocaleString()} mi` : '-' },
  { key: 'hours', label: 'Hours', format: (v) => (v as number) ? `${(v as number).toLocaleString()} hrs` : '-' },
  { key: 'condition', label: 'Condition', format: (v) => (v as string) ? (v as string).charAt(0).toUpperCase() + (v as string).slice(1) : '-' },
];

export async function exportComparePdf(listings: CompareListing[]) {
  // Create PDF document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Header
  doc.setFillColor(0, 102, 204); // Primary blue color
  doc.rect(0, 0, pageWidth, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('AxlesAI', margin, 15);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Equipment Comparison Report', pageWidth - margin, 15, { align: 'right' });

  // Date
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(9);
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Generated: ${date}`, pageWidth - margin, 21, { align: 'right' });

  // Title section
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Comparing ${listings.length} Listings`, margin, 38);

  // Create table data
  const tableHead = ['Specification', ...listings.map(l => l.title.substring(0, 30) + (l.title.length > 30 ? '...' : ''))];

  const tableBody = specs.map(spec => {
    const values = listings.map(listing => {
      const value = listing[spec.key as keyof CompareListing];
      return spec.format(value);
    });
    return [spec.label, ...values];
  });

  // Find the best price for highlighting
  const prices = listings.map(l => l.price).filter(Boolean) as number[];
  const bestPrice = prices.length > 0 ? Math.min(...prices) : null;

  // Generate comparison table
  autoTable(doc, {
    startY: 45,
    head: [tableHead],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 102, 204],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 10,
      halign: 'center',
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        halign: 'left',
        cellWidth: 35,
      },
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      // Highlight best price in green
      if (data.section === 'body' && data.row.index === 0 && data.column.index > 0) {
        const listing = listings[data.column.index - 1];
        if (listing.price && listing.price === bestPrice) {
          doc.setTextColor(22, 163, 74); // green-600
        }
      }
    },
    willDrawCell: (data) => {
      // Reset text color before each cell
      doc.setTextColor(30, 30, 30);

      // Highlight best price in green
      if (data.section === 'body' && data.row.index === 0 && data.column.index > 0) {
        const listing = listings[data.column.index - 1];
        if (listing.price && listing.price === bestPrice) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Get final Y position after table
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 100;

  // Listing links section
  if (finalY + 40 < pageHeight) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('View Listings Online:', margin, finalY + 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 102, 204);

    listings.forEach((listing, index) => {
      const url = `https://axles.ai/listing/${listing.id}`;
      const yPos = finalY + 23 + (index * 6);
      if (yPos < pageHeight - 20) {
        doc.textWithLink(`${listing.title.substring(0, 50)}${listing.title.length > 50 ? '...' : ''}`, margin, yPos, { url });
      }
    });
  }

  // Footer
  doc.setFillColor(245, 247, 250);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('AxlesAI - AI-Powered Truck & Equipment Marketplace', margin, pageHeight - 7);
  doc.text('https://axles.ai', pageWidth - margin, pageHeight - 7, { align: 'right' });

  // Download the PDF
  const filename = `axlesai-comparison-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
