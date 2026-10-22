import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user || !user.email_confirmed_at) return Response.json({ error: 'Verified account required' }, { status: 401, headers: corsHeaders });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('role,account_status').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || profile.account_status !== 'active') return Response.json({ error: 'Administrator access required' }, { status: 403, headers: corsHeaders });
  let body: { action?: string; project_id?: string; status?: string; target_user_id?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders }); }
  let result: { error: { message: string } | null } = { error: null };
  if (body.action === 'set_project_status' && body.project_id && ['published','suspended'].includes(body.status || '')) {
    result = await admin.from('projects').update({ moderation_status: body.status, visibility: body.status === 'published' ? 'public' : 'private' }).eq('id', body.project_id);
  } else if (body.action === 'set_account_status' && body.target_user_id && body.target_user_id !== user.id && ['active','suspended','pending_deletion'].includes(body.status || '')) {
    const { data: target } = await admin.from('profiles').select('role,account_status').eq('id', body.target_user_id).maybeSingle();
    if (!target || target.role === 'admin') return Response.json({ error: 'Target account is unavailable for this action' }, { status: 400, headers: corsHeaders });
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(body.target_user_id, { ban_duration: body.status === 'active' ? 'none' : '876000h' });
    if (authUpdateError) result = { error: authUpdateError };
    else {
      result = await admin.from('profiles').update({ account_status: body.status }).eq('id', body.target_user_id);
      if (result.error) await admin.auth.admin.updateUserById(body.target_user_id, { ban_duration: target.account_status === 'active' ? 'none' : '876000h' });
    }
  } else if (body.action === 'resolve_report' && body.report_id && ['resolved','dismissed'].includes(body.status || '')) {
    result = await admin.from('reports').update({ status: body.status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', body.report_id);
  } else return Response.json({ error: 'Unsupported action or invalid input' }, { status: 400, headers: corsHeaders });
  const { error: auditError } = await admin.from('admin_audit_logs').insert({ actor_id: user.id, target_user_id: body.target_user_id ?? null, action: body.action, result: result.error ? 'failed' : 'success', details: { project_id: body.project_id ?? null, status: body.status ?? null, error: result.error?.message ?? null } });
  if (result.error) return Response.json({ error: result.error.message }, { status: 400, headers: corsHeaders });
  if (auditError) return Response.json({ error: `Action succeeded but audit logging failed: ${auditError.message}` }, { status: 500, headers: corsHeaders });
  return Response.json({ ok: true }, { headers: corsHeaders });
});
