import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xikizeymdabgwmwfifff.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa2l6ZXltZGFiZ3dtd2ZpZmZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNDk5MDUsImV4cCI6MjA4MjcyNTkwNX0.uCqIK7X5ahvQ2YisEBG1O5wVcgoYv5WGPGAl_eLryP4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
