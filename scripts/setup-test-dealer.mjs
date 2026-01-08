import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupTestDealer() {
  console.log('Setting up test dealer...\n');

  // First, check if test dealer already exists
  const { data: existingDealer } = await supabase
    .from('profiles')
    .select('id, company_name, slug')
    .eq('slug', 'demo-dealer')
    .single();

  if (existingDealer) {
    console.log('Test dealer already exists:', existingDealer);

    // Count listings
    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', existingDealer.id);

    console.log(`Listings: ${count}`);
    console.log(`\nView at: https://axles.ai/demo-dealer`);
    return;
  }

  // Create a test user via auth admin (generates UUID)
  const testEmail = 'demo@axles.ai';

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let testUser = existingUsers?.users?.find(u => u.email === testEmail);

  if (!testUser) {
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'demo123456',
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth error:', authError);
      return;
    }
    testUser = newUser.user;
    console.log('Created auth user:', testUser.id);
  } else {
    console.log('Using existing auth user:', testUser.id);
  }

  // Update profile to be a dealer with storefront
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: testUser.id,
      email: testEmail,
      company_name: 'Demo Truck & Trailer',
      slug: 'demo-dealer',
      tagline: 'Quality trucks and trailers at competitive prices',
      about: 'Welcome to Demo Truck & Trailer! We\'ve been serving the trucking industry for over 20 years, providing quality new and used trucks, trailers, and heavy equipment. Our experienced sales team is here to help you find the right equipment for your needs.',
      is_dealer: true,
      phone: '(555) 123-4567',
      city: 'Houston',
      state: 'TX',
      address: '1234 Demo Drive',
      zip_code: '77001',
      website: 'https://axles.ai',
      chat_enabled: true,
      chat_settings: {
        greeting: 'Hi! Welcome to Demo Truck & Trailer. How can I help you find the right equipment today?',
        personality: 'friendly and knowledgeable',
        collectLeadAfter: 3,
      },
      social_links: {
        facebook: 'https://facebook.com',
        instagram: 'https://instagram.com',
      },
      business_hours: {
        monday: { open: '08:00', close: '18:00', closed: false },
        tuesday: { open: '08:00', close: '18:00', closed: false },
        wednesday: { open: '08:00', close: '18:00', closed: false },
        thursday: { open: '08:00', close: '18:00', closed: false },
        friday: { open: '08:00', close: '18:00', closed: false },
        saturday: { open: '09:00', close: '15:00', closed: false },
        sunday: { open: '', close: '', closed: true },
      },
      storefront_views: 0,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    console.error('Profile error:', profileError);
    return;
  }

  console.log('Created dealer profile');

  // Get some sample listings to assign to this dealer
  const { data: sampleListings } = await supabase
    .from('listings')
    .select('id, title')
    .eq('status', 'active')
    .limit(20);

  if (sampleListings && sampleListings.length > 0) {
    // Assign first 20 listings to demo dealer
    const { error: updateError } = await supabase
      .from('listings')
      .update({ user_id: testUser.id })
      .in('id', sampleListings.map(l => l.id));

    if (updateError) {
      console.error('Error assigning listings:', updateError);
    } else {
      console.log(`Assigned ${sampleListings.length} listings to demo dealer`);
    }
  }

  console.log('\n✅ Test dealer setup complete!');
  console.log(`\nView storefront at: https://axles.ai/demo-dealer`);
  console.log('Or locally: http://localhost:3000/demo-dealer');
}

setupTestDealer().catch(console.error);
