import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

const envConfig = dotenv.parse(fs.readFileSync('.env.local'))
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('docs_pages').select('id, title, is_home, path, latest_revision_id, sort_order')

  if (data) {
    for (const page of data) {
      if (page.latest_revision_id) {
        const rev = await supabase.from('docs_page_revisions').select('blocks').eq('id', page.latest_revision_id).single()
        console.log('Page:', page.title, '| ID:', page.id, '| isHome:', page.is_home);
        console.log('Blocks text partial:', JSON.stringify(rev.data.blocks).substring(0, 100));
      }
    }
  }
}
check()
