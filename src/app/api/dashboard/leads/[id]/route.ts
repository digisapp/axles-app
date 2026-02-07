import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { validateBody, ValidationError, updateLeadSchema } from '@/lib/validations/api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = validateBody(updateLeadSchema, body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.errors },
          { status: 400 }
        );
      }
      throw err;
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (validatedData.status !== undefined) updates.status = validatedData.status;
    if (validatedData.priority !== undefined) updates.priority = validatedData.priority;
    if (validatedData.notes !== undefined) updates.notes = validatedData.notes;
    if (body.last_contacted_at !== undefined) updates.last_contacted_at = body.last_contacted_at;
    if (body.follow_up_date !== undefined) updates.follow_up_date = body.follow_up_date;
    if (body.follow_up_note !== undefined) updates.follow_up_note = body.follow_up_note;
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

    // Update the lead
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this lead
      .select()
      .single();

    if (error) {
      logger.error('Error updating lead', { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error in PATCH /api/dashboard/leads/[id]', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      logger.error('Error deleting lead', { error });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/dashboard/leads/[id]', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
