# PLAYGROUND — 인디 게임 허브

React + TypeScript + Vite 기반의 GitHub Pages 정적 프런트엔드와 Supabase Auth/PostgreSQL/RLS 연동 기반입니다. 정적 배포만으로 서버 비밀키를 숨길 수 없으므로 브라우저에는 Supabase URL과 publishable/anon key만 들어가며, 보호는 RLS와 Edge Function에서 처리합니다.

## 현재 구현

- 공개 작품 탐색, 검색, 카테고리 필터, 작품 상세
- Supabase Auth 회원가입(아이디/닉네임 분리), 이메일 인증 안내, 로그인/로그아웃, 재설정 메일, 비밀번호 변경
- 로그인 후 원래 페이지로 돌아가는 실행 경로, 이메일 인증 및 계정 상태 확인
- 즐겨찾기, 프로필 닉네임 변경
- 개발자 작품 초안 제출과 외부 HTTPS 게임 주소 연결
- 관리자 작품 공개/비공개 검토 및 회원 정지/해제 Edge Functions와 감사 로그
- 서버 측 game-launch 권한 검사와 플레이 접근 기록 (실행 URL은 공개 작품 빌드 정책에서 숨김)
- PostgreSQL 스키마, UNIQUE/CHECK 제약, 소유자/공개/운영자 RLS 정책
- GitHub Pages 배포 workflow 및 SPA용 404 fallback

## 아직 구현되지 않은 운영 기능

이 저장소는 운영 가능한 기반을 구성한 MVP이며, 첨부 명세 전체의 완성본은 아닙니다. Storage 직접 업로드와 파일 검증, 전체 회원 관리 화면, 신고 관리, 이벤트/감사 로그 조회 UI, 회원 탈퇴와 데이터 보존 실행, 플레이 기록 기록/조회, 빌드 바이러스 검사·콘텐츠 보안정책, 백업 스케줄과 복구 검증, CAPTCHA/추가 스팸 방지, 자동화 통합/E2E 테스트는 추가 작업이 필요합니다. 업로드 기능이 준비되기 전에는 대용량 게임 파일을 이 저장소나 앱에 업로드할 수 없습니다.

Supabase Auth에서 계정 정지 시 새 인증/갱신을 막고 앱 테이블 RLS에서 정지 계정 요청을 차단하도록 구성합니다. 이미 발급된 JWT 자체는 만료 전까지 stateless하게 유효할 수 있으므로, 민감한 서버 작업은 항상 계정 상태를 재검증하고 적절한 JWT 만료 시간을 설정해야 합니다.

이메일 템플릿/SMTP, 허용 redirect URL, RLS 배포, Edge Function secrets, 최초 admin 지정, 실제 이용약관/개인정보 문구 및 서비스 운영자 연락처는 Supabase/GitHub 대시보드에서 구성해야 합니다. 법률 문서는 현재 초안 안내입니다.

## 로컬 실행

```sh
cp .env.example .env.local
# .env.local에 Supabase Project URL과 Publishable key를 넣습니다.
npm install
npm run dev
```

`VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`는 `.env.local` 또는 셸 환경변수로 설정합니다. 값이 없으면 Supabase 호출은 꺼지고 설정 안내만 표시됩니다. 서비스 역할 키, DB 비밀번호, JWT secret은 절대로 `VITE_` 변수로 만들거나 프런트엔드에 넣지 마세요.

## Supabase 준비

1. Supabase 프로젝트를 만들고 Authentication > URL Configuration의 Site URL과 Redirect URLs에 로컬 주소 및 GitHub Pages URL을 등록합니다. 프로젝트 페이지는 `https://OWNER.github.io/REPOSITORY/` 형식입니다.
2. Authentication에서 이메일 확인을 활성화하고 실제 운영 이메일 발송에는 검증된 SMTP를 설정합니다.
3. SQL Editor 또는 Supabase CLI로 `supabase/migrations/202610220001_initial_schema.sql`을 적용합니다.
4. Supabase CLI로 Edge Function을 배포합니다:
   ```sh
   supabase functions deploy admin-action
   supabase functions deploy game-launch
   ```
   Supabase에서 제공하는 함수 secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 확인합니다. service role key를 클라이언트 환경에 복사하지 않습니다.
5. 신뢰할 수 있는 초기 운영자 한 명을 Auth 가입 완료 후 SQL Editor에서 역할 승격합니다: `update public.profiles set role='admin' where username='YOUR_USERNAME';` 운영 DB에서만 신원을 별도로 확인한 후 실행합니다.
6. Supabase Auth password policy와 rate limits를 검토하고, 이메일 링크 만료 및 JWT 만료 시간을 운영 요구에 맞게 정합니다.

## GitHub Pages 배포

1. 프로젝트 파일을 저장소 루트에 커밋합니다. 기본 workflow는 `main` 브랜치 push를 배포합니다.
2. Repository Settings > Secrets and variables > Actions > Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 추가합니다. 이 publishable/anon key는 공개 설정값이며 DB 접근은 RLS가 막아야 합니다. 비밀 자격 증명은 추가하지 않습니다.
3. Settings > Pages > Build and deployment에서 Source를 **GitHub Actions**로 선택합니다.
4. Workflow는 `/${repository-name}/` base 경로로 빌드하고, deep link 새로고침용 `404.html`을 생성합니다.
5. Supabase Auth의 허용 redirect URL에 `https://OWNER.github.io/REPOSITORY/account`를 추가합니다.

사용자/조직 사이트(`OWNER.github.io`)에 배포한다면 workflow의 `VITE_BASE_PATH` 값을 `/`로 바꾸세요.

## 기본 검증

```sh
npm test
npm run build
```

## 보안/게임 호스팅 메모

회원 제작 코드를 같은 origin에서 실행하지 마세요. 별도의 신뢰 구역(별도 게임 호스트 도메인/계정)에서 HTTPS로 제공하고, 필요에 따라 CSP 및 업로드 검사를 더해야 합니다. 실행 iframe은 `allow-scripts`, `allow-forms`, `allow-pointer-lock`만 허용하고 `allow-same-origin`이나 top navigation 권한은 주지 않습니다. 게임 호스트의 iframe 정책도 해당 페이지를 허용해야 합니다. 현재 제출 폼은 외부 HTTPS URL만 받으며 URL 소유/안전성을 자동 증명하지 않습니다. `game-launch`는 로그인, 이메일 인증, 활성 계정, 공개/승인 상태를 서버에서 확인하고 실행 기록을 남긴 뒤 주소를 돌려줍니다. 다만 외부의 공개 정적 게임 URL 자체를 플랫폼이 보호할 수는 없습니다. 실제 파일 접근 제한이 필요하면 private Storage와 짧은 만료의 signed URL 또는 게임 호스트 자체의 인증 검증을 추가해야 합니다. 운영 검토 과정에서 URL 소유와 iframe 허용 정책을 확인해야 합니다.

## 데이터 모델

`profiles`, `projects`, `project_builds`, `favorites`, `play_history`, `reports`, `security_events`, `admin_audit_logs`를 구성합니다. 회원이 역할/계정 상태를 직접 바꿀 수 없고, 공개 작품 조건, 소유자 편집, 계정 활성 상태에 따른 접근 규칙을 RLS로 적용합니다. 관리자 Edge Function은 호출 JWT/이메일 인증/DB 역할/계정 상태와 입력을 재검증한 뒤 관리 작업과 감사 로그를 처리합니다.
