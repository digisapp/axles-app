import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuotePdf, generateQuoteFilename } from '@/lib/deals/generateQuotePdf';
import { generateQuoteSchema } from '@/lib/validations/deals';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Generate quote PDF
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get deal with all details
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`
        *,
        listing:listings(id, title, price, stock_number, year, make, model),
        line_items:deal_line_items(*)
      `)
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Get dealer info
    const { data: dealer } = await supabase
      .from('profiles')
      .select('name, email, phone, company_name, address')
      .eq('id', user.id)
      .single();

    const body = await request.json().catch(() => ({}));
    const parseResult = generateQuoteSchema.safeParse(body);

    const options = parseResult.success ? parseResult.data : { include_terms: true, expiration_days: 30 };

    // Generate PDF
    const pdfBuffer = generateQuotePdf(
      deal,
      {
        name: dealer?.company_name || dealer?.name || 'Dealer',
        email: dealer?.email || undefined,
        phone: dealer?.phone || undefined,
        address: dealer?.address || undefined,
      },
      {
        includeTerms: options.include_terms,
        expirationDays: options.expiration_days,
      }
    );

    // Upload to storage
    const filename = generateQuoteFilename(deal.deal_number);
    const filePath = `deal-documents/${user.id}/${id}/quotes/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading quote:', uploadError);
      // Continue anyway - return the PDF directly
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    // Mark previous quote versions as not current
    await supabase
      .from('deal_documents')
      .update({ is_current: false })
      .eq('deal_id', id)
      .eq('document_type', 'quote');

    // Get latest version
    const { data: versions } = await supabase
      .from('deal_documents')
      .select('version')
      .eq('deal_id', id)
      .eq('document_type', 'quote')
      .order('version', { ascending: false })
      .limit(1);

    const newVersion = versions && versions.length > 0 ? versions[0].version + 1 : 1;

    // Create document record
    const { data: docRecord } = await supabase
      .from('deal_documents')
      .insert({
        deal_id: id,
        document_type: 'quote',
        title: `Quote - Version ${newVersion}`,
        file_url: urlData?.publicUrl,
        file_name: filename,
        file_size: pdfBuffer.byteLength,
        mime_type: 'application/pdf',
        version: newVersion,
        is_current: true,
      })
      .select()
      .single();

    // Set quote expiration on deal
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + options.expiration_days);

    await supabase
      .from('deals')
      .update({
        quote_expires_at: expirationDate.toISOString(),
      })
      .eq('id', id);

    // Log activity
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: id,
        activity_type: 'quote_generated',
        title: 'Quote generated',
        description: `Version ${newVersion}`,
        document_id: docRecord?.id,
        performed_by: user.id,
      });

    // Return PDF as download
    const buffer = Buffer.from(pdfBuffer);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Generate quote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
