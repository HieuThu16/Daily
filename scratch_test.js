import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ejcwwiohwgidksablzjl.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_DOnxwKqFdzH9FPF5hvgFSw_MqodIX7P'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function check() {
  console.log('Testing query on partner_invitations...')
  const { data: invs, error: invErr } = await supabase.from('partner_invitations').select('*')
  console.log('Invitations:', { invs, invErr })

  console.log('Testing query on shared_partners...')
  const { data: partners, error: partErr } = await supabase.from('shared_partners').select('*')
  console.log('Shared Partners:', { partners, partErr })

  console.log('Testing query on shared_events...')
  const { data: events, error: evErr } = await supabase.from('shared_events').select('*')
  console.log('Shared Events:', { events, evErr })
}

check()
