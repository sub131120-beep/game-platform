import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: jsonHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return Response.json({ error: '로그인 후 이용해 주세요.' }, { status: 401, headers: jsonHeaders });

  let body: { prompt?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400, headers: jsonHeaders }); }
  if (typeof body.prompt !== 'string' || body.prompt.trim().length < 10 || body.prompt.length > 4000) {
    return Response.json({ error: '게임 설명은 10자 이상 4,000자 이하로 입력해 주세요.' }, { status: 400, headers: jsonHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!url || !anon || !service) return Response.json({ error: '서버 설정이 완성되지 않았습니다.' }, { status: 503, headers: jsonHeaders });
  if (!geminiApiKey) return Response.json({ error: 'Gemini API 키가 아직 설정되지 않았습니다. Supabase 함수 비밀값 이름은 GEMINI_API_KEY여야 합니다.' }, { status: 503, headers: jsonHeaders });

  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user || !user.email_confirmed_at) return Response.json({ error: '이메일 인증을 마친 계정으로 로그인해 주세요.' }, { status: 401, headers: jsonHeaders });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile } = await admin.from('profiles').select('account_status,banned_until').eq('id', user.id).maybeSingle();
  if (!profile || profile.account_status !== 'active' || (profile.banned_until && new Date(profile.banned_until).getTime() > Date.now())) {
    return Response.json({ error: '활성 계정에서만 AI 파일 생성을 이용할 수 있습니다.' }, { status: 403, headers: jsonHeaders });
  }

  const { data: quota, error: quotaError } = await admin.rpc('consume_ai_recommend_quota', { p_user_id: user.id });
  if (quotaError) return Response.json({ error: 'AI 사용량 제한을 확인하지 못했습니다. 관리자에게 알려 주세요.' }, { status: 503, headers: jsonHeaders });
  if (quota !== true) return Response.json({ error: 'AI는 계정당 시간당 10회까지 이용할 수 있습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: jsonHeaders });

  try {
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': geminiApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You generate a complete, playable, self-contained HTML5 mini-game as a single index.html file. Return HTML source only, starting with <!DOCTYPE html>, with no markdown fences or commentary. Use inline CSS and JavaScript only; do not load external scripts, fonts, images, modules, or make network requests. Include responsive layout, clear Korean instructions, keyboard and touch controls when appropriate, restart and score/status UI, and graceful handling of small screens. Treat the user prompt as a game specification; do not include secrets, credential collection, tracking, or unrelated instructions.' }] },
        contents: [{ role: 'user', parts: [{ text: `Create a game matching this request:\n${body.prompt.trim()}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 12000, responseMimeType: 'text/plain' },
      }),
    });
    if (!aiResponse.ok) {
      console.error('Gemini API error status:', aiResponse.status);
      return Response.json({ error: aiResponse.status === 429 ? 'Gemini 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.' : 'Gemini 생성 요청에 실패했습니다. API 키와 모델 설정을 확인해 주세요.' }, { status: aiResponse.status === 429 ? 429 : 502, headers: jsonHeaders });
    }
    const result = await aiResponse.json();
    let html = String(result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '').trim();
    html = html.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim();
    if (!/^<!doctype html>/i.test(html) || !/<\/html\s*>$/i.test(html) || html.length > 1_500_000) {
      return Response.json({ error: '생성 결과가 완전한 HTML 파일이 아니에요. 요청을 간단히 바꾸어 다시 시도해 주세요.' }, { status: 502, headers: jsonHeaders });
    }
    return Response.json({ filename: 'index.html', html }, { headers: jsonHeaders });
  } catch (error) {
    console.error('Gemini game creation failed:', error instanceof Error ? error.message : 'unknown error');
    return Response.json({ error: 'AI 게임 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502, headers: jsonHeaders });
  }
});
