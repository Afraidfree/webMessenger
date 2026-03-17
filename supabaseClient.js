import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://kngwuzbuiyrzgvosckwc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZ3d1emJ1aXlyemd2b3Nja3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDM2NDAsImV4cCI6MjA4OTMxOTY0MH0.jsGx34wQnL1IY3hkkPu1FLWcpEBkm8p2gHrvdGjpDQ8'

export const supabase = createClient(supabaseUrl, supabaseKey)