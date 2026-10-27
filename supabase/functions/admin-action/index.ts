import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Unit = 'm' | 'h' | 'd';
type ActionBody = {
  action?: string; project_id?: string; status?: string; target_user_id?: string; report_id?: string;
  duration?: number; unit?: Unit;
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user || !user.email_confirmed_at) return json({ error: 'Verified account required' }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('role,account_status,banned_until,moderator_until').eq('id', user.id).single();
  const isRootAdmin = profile?.role === 'admin';
  const hasTemporaryAdmin = !!profile?.moderator_until && new Date(profile.moderator_until).getTime() > Date.now();
  const isOperator = !!profile && profile.account_status === 'active'
    && (!profile.banned_until || new Date(profile.banned_until).getTime() <= Date.now())
    && (isRootAdmin || profile.role === 'moderator' || hasTemporaryAdmin);
  if (!isOperator) return json({ error: 'Administrator access required' }, 403);

  let body: ActionBody;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  let result: { error: { message: string } | null } = { error: null };
  const targetId = body.target_user_id;

  if (body.action === 'set_project_status' && body.project_id && ['published','suspended'].includes(body.status || '')) {
    result = await admin.from('projects').update({ moderation_status: body.status, visibility: body.status === 'published' ? 'public' : 'private' }).eq('id', body.project_id);
  } else if (body.action === 'set_account_status' && isRootAdmin && targetId && targetId !== user.id && ['active','suspended','pending_deletion'].includes(body.status || '')) {
    const { data: target } = await admin.from('profiles').select('role').eq('id', targetId).maybeSingle();
    if (!target || target.role === 'admin') return json({ error: 'Target account is unavailable for this action' }, 400);
    const { error: authError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: body.status === 'active' ? 'none' : '876000h' });
    if (authError) result = { error: authError };
    else result = await admin.from('profiles').update({ account_status: body.status, banned_until: null }).eq('id', targetId);
  } else if ((body.action === 'ban_user' || body.action === 'unban_user') && targetId && targetId !== user.id) {
    const { data: target } = await admin.from('profiles').select('role,moderator_until,banned_until').eq('id', targetId).maybeSingle();
    if (!target || target.role === 'admin' || (!isRootAdmin && (target.role === 'moderator' || (target.moderator_until && new Date(target.moderator_until).getTime() > Date.now())))) {
      return json({ error: 'Target account is unavailable for this action' }, 400);
    }
    if (body.action === 'ban_user') {
      const maxDuration = body.unit === 'm' ? 43200 : body.unit === 'h' ? 720 : body.unit === 'd' ? 30 : 0;
      if (!Number.isInteger(body.duration) || !body.duration || body.duration! < 1 || body.duration! > maxDuration) {
        return json({ error: 'Ban duration must be 1–30 days, expressed in minutes, hours, or days' }, 400);
      }
      const milliseconds = body.duration! * (body.unit === 'm' ? 60_000 : body.unit === 'h' ? 3_600_000 : 86_400_000);
      const bannedUntil = new Date(Date.now() + milliseconds).toISOString();
      const { error: profileError } = await admin.from('profiles').update({ banned_until: bannedUntil }).eq('id', targetId);
      if (profileError) result = { error: profileError };
      else {
        const { error: authError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: `${body.duration}${body.unit}` });
        if (authError) { result = { error: authError }; await admin.from('profiles').update({ banned_until: target.banned_until }).eq('id', targetId); }
      }
    } else {
      const { error: profileError } = await admin.from('profiles').update({ banned_until: null }).eq('id', targetId);
      if (profileError) result = { error: profileError };
      else {
        const { error: authError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: 'none' });
        if (authError) { result = { error: authError }; await admin.from('profiles').update({ banned_until: target.banned_until }).eq('id', targetId); }
      }
    }
  } else if ((body.action === 'grant_moderator' || body.action === 'revoke_moderator') && isRootAdmin && targetId && targetId !== user.id) {
    const { data: target } = await admin.from('profiles').select('role,moderator_until').eq('id', targetId).maybeSingle();
    if (!target || target.role === 'admin' || target.role === 'moderator') return json({ error: 'Target account is unavailable for temporary administrator access' }, 400);
    if (body.action === 'grant_moderator') {
      const maxDuration = body.unit === 'm' ? 43200 : body.unit === 'h' ? 720 : body.unit === 'd' ? 30 : 0;
      if (!Number.isInteger(body.duration) || !body.duration || body.duration! < 1 || body.duration! > maxDuration) {
        return json({ error: 'Temporary administrator access must be 1–30 days, expressed in minutes, hours, or days' }, 400);
      }
      const milliseconds = body.duration! * (body.unit === 'm' ? 60_000 : body.unit === 'h' ? 3_600_000 : 86_400_000);
      result = await admin.from('profiles').update({ moderator_until: new Date(Date.now() + milliseconds).toISOString() }).eq('id', targetId);
    } else result = await admin.from('profiles').update({ moderator_until: null }).eq('id', targetId);
  } else if (body.action === 'resolve_report' && body.report_id && ['resolved','dismissed'].includes(body.status || '')) {
    result = await admin.from('reports').update({ status: body.status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', body.report_id);
  } else return json({ error: 'Unsupported action or insufficient privileges' }, 400);

  const { error: auditError } = await admin.from('admin_audit_logs').insert({
    actor_id: user.id, target_user_id: targetId ?? null, action: body.action,
    result: result.error ? 'failed' : 'success',
    details: { project_id: body.project_id ?? null, status: body.status ?? null, duration: body.duration ?? null, unit: body.unit ?? null, error: result.error?.message ?? null },
  });
  if (result.error) return json({ error: result.error.message }, 400);
  if (auditError) return json({ error: `Action succeeded but audit logging failed: ${auditError.message}` }, 500);
  return json({ ok: true });
});
