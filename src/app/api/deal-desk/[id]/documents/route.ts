import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadDocumentSchema } from '@/lib/validations/deals';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List documents for a deal
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:deal-desk-documents',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal belongs to user
    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('deal_documents')
      .select('*')
      .eq('deal_id', id)
      .eq('is_current', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching documents', { error });
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Documents error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload a document
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:deal-desk-documents',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify deal belongs to user
    const { data: deal } = await supabase
      .from('deals')
      .select('id, deal_number')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('document_type') as string;
    const title = formData.get('title') as string;
    const requiresSignature = formData.get('requires_signature') === 'true';

    // Validate input
    const parseResult = uploadDocumentSchema.safeParse({
      document_type: documentType,
      title,
      requires_signature: requiresSignature,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let mimeType = null;

    // Upload file if provided
    if (file) {
      const fileExt = file.name.split('.').pop();
      const filePath = `deal-documents/${user.id}/${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        logger.error('Error uploading file', { error: uploadError });
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      fileUrl = urlData.publicUrl;
      fileName = file.name;
      fileSize = file.size;
      mimeType = file.type;
    }

    // Mark previous versions as not current
    await supabase
      .from('deal_documents')
      .update({ is_current: false })
      .eq('deal_id', id)
      .eq('document_type', documentType);

    // Get latest version number
    const { data: versions } = await supabase
      .from('deal_documents')
      .select('version')
      .eq('deal_id', id)
      .eq('document_type', documentType)
      .order('version', { ascending: false })
      .limit(1);

    const newVersion = versions && versions.length > 0 ? versions[0].version + 1 : 1;

    // Create document record
    const { data, error } = await supabase
      .from('deal_documents')
      .insert({
        deal_id: id,
        document_type: documentType,
        title,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        requires_signature: requiresSignature,
        signature_status: requiresSignature ? 'pending' : 'none',
        version: newVersion,
        is_current: true,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating document', { error });
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    // Log activity
    await supabase
      .from('deal_activities')
      .insert({
        deal_id: id,
        activity_type: 'document_uploaded',
        title: `Document uploaded: ${title}`,
        description: `${documentType} - Version ${newVersion}`,
        document_id: data.id,
        performed_by: user.id,
      });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    logger.error('Upload document error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
