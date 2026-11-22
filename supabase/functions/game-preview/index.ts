import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  let input: { project_id?: string };
  try { input = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders }); }
  if (!input.project_id || !/^[0-9a-f-]{36}$/i.test(input.project_id)) return Response.json({ error: 'Invalid project id' }, { status: 400, headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: project } = await admin.from('projects').select('id').eq('id', input.project_id).eq('visibility', 'public').eq('moderation_status', 'published').maybeSingle();
  if (!project) return Response.json({ error: 'Project is unavailable' }, { status: 404, headers: corsHeaders });

  const { data: build } = await admin.from('project_builds').select('launch_url,version').eq('project_id', project.id).not('launch_url', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!build?.launch_url) return Response.json({ error: 'No preview available' }, { status: 404, headers: corsHeaders });
  try {
    const launch = new URL(build.launch_url);
    if (launch.protocol !== 'https:' || launch.username || launch.password) throw new Error('Unsafe URL');
    return Response.json({ launch_url: launch.toString(), version: build.version }, { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Unsafe launch URL' }, { status: 400, headers: corsHeaders });
  }
});
