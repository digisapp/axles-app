import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Count profiles with company_name vs without
const { count: withName } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .like('email', '%@dealers.axlon.ai')
  .not('company_name', 'is', null)

const { count: withoutName } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .like('email', '%@dealers.axlon.ai')
  .is('company_name', null)

const { count: total } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .like('email', '%@dealers.axlon.ai')

console.log('Placeholder profiles breakdown:')
console.log(`  Total: ${total}`)
console.log(`  With company name: ${withName}`)
console.log(`  Without company name: ${withoutName}`)
console.log('')

// Check if phone is embedded in email (all should be phone numbers)
const { data: sample } = await supabase
  .from('profiles')
  .select('email')
  .like('email', '%@dealers.axlon.ai')
  .limit(5)

console.log('Phone numbers extracted from emails:')
sample?.forEach(p => {
  const phone = p.email.split('@')[0]
  const formatted = phone.length === 10
    ? `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}`
    : phone
  console.log(`  ${formatted}`)
})

// Check listings for dealer info
console.log('\n--- Checking listings for dealer data ---')
const { data: listings } = await supabase
  .from('listings')
  .select('dealer_name, dealer_phone, dealer_email, dealer_website, user_id')
  .not('dealer_name', 'is', null)
  .limit(10)

console.log('\nListings with dealer info:')
listings?.forEach(l => {
  console.log(`  Name: ${l.dealer_name}`)
  console.log(`  Phone: ${l.dealer_phone || 'none'}`)
  console.log(`  Email: ${l.dealer_email || 'none'}`)
  console.log(`  Website: ${l.dealer_website || 'none'}`)
  console.log('')
})
