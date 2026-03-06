import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase.from('docs_pages').select('id, title, is_home, path, latest_revision_id')
    console.log(data)

    for (const page of data) {
        if (page.latest_revision_id) {
            const rev = await supabase.from('docs_page_revisions').select('blocks').eq('id', page.latest_revision_id).single()
            console.log('Page:', page.title, 'Blocks:', JSON.stringify(rev.data.blocks).substring(0, 50))
        }
    }
}
check()
