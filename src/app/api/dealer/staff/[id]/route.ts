import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get single staff member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .select('*')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (error || !staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...staff,
        voice_pin: '**' + staff.voice_pin.slice(-2),
      },
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    return NextResponse.json({ error: 'Failed to fetch staff member' }, { status: 500 });
  }
}

// PATCH - Update staff member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('dealer_staff')
      .select('id')
      .eq('id', id)
      .eq('dealer_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const body = await request.json();

    // If updating PIN, validate format and uniqueness
    if (body.voice_pin) {
      if (!/^\d{4,6}$/.test(body.voice_pin)) {
        return NextResponse.json(
          { error: 'Voice PIN must be 4-6 digits' },
          { status: 400 }
        );
      }

      // Check if PIN already exists for another staff member
      const { data: pinExists } = await supabase
        .from('dealer_staff')
        .select('id')
        .eq('dealer_id', user.id)
        .eq('voice_pin', body.voice_pin)
        .neq('id', id)
        .single();

      if (pinExists) {
        return NextResponse.json(
          { error: 'This PIN is already in use by another staff member' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'role', 'phone_number', 'email', 'voice_pin',
      'access_level', 'can_view_costs', 'can_view_margins',
      'can_view_all_leads', 'can_modify_inventory', 'is_active'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data: staff, error } = await supabase
      .from('dealer_staff')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: {
        ...staff,
        voice_pin: '**' + staff.voice_pin.slice(-2),
      },
      message: 'Staff member updated successfully',
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
  }
}

// DELETE - Remove staff member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('dealer_staff')
      .delete()
      .eq('id', id)
      .eq('dealer_id', user.id);

    if (error) throw error;

    return NextResponse.json({ message: 'Staff member removed successfully' });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
  }
}
