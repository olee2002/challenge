# 100일 챌린지

React + Vite 기반의 팀 운동 챌린지 앱입니다. 각 멤버는 하루 체크와 메모를 기록하고, 팀 전체 진행률을 볼 수 있습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

## 실시간 공유 설정

이 앱은 Supabase를 사용해 여러 사용자가 같은 팀 데이터를 실시간으로 공유할 수 있습니다. 아래 값을 넣어 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 설정하세요.

```bash
cp .env.example .env
```

그 다음 `.env` 파일을 열고 실제 값으로 변경합니다.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase 테이블 생성

```sql
create table if not exists public.team_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

Supabase 대시보드에서 `team_state` 테이블의 Realtime 기능을 켜 주세요. 최종적으로 여러 브라우저 탭에서 한 명의 업데이트가 다른 사람에게 실시간으로 반영됩니다.

## 기능

- 100일 루틴 카드
- 각 날짜별 체크 상태 및 메모 저장
- 참가자별 진행률
- 팀 전체 진행률
- 참가자 추가/삭제
- 실시간 공유 지원
