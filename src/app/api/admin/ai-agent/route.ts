import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch AI agent settings
export async function GET() {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Get settings (there's only one row)
  const { data, error } = await supabase
    .from('ai_agent_settings')
    .select('*')
    .single()

  if (error) {
    console.error('Error fetching AI agent settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// PUT - Update AI agent settings
export async function PUT(request: Request) {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()

  // Validate voice option
  const validVoices = ['Ara', 'Eve', 'Mika', 'Leo', 'Rex', 'Sal']
  if (body.voice && !validVoices.includes(body.voice)) {
    return NextResponse.json({ error: 'Invalid voice option' }, { status: 400 })
  }

  // Update settings
  const { data, error } = await supabase
    .from('ai_agent_settings')
    .update({
      voice: body.voice,
      agent_name: body.agent_name,
      greeting_message: body.greeting_message,
      instructions: body.instructions,
      model: body.model,
      temperature: body.temperature,
      phone_number: body.phone_number,
      is_active: body.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .select()
    .single()

  if (error) {
    console.error('Error updating AI agent settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  return NextResponse.json(data)
}
