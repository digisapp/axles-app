import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sales@axles.ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();

    const tradeInData = {
      user_id: user?.id || null,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone || null,
      equipment_year: body.equipment_year || null,
      equipment_make: body.equipment_make,
      equipment_model: body.equipment_model,
      equipment_vin: body.equipment_vin || null,
      equipment_mileage: body.equipment_mileage || null,
      equipment_hours: body.equipment_hours || null,
      equipment_condition: body.equipment_condition || null,
      equipment_description: body.equipment_description || null,
      photos: body.photos || [],
      interested_listing_id: body.interested_listing_id || null,
      interested_category_id: body.interested_category_id || null,
      purchase_timeline: body.purchase_timeline || null,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('trade_in_requests')
      .insert(tradeInData)
      .select()
      .single();

    if (error) throw error;

    // Send email notification to admin
    const equipmentInfo = [body.equipment_year, body.equipment_make, body.equipment_model]
      .filter(Boolean)
      .join(' ');

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'AxlesAI <noreply@axles.ai>',
        to: ADMIN_EMAIL,
        subject: `New Trade-In Request: ${equipmentInfo || 'Equipment'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0066cc; padding: 20px; text-align: center;">
              <img src="https://axles.ai/images/axlesai-logo.png" alt="AxlesAI" height="40" />
            </div>
            <div style="padding: 30px; background: #ffffff;">
              <h2 style="color: #333; margin-bottom: 20px;">New Trade-In Request</h2>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #333; margin: 0 0 15px 0;">Equipment Details</h3>
                <p style="margin: 5px 0;"><strong>Equipment:</strong> ${equipmentInfo || 'Not specified'}</p>
                ${body.equipment_vin ? `<p style="margin: 5px 0;"><strong>VIN:</strong> ${body.equipment_vin}</p>` : ''}
                ${body.equipment_mileage ? `<p style="margin: 5px 0;"><strong>Mileage:</strong> ${body.equipment_mileage.toLocaleString()} miles</p>` : ''}
                ${body.equipment_hours ? `<p style="margin: 5px 0;"><strong>Hours:</strong> ${body.equipment_hours.toLocaleString()}</p>` : ''}
                ${body.equipment_condition ? `<p style="margin: 5px 0;"><strong>Condition:</strong> ${body.equipment_condition}</p>` : ''}
                ${body.equipment_description ? `<p style="margin: 10px 0 0 0;"><strong>Description:</strong><br/>${body.equipment_description}</p>` : ''}
              </div>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #333; margin: 0 0 15px 0;">Contact Information</h3>
                <p style="margin: 5px 0;"><strong>Name:</strong> ${body.contact_name}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${body.contact_email}">${body.contact_email}</a></p>
                ${body.contact_phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${body.contact_phone}">${body.contact_phone}</a></p>` : ''}
              </div>

              ${body.purchase_timeline ? `
              <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0;"><strong>Purchase Timeline:</strong> ${body.purchase_timeline.replace('_', ' ')}</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin-top: 30px;">
                <a href="https://axles.ai/admin/trade-ins"
                   style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  View in Admin Panel
                </a>
              </div>
            </div>
            <div style="padding: 20px; background: #f9f9f9; text-align: center; color: #888; font-size: 12px;">
              <p>This is an automated notification from AxlesAI</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error('Failed to send trade-in notification email:', emailError);
    }

    return NextResponse.json({ data, message: 'Trade-in request submitted successfully' });
  } catch (error) {
    console.error('Error creating trade-in request:', error);
    return NextResponse.json(
      { error: 'Failed to submit trade-in request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
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
    console.error('Error fetching trade-in requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trade-in requests' },
      { status: 500 }
    );
  }
}
