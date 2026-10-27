import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Sign in required' }, { status: 401, headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user || !user.email_confirmed_at) return Response.json({ error: 'Verified account required' }, { status: 401, headers: corsHeaders });
  let input: { project_id?: string };
  try { input = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders }); }
  if (!input.project_id || !/^[0-9a-f-]{36}$/i.test(input.project_id)) return Response.json({ error: 'Invalid project id' }, { status: 400, headers: corsHeaders });
  const serviceClient = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile } = await serviceClient.from('profiles').select('account_status,banned_until').eq('id', user.id).single();
  if (!profile || profile.account_status !== 'active' || (profile.banned_until && new Date(profile.banned_until).getTime() > Date.now())) return Response.json({ error: 'Active account required' }, { status: 403, headers: corsHeaders });
  const { data: project } = await serviceClient.from('projects').select('id').eq('id', input.project_id).eq('visibility', 'public').eq('moderation_status', 'published').maybeSingle();
  if (!project) return Response.json({ error: 'Project is unavailable' }, { status: 404, headers: corsHeaders });
  const { data: build } = await serviceClient.from('project_builds').select('id,launch_url,version').eq('project_id', project.id).not('launch_url', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!build?.launch_url) return Response.json({ error: 'No browser build available' }, { status: 404, headers: corsHeaders });
  let launch: URL;
  try { launch = new URL(build.launch_url); if (launch.protocol !== 'https:' || launch.username || launch.password) throw new Error('Invalid game URL'); }
  catch { return Response.json({ error: 'Unsafe game URL' }, { status: 400, headers: corsHeaders }); }
  const { error: historyError } = await serviceClient.from('play_history').insert({ user_id: user.id, project_id: project.id });
  if (historyError) return Response.json({ error: 'Could not record play access' }, { status: 500, headers: corsHeaders });
  return Response.json({ launch_url: launch.toString(), version: build.version }, { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
});
