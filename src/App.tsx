import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bell, Compass, FileText, Gamepad2, Heart, History, LayoutDashboard, LogIn, LogOut, Menu, Search, Shield, Sparkles, UserRound, X } from 'lucide-react';
import { configured, supabase } from './supabase';
import type { Project } from './types';
import { hasLaunchEligibility, isHttpsLaunchUrl } from './security';
import type { Session } from '@supabase/supabase-js';

const categories = ['전체','액션','퍼즐','어드벤처','전략','웹 프로젝트'];
const coverGradients = ['linear-gradient(135deg,#4c2457,#e45e7b)','linear-gradient(135deg,#214a65,#50b9bf)','linear-gradient(135deg,#63381f,#e0a257)','linear-gradient(135deg,#1e385a,#7688d8)'];
function App() {
  const [session,setSession]=useState<Session|null>(null), [profile,setProfile]=useState<any>(null), [projects,setProjects]=useState<Project[]>([]), [loading,setLoading]=useState(true), [notice,setNotice]=useState(''), [query,setQuery]=useState(''), [category,setCategory]=useState('전체'), [favorites,setFavorites]=useState<string[]>([]), [mobile,setMobile]=useState(false), [canUpload,setCanUpload]=useState(false);
  const location=useLocation(), navigate=useNavigate();
  const refresh=async()=>{
    if(!supabase){setLoading(false);return}
    const [{data:{session:s}}, {data:p}] = await Promise.all([supabase.auth.getSession(), supabase.from('profiles').select('id,username,display_name,role,account_status').maybeSingle()]);
    setSession(s); setProfile(p); setFavorites([]);
    if(s){const {data:allowed}=await supabase.rpc('can_upload_games');setCanUpload(allowed===true)}else setCanUpload(false);
    const {data,error}=await supabase.from('projects').select('id,owner_id,slug,title,description,category,version,visibility,moderation_status,cover_url,created_at').eq('visibility','public').eq('moderation_status','published').order('created_at',{ascending:false});
    if(error)setNotice(error.message); else setProjects((data||[]) as Project[]);
    if(s){const {data:f}=await supabase.from('favorites').select('project_id');setFavorites((f||[]).map(x=>x.project_id))}
    setLoading(false);
  };
  useEffect(()=>{void refresh(); if(!supabase)return; const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{queueMicrotask(()=>void refresh())});return()=>subscription.unsubscribe()},[]);
  const filtered=useMemo(()=>projects.filter(p=>(category==='전체'||p.category===category)&&`${p.title} ${p.description} ${p.category}`.toLowerCase().includes(query.toLowerCase())),[projects,category,query]);
  const toggleFavorite=async(id:string)=>{if(!session){navigate('/login',{state:{from:location.pathname}});return} const exists=favorites.includes(id);const res=exists?await supabase!.from('favorites').delete().eq('project_id',id):await supabase!.from('favorites').insert({user_id:session.user.id,project_id:id}); if(res.error)setNotice(res.error.message);else setFavorites(exists?favorites.filter(x=>x!==id):[...favorites,id])};
  const shell=(content:ReactNode)=><div className="app"><aside className={`sidebar ${mobile?'open':''}`}><Link to="/" className="brand" onClick={()=>setMobile(false)}><span className="brand-icon"><Gamepad2 size={22}/></span><span>PLAYGROUND<small>INDIE GAME HUB</small></span></Link><p className="side-label">DISCOVER</p><Link to="/" className={`navlink ${location.pathname==='/'?'selected':''}`}><Compass/> 둘러보기</Link><Link to="/favorites" className="navlink"><Heart/> 즐겨찾기</Link><Link to={session?'/account':'/login'} className="navlink"><LayoutDashboard/> 내 라이브러리</Link>{session&&<Link to="/history" className="navlink"><History/> 플레이 기록</Link>}{session&&canUpload&&<Link to="/developer" className="navlink"><Sparkles/> 작품 등록</Link>}{profile?.role==='admin'&&<Link to="/admin" className="navlink"><Shield/> 운영 대시보드</Link>}<div className="side-bottom"><div className="online"><i/> 안전한 플레이를 위한 공간</div>{session?<button className="navlink plain" onClick={async()=>{await supabase!.auth.signOut();navigate('/')}}><LogOut/> 로그아웃</button>:<Link to="/login" className="navlink"><LogIn/> 로그인</Link>}</div></aside><div className="main"><header className="topbar"><button className="mobile-menu icon-button" onClick={()=>setMobile(!mobile)} aria-label="메뉴"><Menu/></button><div className="crumb">{location.pathname==='/'?'DISCOVER':location.pathname.split('/').filter(Boolean).join(' / ').toUpperCase()}</div><div className="top-right"><Link to="/search" className="icon-button" aria-label="검색"><Search/></Link><button className="icon-button" aria-label="알림" onClick={()=>setNotice('새 알림이 없습니다.')}><Bell/></button>{session?<Link to="/account" className="profile-chip"><span className="avatar">{(profile?.display_name||session.user.email||'P').slice(0,1).toUpperCase()}</span><span>{profile?.display_name||'내 계정'}</span></Link>:<Link className="button button-small" to="/login">로그인 <ArrowRight size={15}/></Link>}</div></header><main className="content">{notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="닫기"><X size={15}/></button></div>}{!configured&&<div className="setup-notice"><Sparkles size={17}/><span><b>Supabase 설정이 필요합니다.</b> `.env`에 프로젝트 URL과 공개 키를 입력하면 회원 인증과 작품 데이터가 연결됩니다.</span></div>}{content}</main><footer>© 2026 PLAYGROUND <span>안전하고 즐거운 인디 게임 경험</span><Link to="/terms">이용약관</Link><Link to="/privacy">개인정보 처리방침</Link></footer></div></div>;
  const browse=<><section className="hero"><div className="hero-content"><div className="eyebrow"><Sparkles size={14}/> DISCOVER YOUR NEXT FAVORITE</div><h1>다음 플레이,<br/><em>여기서 시작해요.</em></h1><p>독립 개발자가 만든 게임과 프로젝트를 발견하고<br className="desktop"/> 브라우저에서 바로 플레이해 보세요.</p><a className="button primary" href="#library">게임 둘러보기 <ArrowRight size={16}/></a></div><div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="floating-card"><Gamepad2 size={34}/><span>READY TO PLAY</span></div><div className="hero-star">✳</div></div></section><div className="section-top" id="library"><div><div className="eyebrow muted">THE COLLECTION</div><h2>지금 둘러보기</h2></div><label className="searchbox"><Search size={18}/><input placeholder="게임, 프로젝트 검색" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label></div><div className="filters">{categories.map(c=><button className={category===c?'active':''} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div>{loading?<div className="loading">작품을 불러오는 중…</div>:filtered.length?<div className="game-grid">{filtered.map((p,i)=><ProjectCard key={p.id} p={p} i={i} favored={favorites.includes(p.id)} onFavorite={()=>void toggleFavorite(p.id)}/>)}</div>:<div className="empty"><div className="empty-icon"><Gamepad2/></div><h3>{query?'검색 결과가 없습니다':'아직 공개된 작품이 없습니다'}</h3><p>{query?'다른 검색어로 찾아보세요.':'Supabase에 공개 승인된 작품을 등록하면 이곳에 표시됩니다.'}</p></div>}</>;
  return shell(<Routes><Route path="/" element={browse}/><Route path="/search" element={<div className="page-wrap"><h1>작품 검색</h1><label className="searchbox wide"><Search/><input autoFocus placeholder="제목, 설명, 카테고리" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="game-grid">{filtered.map((p,i)=><ProjectCard key={p.id} p={p} i={i} favored={favorites.includes(p.id)} onFavorite={()=>void toggleFavorite(p.id)}/>)}</div></div>}/><Route path="/project/:slug" element={<Detail projects={projects} favorites={favorites} toggleFavorite={toggleFavorite} session={session}/>}/><Route path="/play/:slug" element={<Play projects={projects} session={session} profile={profile} loading={loading}/>}/><Route path="/login" element={<Auth mode="login"/>}/><Route path="/signup" element={<Auth mode="signup"/>}/><Route path="/reset" element={<Auth mode="reset"/>}/><Route path="/account" element={session?<Account session={session} profile={profile} reload={refresh}/>:<Navigate to="/login" state={{from:'/account'}} replace/>}/><Route path="/developer" element={session&&profile?.account_status==='active'?<Developer session={session} reload={refresh}/>:<Navigate to="/login" state={{from:'/developer'}} replace/>}/><Route path="/favorites" element={session?<div className="page-wrap"><h1>즐겨찾기</h1><div className="game-grid">{projects.filter(p=>favorites.includes(p.id)).map((p,i)=><ProjectCard key={p.id} p={p} i={i} favored onFavorite={()=>void toggleFavorite(p.id)}/>)}</div></div>:<Navigate to="/login" state={{from:'/favorites'}} replace/>}/><Route path="/history" element={session?<PlayHistory/>:<Navigate to="/login" state={{from:'/history'}} replace/>}/><Route path="/creator/:username" element={<CreatorProfile/>}/><Route path="/admin" element={session&&profile?.role==='admin'?<AdminDashboard reload={refresh}/>:<Navigate to="/login" state={{from:'/admin'}} replace/>}/><Route path="/terms" element={<Policy title="이용약관"/>}/><Route path="/privacy" element={<Policy title="개인정보 처리방침"/>}/><Route path="*" element={<div className="empty"><h2>페이지를 찾을 수 없습니다</h2><Link to="/" className="button">홈으로</Link></div>}/></Routes>);
}
function ProjectCard({p,i,favored,onFavorite}:{p:Project;i:number;favored:boolean;onFavorite:()=>void}){return <article className="game-card"><Link to={`/project/${p.slug}`} className="cover" style={{background:p.cover_url?`linear-gradient(180deg,transparent,#1119),url(${p.cover_url}) center/cover`:coverGradients[i%4]}}><span className="cover-category">{p.category||'PROJECT'}</span><span className="cover-mark">{p.title.slice(0,1)}</span><span className="cover-version">v{p.version}</span></Link><div className="card-body"><div className="card-title"><Link to={`/project/${p.slug}`}><h3>{p.title}</h3></Link><button onClick={onFavorite} className={`heart ${favored?'on':''}`} aria-label="즐겨찾기"><Heart size={18} fill={favored?'currentColor':'none'}/></button></div><p>{p.description}</p><div className="card-foot"><span>인디 개발자</span><Link to={`/project/${p.slug}`}>살펴보기 <ArrowRight size={13}/></Link></div></div></article>}
function Detail({projects,favorites,toggleFavorite,session}:{projects:Project[];favorites:string[];toggleFavorite:(id:string)=>void;session:Session|null}){const {slug}=useParams();const p=projects.find(x=>x.slug===slug);if(!p)return <div className="page-wrap"><Link to="/" className="back"><ArrowLeft/> 둘러보기</Link><div className="empty"><h2>작품을 찾을 수 없습니다</h2><p>삭제되었거나 아직 공개되지 않은 작품입니다.</p></div></div>;return <div className="page-wrap"><Link to="/" className="back"><ArrowLeft/> 둘러보기</Link><div className="detail-cover" style={{background:p.cover_url?`linear-gradient(90deg,#111c,#1110),url(${p.cover_url}) center/cover`:coverGradients[0]}}><span>{p.category} · VERSION {p.version}</span><h1>{p.title}</h1></div><div className="detail-layout"><section><div className="eyebrow muted">ABOUT THIS PROJECT</div><h2>작품 소개</h2><p className="detail-description">{p.description}</p><div className="detail-info"><div><small>제작자</small><CreatorLink projectId={p.id}/></div><div><small>최근 업데이트</small><b>{new Date(p.created_at).toLocaleDateString('ko-KR')}</b></div><div><small>버전</small><b>{p.version}</b></div></div><ReportForm projectId={p.id} session={session}/></section><aside className="launch-panel"><div className="launch-icon"><Gamepad2/></div><h3>플레이할 준비가 됐나요?</h3><p>로그인 및 이메일 인증이 필요한 작품입니다.</p><Link className="button primary full" to={`/play/${p.slug}`}>지금 플레이 <ArrowRight size={16}/></Link><button className="button ghost full" onClick={()=>toggleFavorite(p.id)}><Heart size={16} fill={favorites.includes(p.id)?'currentColor':'none'}/> {favorites.includes(p.id)?'즐겨찾기됨':'즐겨찾기'}</button></aside></div></div>}

function CreatorLink({projectId}:{projectId:string}){const [creator,setCreator]=useState<{username:string;display_name:string}|null>(null);useEffect(()=>{let live=true;void supabase?.rpc('get_project_creator',{p_project_id:projectId}).maybeSingle().then(({data})=>{if(live&&data)setCreator(data as typeof creator)});return()=>{live=false}},[projectId]);return creator?<Link className="creator-link" to={`/creator/${creator.username}`}>{creator.display_name} <span>@{creator.username}</span></Link>:<b>제작자</b>}

function ReportForm({projectId,session}:{projectId:string;session:Session|null}){const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!session){setMessage('신고하려면 로그인해 주세요.');return}const reason=String(new FormData(e.currentTarget).get('reason')||'').trim();if(reason.length<10){setMessage('신고 사유를 10자 이상 입력해 주세요.');return}setBusy(true);const {error}=await supabase!.from('reports').insert({reporter_id:session.user.id,project_id:projectId,reason});setBusy(false);if(error)setMessage(error.message);else{setMessage('신고가 접수되었습니다. 검토 후 필요한 조치를 진행합니다.');setOpen(false)}}return <div className="report-box"><button className="text-button" onClick={()=>setOpen(!open)}><FileText size={14}/> 작품 신고</button>{open&&<form onSubmit={submit}><label>신고 사유<textarea name="reason" minLength={10} maxLength={2000} required placeholder="문제 내용을 구체적으로 적어 주세요."/></label><button className="button" disabled={busy}>{busy?'접수 중…':'신고 제출'}</button></form>}{message&&<p className="form-success">{message}</p>}</div>}
function Play({projects,session,profile,loading}:{projects:Project[];session:Session|null;profile:any;loading:boolean}){const {slug}=useParams(),location=useLocation();const p=projects.find(x=>x.slug===slug);if(!session)return <Navigate to="/login" state={{from:location.pathname}} replace/>;if(loading||!profile)return <div className="loading">계정 권한을 확인하는 중…</div>;if(!hasLaunchEligibility({emailVerified:Boolean(session.user.email_confirmed_at),accountActive:profile.account_status==='active'}))return <div className="empty"><Shield/><h2>계정 상태를 확인해 주세요</h2><p>계정이 활성화된 뒤 보호된 기능을 이용할 수 있습니다.</p></div>;if(!p)return <div className="empty"><h2>작품을 찾을 수 없습니다</h2><p>공개 작품이 아니거나 삭제되었습니다.</p></div>;return <LaunchFrame project={p}/>}
function LaunchFrame({project:p}:{project:Project}){const navigate=useNavigate(),[launchUrl,setLaunchUrl]=useState(''),[failed,setFailed]=useState(false),[launching,setLaunching]=useState(true),[attempt,setAttempt]=useState(0);useEffect(()=>{let live=true;setLaunching(true);setFailed(false);void supabase!.functions.invoke('game-launch',{body:{project_id:p.id}}).then(({data,error})=>{if(!live)return;if(error||!data?.launch_url){setFailed(true)}else{try{if(!isHttpsLaunchUrl(data.launch_url))throw Error();setLaunchUrl(data.launch_url)}catch{setFailed(true)}}setLaunching(false)});return()=>{live=false}},[p.id,attempt]);return <div className="player-page"><button className="back" onClick={()=>navigate(`/project/${p.slug}`)}><ArrowLeft/> 작품으로</button><div className="player-title"><div><div className="eyebrow muted">NOW PLAYING</div><h1>{p.title}</h1></div><button className="button" onClick={()=>document.querySelector('iframe')?.requestFullscreen()}>전체 화면</button></div>{launching?<div className="loading">로그인, 인증, 작품 공개 상태와 실행 권한을 확인하는 중…</div>:failed?<div className="player-error"><h2>게임을 불러오지 못했습니다</h2><p>호스팅 주소와 iframe 허용 설정을 확인한 뒤 다시 시도해 주세요.</p><button className="button primary" onClick={()=>{setLaunchUrl('');setAttempt(attempt+1)}}>다시 시도</button></div>:<iframe key={launchUrl} title={`${p.title} 게임`} src={launchUrl} sandbox="allow-scripts allow-pointer-lock allow-forms" referrerPolicy="no-referrer" allow="fullscreen; gamepad" onError={()=>setFailed(true)}/>}</div>}
function Auth({mode}:{mode:'login'|'signup'|'reset'}){
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const nav=useNavigate(),loc=useLocation();
  const from=(loc.state as any)?.from||'/account';
  const title=mode==='signup'?'계정 만들기':mode==='reset'?'비밀번호 재설정':'다시 만나 반가워요';

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!supabase){setError('Supabase 환경 설정을 먼저 완료해 주세요.');return}
    setBusy(true);setError('');setMessage('');
    const f=new FormData(e.currentTarget),email=String(f.get('email')).trim(),password=String(f.get('password')||'');
    try{
      if(mode==='signup'){
        const username=String(f.get('username')).trim().toLowerCase(),display_name=String(f.get('display_name')).trim();
        if(password.length<10)throw Error('비밀번호는 10자 이상이어야 합니다.');
        if(password!==f.get('confirm'))throw Error('비밀번호 확인이 일치하지 않습니다.');
        if(!f.get('terms'))throw Error('이용약관과 개인정보 처리방침에 동의해 주세요.');
        const {error:e}=await supabase.auth.signUp({email,password,options:{data:{username,display_name}}});
        if(e)throw e;
        setMessage('인증 링크를 이메일로 보냈어요. 메일의 링크를 눌러 가입을 완료해 주세요.');
      }else if(mode==='login'){
        const {data,error:e}=await supabase.auth.signInWithPassword({email,password});
        if(e){
          const authMessage=e.message.toLowerCase();
          if(authMessage.includes('email not confirmed')||authMessage.includes('email_not_confirmed')){
            const {error:resendError}=await supabase.auth.resend({type:'signup',email});
            if(resendError)throw resendError;
            setMessage('이메일 인증이 아직 안 됐어요. 새 인증 링크를 보냈으니 메일을 확인해 주세요.');
            return;
          }
          throw e;
        }
        if(!data.user.email_confirmed_at){await supabase.auth.signOut();throw Error('이메일 인증을 완료한 뒤 로그인해 주세요.')}
        nav(from,{replace:true});
      }else{
        const {error:e}=await supabase.auth.resetPasswordForEmail(email);
        if(e)throw e;
        setMessage('계정이 존재하는 경우 비밀번호 재설정 링크를 이메일로 보냈습니다.');
      }
    }catch(err){const text=err instanceof Error?err.message:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';setError(text.includes('duplicate key')?'이미 사용 중인 아이디 또는 닉네임입니다.':text)}
    finally{setBusy(false)}
  }

  return <div className="auth-wrap"><div className="auth-art"><div className="eyebrow"><Sparkles size={14}/> YOUR NEXT ADVENTURE</div><h2>작은 팀의 큰 상상,<br/><em>한 번의 클릭으로.</em></h2><p>새로운 세계를 만드는 창작자와<br/>플레이어를 연결합니다.</p></div><form className="auth-card" onSubmit={submit}><div className="eyebrow muted">PLAYGROUND ACCOUNT</div><h1>{title}</h1><p className="auth-sub">{mode==='signup'?'멋진 게임 경험이 기다리고 있어요.':mode==='reset'?'가입한 이메일로 안전한 재설정 링크를 보내드립니다.':'계속하려면 로그인해 주세요.'}</p>{mode==='signup'&&<><label>아이디<input name="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" placeholder="영문, 숫자, 밑줄"/></label><label>닉네임<input name="display_name" required maxLength={32} placeholder="플랫폼에 표시될 이름"/></label></>}<label>이메일<input name="email" type="email" required autoComplete="email" placeholder="you@example.com"/></label>{mode!=='reset'&&<label>비밀번호<input name="password" type="password" required autoComplete={mode==='signup'?'new-password':'current-password'} placeholder={mode==='signup'?'10자 이상':'비밀번호 입력'}/></label>}{mode==='signup'&&<><label>비밀번호 확인<input name="confirm" type="password" required autoComplete="new-password"/></label><label className="terms-check"><input type="checkbox" name="terms"/> <span><Link to="/terms">이용약관</Link> 및 <Link to="/privacy">개인정보 처리방침</Link>에 동의합니다. (필수)</span></label></>}{error&&<p className="form-error">{error}</p>}{message&&<p className="form-success">{message}</p>}<button disabled={busy} className="button primary full">{busy?'처리 중…':mode==='signup'?'가입하고 인증 메일 받기':mode==='reset'?'재설정 링크 보내기':'로그인'} <ArrowRight size={16}/></button><div className="auth-links">{mode==='login'?<><Link to="/reset">비밀번호를 잊으셨나요?</Link><span>계정이 없나요? <Link to="/signup">회원가입</Link></span></>:<span>이미 계정이 있나요? <Link to="/login">로그인</Link></span>}</div></form></div>
}function Account({session,profile,reload}:{session:Session;profile:any;reload:()=>Promise<void>}){const [msg,setMsg]=useState('');async function rename(e:FormEvent<HTMLFormElement>){e.preventDefault();const d=String(new FormData(e.currentTarget).get('display_name')).trim();const {error}=await supabase!.from('profiles').update({display_name:d}).eq('id',session.user.id);setMsg(error?.message||'프로필을 저장했습니다.');await reload()}async function changePassword(e:FormEvent<HTMLFormElement>){e.preventDefault();const d=new FormData(e.currentTarget),p=String(d.get('password'));if(p.length<10){setMsg('새 비밀번호는 10자 이상이어야 합니다.');return}const {error}=await supabase!.auth.updateUser({password:p});setMsg(error?.message||'비밀번호를 변경했습니다.')}return <div className="page-wrap account"><div className="eyebrow muted">ACCOUNT SETTINGS</div><h1>계정 설정</h1><div className="settings-grid"><section className="settings-card"><UserRound/><h2>프로필</h2><p>로그인한 회원님의 공개 프로필 정보입니다.</p><form onSubmit={rename}><label>아이디<input value={profile?.username||''} disabled/></label><label>닉네임<input name="display_name" defaultValue={profile?.display_name||''} required maxLength={32}/></label><button className="button primary">변경 저장</button></form></section><section className="settings-card"><Shield/><h2>보안</h2><p>이메일 인증: {session.user.email_confirmed_at?'완료':'미완료'}<br/>계정 상태: {profile?.account_status||'확인 중'}</p><form onSubmit={changePassword}><label>새 비밀번호<input name="password" type="password" required minLength={10} autoComplete="new-password"/></label><button className="button">비밀번호 변경</button></form><button className="text-button" onClick={async()=>{await supabase!.auth.signOut({scope:'global'});window.location.assign(import.meta.env.BASE_URL)}}>모든 기기에서 로그아웃</button></section></div>{msg&&<p className="form-success">{msg}</p>}</div>}
const MAX_GAME_FILES = 500;
const MAX_GAME_FILE_BYTES = 50 * 1024 * 1024;
const MAX_GAME_TOTAL_BYTES = 200 * 1024 * 1024;

function contentTypeFor(file: File, path: string) {
  if (file.type) return file.type;
  const extension = path.split('.').pop()?.toLowerCase();
  const knownTypes: Record<string, string> = {
    html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript',
    css: 'text/css', json: 'application/json', wasm: 'application/wasm',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  };
  return extension ? knownTypes[extension] || 'application/octet-stream' : 'application/octet-stream';
}

function getGameFileEntries(files: FileList | null) {
  const selected = Array.from(files || []);
  if (!selected.length) return [];
  if (selected.length > MAX_GAME_FILES) throw new Error(`게임 파일은 한 번에 ${MAX_GAME_FILES}개까지 올릴 수 있어요.`);
  const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_GAME_TOTAL_BYTES) throw new Error('게임 폴더 전체 크기는 200MB 이하여야 해요.');
  if (selected.some(file => file.size > MAX_GAME_FILE_BYTES)) throw new Error('개별 파일은 50MB 이하여야 해요.');

  const root = (selected[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0];
  const entries = selected.map(file => {
    const sourcePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = sourcePath.split('/').filter(Boolean);
    if (root && parts[0] === root) parts.shift();
    if (!parts.length || parts.some(part => part === '.' || part === '..' || part.includes('\\'))) {
      throw new Error('게임 폴더에 올바르지 않은 파일 경로가 있습니다.');
    }
    return { file, path: parts.join('/') };
  });
  const uniquePaths = new Set(entries.map(entry => entry.path.toLowerCase()));
  if (uniquePaths.size !== entries.length) throw new Error('이름이 같은 파일이 중복되어 있어요.');
  if (!entries.some(entry => entry.path.toLowerCase() === 'index.html')) {
    throw new Error('선택한 폴더의 가장 바깥쪽에 index.html 파일이 있어야 해요.');
  }
  return entries;
}

function Developer({session,reload}:{session:Session;reload:()=>Promise<void>}){
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[selectedCount,setSelectedCount]=useState(0),[selectedSize,setSelectedSize]=useState(0),[canSubmit,setCanSubmit]=useState<boolean|null>(null);
  useEffect(()=>{let live=true;void supabase?.rpc('can_upload_games').then(({data,error})=>{if(live)setCanSubmit(!error&&data===true)});return()=>{live=false}},[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!supabase){setMessage('Supabase 설정을 먼저 완료해 주세요.');return}
    const formElement=e.currentTarget,form=new FormData(formElement),input=formElement.elements.namedItem('game_files') as HTMLInputElement;
    setBusy(true);setMessage('업로드 권한을 확인하고 있어요…');
    let projectId:string|undefined;
    const uploadedPaths:string[]=[];
    try {
      const {data:allowed,error:permissionError}=await supabase.rpc('can_upload_games');
      if(permissionError)throw permissionError;
      if(allowed!==true)throw new Error('허용 목록에 등록되고 이메일 인증을 마친 계정만 작품을 제출할 수 있어요.');
      const title=String(form.get('title')).trim(),slug=String(form.get('slug')).trim().toLowerCase(),url=String(form.get('launch_url')).trim(),version=String(form.get('version')||'1.0.0');
      let entries:{file:File;path:string}[]=[];
      entries=getGameFileEntries(input.files);
      if(url&&entries.length)throw new Error('게임 폴더 업로드와 외부 URL 중 하나만 선택해 주세요.');
      if(!url&&!entries.length)throw new Error('게임 폴더를 선택하거나 외부 HTTPS 실행 주소를 입력해 주세요.');
      if(url&&new URL(url).protocol!=='https:')throw new Error('실행 주소는 올바른 HTTPS URL이어야 합니다.');
      if(entries.length===1&&entries[0].path.toLowerCase()==='index.html'){
        const html=await entries[0].file.text();
        if(html.includes('/src/main.tsx')||html.includes('id="root"'))throw new Error('선택한 파일은 게임이 아니라 PLAYGROUND 홈페이지 파일이에요. 게임 폴더를 선택하거나 게임 자체의 HTTPS 실행 주소를 입력해 주세요.');
      }
      setMessage('작품 정보를 저장하고 있어요…');
      const {data:project,error}=await supabase.from('projects').insert({owner_id:session.user.id,title,slug,description:String(form.get('description')),category:String(form.get('category')),version,visibility:'private',moderation_status:'review'}).select('id').single();
      if(error||!project)throw error||new Error('작품 정보를 저장하지 못했습니다.');
      projectId=project.id;
      let launchUrl=url;
      if(entries.length){
        const storage=supabase.storage.from('game-builds');
        let completed=0;
        for(let offset=0;offset<entries.length;offset+=4){
          const batch=entries.slice(offset,offset+4);
          const results=await Promise.allSettled(batch.map(async entry=>{
            const path=`${session.user.id}/${project.id}/${entry.path}`;
            uploadedPaths.push(path);
            const {error:uploadError}=await storage.upload(path,entry.file,{contentType:contentTypeFor(entry.file,entry.path),cacheControl:'3600',upsert:false});
            if(uploadError)throw uploadError;
            completed+=1;
            setMessage(`게임 파일 업로드 중… ${completed} / ${entries.length}개 완료`);
            return path;
          }));
          const failed=results.find(result=>result.status==='rejected');
          if(failed?.status==='rejected')throw failed.reason;
        }
        launchUrl=storage.getPublicUrl(`${session.user.id}/${project.id}/index.html`).data.publicUrl;
      }
      setMessage('검토 요청을 마무리하고 있어요…');
      const {error:buildError}=await supabase.from('project_builds').insert({project_id:project.id,version,build_type:'html5',launch_url:launchUrl,storage_path:entries.length?`${session.user.id}/${project.id}`:null});
      if(buildError)throw buildError;
      setMessage('검토 요청을 제출했습니다. 운영자 승인 후 공개됩니다.');
      formElement.reset();setSelectedCount(0);setSelectedSize(0);await reload();
    } catch(err) {
      if(uploadedPaths.length)await supabase.storage.from('game-builds').remove(uploadedPaths);
      if(projectId)await supabase.from('projects').delete().eq('id',projectId);
      setMessage(err instanceof Error?`업로드를 완료하지 못했습니다: ${err.message}`:'업로드를 완료하지 못했습니다. 설정과 네트워크를 확인해 주세요.');
    } finally {setBusy(false)}
  }
  if(canSubmit===null)return <div className="page-wrap"><div className="loading">업로드 권한을 확인하고 있어요…</div></div>;
  if(!canSubmit)return <div className="page-wrap"><div className="empty"><Sparkles/><h2>작품 등록 권한이 없어요</h2><p>운영자가 허용 목록에 등록한 이메일로 가입하고 인증해야 업로드할 수 있습니다.</p></div></div>;
  return <div className="page-wrap account"><div className="eyebrow muted">CREATOR STUDIO</div><h1>작품 등록</h1><MySubmissions ownerId={session.user.id}/><p className="muted">게임 폴더를 선택하거나 외부 HTTPS 실행 주소를 입력하세요. ZIP 파일은 먼저 압축을 푼 뒤 폴더를 선택하면 됩니다. 게임 폴더 최상위에 게임용 index.html이 있어야 해요. 제출한 작품은 운영자 승인 후 공개됩니다.</p><form className="settings-card creator-form" onSubmit={submit}><label>작품 제목<input name="title" required maxLength={100}/></label><label>고유 슬러그<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} placeholder="my-game"/></label><label>카테고리<select name="category">{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>버전<input name="version" defaultValue="1.0.0" required/></label><label>작품 설명<textarea name="description" required maxLength={10000}/></label><label>게임 폴더 선택 (HTML5)<input name="game_files" type="file" multiple ref={input=>input?.setAttribute('webkitdirectory','')} onChange={event=>{const files=Array.from(event.currentTarget.files||[]);setSelectedCount(files.length);setSelectedSize(files.reduce((sum,file)=>sum+file.size,0))}}/>{selectedCount>0&&<small>{selectedCount}개 파일 · {(selectedSize/1024/1024).toFixed(1)}MB 선택됨 (최대 500개, 전체 200MB)</small>}<span className="upload-help">버튼을 눌러 게임이 들어 있는 폴더를 고르세요. index.html 파일 하나만 선택하지 마세요.</span></label><label>또는 외부 브라우저 실행 URL (HTTPS)<input name="launch_url" type="url" placeholder="https://games.example.com/my-game/"/></label><p className="upload-note">파일당 50MB, 전체 200MB까지 지원해요. 업로드가 시작되면 완료된 파일 수가 표시됩니다.</p><button className="button primary" disabled={busy}>{busy?'처리 중…':'검토 요청 제출'}</button>{message&&<p className={message.includes('완료하지 못했습니다')?'form-error':'form-success'} role="status">{message}</p>}</form></div>
}
function MySubmissions({ownerId}:{ownerId:string}){const [items,setItems]=useState<Project[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{let live=true;void supabase!.from('projects').select('id,owner_id,slug,title,description,category,version,visibility,moderation_status,cover_url,created_at').eq('owner_id',ownerId).order('updated_at',{ascending:false}).then(({data,error:e})=>{if(!live)return;setItems((data||[]) as Project[]);setError(e?.message||'');setLoading(false)});return()=>{live=false}},[ownerId]);return <section className="submission-panel"><h2>내 작품 상태</h2>{loading?<p className="muted">작품을 불러오는 중…</p>:error?<p className="form-error">{error}</p>:items.length?<div className="activity-list">{items.map(p=><div className="activity-row" key={p.id}><span className="avatar"><Gamepad2 size={16}/></span><span><b>{p.title}</b><small>{p.category} · v{p.version} · {new Date(p.created_at).toLocaleDateString('ko-KR')}</small></span><span className={`status-pill status-${p.moderation_status}`}>{projectStatusLabel(p.moderation_status)}</span>{p.moderation_status==='published'&&<Link to={`/project/${p.slug}`} aria-label={`${p.title} 보기`}><ArrowRight size={16}/></Link>}</div>)}</div>:<p className="muted">아직 제출한 작품이 없습니다. 첫 게임을 올려보세요.</p>}</section>}

function projectStatusLabel(status:string){return ({draft:'초안',review:'검토 중',published:'공개',suspended:'비공개/정지',pending_deletion:'삭제 대기'} as Record<string,string>)[status]||status}

function AdminCore({reload}:{reload:()=>Promise<void>}){const [busy,setBusy]=useState(''),[projects,setProjects]=useState<Project[]>([]),[members,setMembers]=useState<any[]>([]);const load=async()=>{const [p,u]=await Promise.all([supabase!.from('projects').select('id,owner_id,slug,title,description,category,version,visibility,moderation_status,cover_url,created_at').in('moderation_status',['review','published','suspended']).order('created_at',{ascending:false}),supabase!.from('profiles').select('id,username,display_name,role,account_status,created_at').order('created_at',{ascending:false}).limit(100)]);setProjects((p.data||[]) as Project[]);setMembers(u.data||[])};useEffect(()=>{void load()},[]);async function act(action:string,id:string,status:string,label:string){if(!confirm(`${label} 처리할까요?`))return;setBusy(id);const {error}=await supabase!.functions.invoke('admin-action',{body:{action,project_id:action==='set_project_status'?id:undefined,target_user_id:action==='set_account_status'?id:undefined,status}});if(error)alert(error.message);else await reload();await load();setBusy('')}return <div className="page-wrap"><div className="eyebrow muted">ADMIN CONSOLE</div><h1>운영 대시보드</h1><h2>작품 검토</h2><p className="muted">승인 작품은 공개됩니다. 정지하면 새 공개 조회가 차단됩니다.</p><div className="admin-table">{projects.length?projects.map(p=><div className="admin-row" key={p.id}><div><b>{p.title}</b><small>{p.slug} · {p.category} · {p.moderation_status}</small></div><button disabled={busy===p.id} className="button" onClick={()=>void act('set_project_status',p.id,p.moderation_status==='published'?'suspended':'published',p.moderation_status==='published'?'비공개':'공개')}>{p.moderation_status==='published'?'비공개 처리':'공개 승인'}</button></div>):<div className="empty">검토할 작품이 없습니다.</div>}</div><h2 className="admin-heading">회원 관리 <small>최대 최근 100명 · 이메일은 표시하지 않습니다</small></h2><div className="admin-table">{members.length?members.map(u=><div className="admin-row" key={u.id}><div><b>{u.display_name} <span className="member-handle">@{u.username}</span></b><small>{u.id} · {u.role} · {u.account_status} · {new Date(u.created_at).toLocaleDateString('ko-KR')}</small></div>{u.role!=='admin'&&<button disabled={busy===u.id} className="button" onClick={()=>void act('set_account_status',u.id,u.account_status==='suspended'?'active':'suspended',u.account_status==='suspended'?'정지 해제':'계정 정지')}>{u.account_status==='suspended'?'정지 해제':'계정 정지'}</button>}</div>):<div className="empty">회원이 없습니다.</div>}</div><p className="note">계정 정지는 Auth의 신규 로그인/토큰 갱신을 막고 RLS의 활성 상태 검사로 보호된 데이터 요청을 차단합니다. 이미 발행된 JWT는 만료 전까지 보호된 데이터베이스 접근에서 상태를 확인해야 합니다.</p></div>}
function AdminDashboard({reload}:{reload:()=>Promise<void>}){const [reports,setReports]=useState<any[]>([]),[logs,setLogs]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');async function load(){const [r,l]=await Promise.all([supabase!.from('reports').select('id,reason,status,created_at,project_id,projects(title,slug)').in('status',['open','reviewing']).order('created_at',{ascending:true}).limit(100),supabase!.from('admin_audit_logs').select('id,action,target_user_id,result,created_at,details').order('created_at',{ascending:false}).limit(100)]);if(r.error||l.error)setError(r.error?.message||l.error?.message||'관리 정보를 불러오지 못했습니다.');setReports(r.data||[]);setLogs(l.data||[])}useEffect(()=>{void load()},[]);async function resolve(id:string,status:'resolved'|'dismissed'){if(!confirm(status==='resolved'?'이 신고를 해결 처리할까요?':'이 신고를 기각 처리할까요?'))return;setBusy(id);const {error:e}=await supabase!.functions.invoke('admin-action',{body:{action:'resolve_report',report_id:id,status}});if(e)setError(e.message);else{await load();await reload()}setBusy('')}return <><AdminCore reload={reload}/><h2 className="admin-heading">신고 검토 <small>처리 중인 신고만 표시 · 개인 이메일은 노출하지 않습니다</small></h2>{error&&<p className="form-error">{error}</p>}<div className="admin-table">{reports.length?reports.map(r=><div className="admin-row report-row" key={r.id}><div><b>{r.projects?.title||'삭제된 작품'} <span className="member-handle">{r.status}</span></b><small>{r.reason}</small><small>{new Date(r.created_at).toLocaleString('ko-KR')} · 신고 ID {r.id}</small></div><div className="row-actions"><button className="button" disabled={busy===r.id} onClick={()=>void resolve(r.id,'resolved')}>해결</button><button className="button" disabled={busy===r.id} onClick={()=>void resolve(r.id,'dismissed')}>기각</button></div></div>):<div className="empty">열린 신고가 없습니다.</div>}</div><h2 className="admin-heading">최근 관리자 작업 <small>최대 100개 · 감사 로그는 일반 회원에게 공개되지 않습니다</small></h2><div className="admin-table">{logs.length?logs.map(log=><div className="admin-row" key={log.id}><div><b>{log.action} · {log.result}</b><small>{new Date(log.created_at).toLocaleString('ko-KR')} · 대상 {log.target_user_id||'없음'} · {JSON.stringify(log.details||{})}</small></div></div>):<div className="empty">관리자 작업 로그가 없습니다.</div>}</div></>}

function PlayHistory(){const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{let live=true;void supabase?.from('play_history').select('id,played_at,duration_seconds,projects(title,slug,category,version,cover_url)').order('played_at',{ascending:false}).limit(50).then(({data,error:e})=>{if(!live)return;setRows(data||[]);setError(e?.message||'');setLoading(false)});return()=>{live=false}},[]);return <div className="page-wrap"><div className="eyebrow muted">YOUR ACTIVITY</div><h1>최근 플레이</h1>{loading?<div className="loading">플레이 기록을 불러오는 중…</div>:error?<p className="form-error">{error}</p>:rows.length?<div className="activity-list">{rows.map(row=>row.projects&&<Link className="activity-row" key={row.id} to={`/project/${row.projects.slug}`}><span className="avatar"><History size={16}/></span><span><b>{row.projects.title}</b><small>{row.projects.category} · {new Date(row.played_at).toLocaleString('ko-KR')}</small></span><ArrowRight size={16}/></Link>)}</div>:<div className="empty"><History/><h2>아직 플레이 기록이 없습니다</h2><p>게임을 실행하면 최근 기록이 여기에 저장됩니다.</p></div>}</div>}

function CreatorProfile(){const {username=''}=useParams(),[creator,setCreator]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{let live=true;setLoading(true);void supabase?.rpc('get_public_creator',{p_username:username}).maybeSingle().then(async({data,error:e})=>{if(!live)return;if(e){setError('제작자 프로필을 불러오지 못했습니다. SQL 마이그레이션 004 적용 여부를 확인해 주세요.');setLoading(false);return}if(data){const c=data as any;setCreator(c);const {data:owned}=await supabase!.from('projects').select('id,owner_id,slug,title,description,category,version,visibility,moderation_status,cover_url,created_at').eq('owner_id',c.id).eq('visibility','public').eq('moderation_status','published').order('created_at',{ascending:false});if(live&&owned)setCreator((current:any)=>({...current,projects:owned}))}setLoading(false)});return()=>{live=false}},[username]);if(loading)return <div className="loading">제작자 정보를 불러오는 중…</div>;if(error)return <div className="empty">{error}</div>;if(!creator)return <div className="empty"><h2>제작자를 찾을 수 없습니다</h2></div>;const works=(creator.projects||[]) as Project[];return <div className="page-wrap"><div className="creator-hero"><span className="avatar creator-avatar"><UserRound/></span><div><div className="eyebrow muted">CREATOR PROFILE</div><h1>{creator.display_name}</h1><p>@{creator.username} · 공개 작품 {creator.published_projects}개 · 플레이 {creator.play_count}회</p></div></div><h2>공개 작품</h2>{works.length?<div className="game-grid">{works.map((p,i)=><ProjectCard key={p.id} p={p} i={i} favored={false} onFavorite={()=>{}}/>)}</div>:<div className="empty">아직 공개된 작품이 없습니다.</div>}</div>}

function Policy({title}:{title:string}){return <div className="page-wrap policy"><div className="eyebrow muted">PLAYGROUND</div><h1>{title}</h1><p>이 문서는 서비스 운영자가 실제 사업자 정보, 시행일, 처리 목적과 보유 기간을 검토해 확정해야 하는 초안입니다. 게시 전에 법률 및 개인정보 보호 요건에 맞춰 내용을 완성하세요.</p><h2>서비스 이용</h2><p>회원은 계정을 안전하게 관리하고, 권리를 보유하거나 게시 허가를 받은 콘텐츠만 등록해야 합니다. 운영자는 신고된 콘텐츠를 검토하고 정책 위반 콘텐츠의 노출을 제한할 수 있습니다.</p><h2>개인정보 처리</h2><p>계정 인증은 Supabase Auth가 처리합니다. 플랫폼은 아이디, 닉네임, 작품 활동에 필요한 최소 정보를 저장합니다. 구체적인 보유 기간과 문의처는 운영자가 정식 운영 전에 기입해야 합니다.</p></div>}
export default App;
