import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

const envConfig = dotenv.parse(fs.readFileSync('.env.local'))
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const blocks = [
        {
            id: "intro",
            type: "richText",
            content: "<h1>Руководство по работе с CBTooll</h1><p>Здесь вы можете описать основные аспекты работы с вашим конструктором.</p>"
        }
    ]

    const { data: page } = await supabase.from('docs_pages').select('latest_revision_id, id').eq('id', 'f8e28aa9-41c1-4fb9-b1c1-9f63d1732f6f').single()

    if (page && page.latest_revision_id) {
        await supabase.from('docs_page_revisions').update({ blocks }).eq('id', page.latest_revision_id)
        console.log('Restored draft')
    }
}
run()
