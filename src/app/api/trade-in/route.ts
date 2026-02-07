import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rate-limit';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, tradeInRequestSchema } from '@/lib/validations/api';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sales@axlon.ai';

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.auth,
      prefix: 'ratelimit:trade-in',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();
    const body = await request.json();

    let validatedData;
    try {
      validatedData = validateBody(tradeInRequestSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();

    const tradeInData = {
      user_id: user?.id || null,
      contact_name: validatedData.contact_name,
      contact_email: validatedData.contact_email,
      contact_phone: validatedData.contact_phone || null,
      equipment_year: validatedData.equipment_year || null,
      equipment_make: validatedData.equipment_make,
      equipment_model: validatedData.equipment_model,
      equipment_vin: validatedData.equipment_vin || null,
      equipment_mileage: validatedData.equipment_mileage || null,
      equipment_hours: validatedData.equipment_hours || null,
      equipment_condition: validatedData.equipment_condition || null,
      equipment_description: validatedData.equipment_description || null,
      photos: validatedData.photos || [],
      interested_listing_id: validatedData.interested_listing_id || null,
      interested_category_id: validatedData.interested_category_id || null,
      purchase_timeline: validatedData.purchase_timeline || null,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('trade_in_requests')
      .insert(tradeInData)
      .select()
      .single();

    if (error) throw error;

    // Send email notification to admin
    const equipmentInfo = [validatedData.equipment_year, validatedData.equipment_make, validatedData.equipment_model]
      .filter(Boolean)
      .join(' ');

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'AxlonAI <noreply@axlon.ai>',
        to: ADMIN_EMAIL,
        subject: `New Trade-In Request: ${equipmentInfo || 'Equipment'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0066cc; padding: 20px; text-align: center;">
              <img src="https://axlon.ai/images/axlonai-logo.png" alt="AxlonAI" height="40" />
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #333; margin-bottom: 20px;">New Trade-In Request</h2>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #333; margin: 0 0 15px 0;">Equipment Details</h3>
                <p style="margin: 5px 0;"><strong>Equipment:</strong> ${equipmentInfo || 'Not specified'}</p>
                ${validatedData.equipment_vin ? `<p style="margin: 5px 0;"><strong>VIN:</strong> ${validatedData.equipment_vin}</p>` : ''}
                ${validatedData.equipment_mileage ? `<p style="margin: 5px 0;"><strong>Mileage:</strong> ${validatedData.equipment_mileage.toLocaleString()} miles</p>` : ''}
                ${validatedData.equipment_hours ? `<p style="margin: 5px 0;"><strong>Hours:</strong> ${validatedData.equipment_hours.toLocaleString()}</p>` : ''}
                ${validatedData.equipment_condition ? `<p style="margin: 5px 0;"><strong>Condition:</strong> ${validatedData.equipment_condition}</p>` : ''}
                ${validatedData.equipment_description ? `<p style="margin: 10px 0 0 0;"><strong>Description:</strong><br/>${validatedData.equipment_description}</p>` : ''}
              </div>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #333; margin: 0 0 15px 0;">Contact Information</h3>
                <p style="margin: 5px 0;"><strong>Name:</strong> ${validatedData.contact_name}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${validatedData.contact_email}">${validatedData.contact_email}</a></p>
                ${body.contact_phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${validatedData.contact_phone}">${validatedData.contact_phone}</a></p>` : ''}
              </div>

              ${validatedData.purchase_timeline ? `
              <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0;"><strong>Purchase Timeline:</strong> ${validatedData.purchase_timeline.replace('_', ' ')}</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin-top: 30px;">
                <a href="https://axlon.ai/admin/trade-ins"
                   style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  View in Admin Panel
                </a>
              </div>
            </div>
            <div style="padding: 20px; background: #f9f9f9; text-align: center; color: #888; font-size: 12px;">
              <p>This is an automated notification from AxlonAI</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      // Log but don't fail the request if email fails
      logger.error('Failed to send trade-in notification email', { error: emailError });
    }

    return NextResponse.json({ data, message: 'Trade-in request submitted successfully' });
  } catch (error) {
    logger.error('Error creating trade-in request', { error });
    return NextResponse.json(
      { error: 'Failed to submit trade-in request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, {
      ...RATE_LIMITS.standard,
      prefix: 'ratelimit:trade-in',
    });
    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult);
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a dealer
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_dealer, is_admin')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('trade_in_requests')
      .select(`
        *,
        interested_listing:listings(id, title, price),
        interested_category:categories(id, name)
      `)
      .order('created_at', { ascending: false });

    // If dealer, show assigned requests; otherwise show own requests
    if (profile?.is_dealer || profile?.is_admin) {
      if (status) {
        query = query.eq('status', status);
      }
      // Dealers see requests assigned to them or unassigned
      query = query.or(`assigned_dealer_id.eq.${user.id},assigned_dealer_id.is.null`);
    } else {
      // Regular users see only their own requests
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Error fetching trade-in requests', { error });
    return NextResponse.json(
      { error: 'Failed to fetch trade-in requests' },
      { status: 500 }
    );
  }
}
