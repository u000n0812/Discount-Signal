# 시그널 (Signal)

내가 등록한 조건에 맞는 할인이 시작될 때만 알려주는 알림 앱.
개별 쇼핑몰 앱처럼 모든 프로모션을 쏟아내지 않고, 조건에 맞을 때만 울립니다.

- **스팀 게임** — 게임을 이름으로 검색해 등록하면 가격과 할인율을 지켜봐요.
- **브랜드 사이트** — 벨리에(`belier.co.kr`) 같은 주소를 등록하면 세일 시작을 지켜봐요.
- **조건** — 최소 할인율(%) 또는 목표가(원) 중 **하나만 충족해도** 알려줘요.
  둘 다 비우면 "할인이 시작되면" 알려줘요. 문장으로 조건을 덧붙일 수도 있어요("아우터만").
- 회원가입 없이 브라우저에 발급되는 익명 ID(`sg_uid` 쿠키)로 "내 관심사"만 구분해요.

## 로컬에서 실행하기

```bash
npm install
cp .env.example .env     # DATABASE_URL, GEMINI_API_KEY, CRON_SECRET
npm run db:migrate
npm run dev              # http://localhost:3000
```

- `DATABASE_URL`은 이 앱 전용 데이터베이스를 쓰세요.
- `GEMINI_API_KEY`는 없어도 동작해요. 없으면 브랜드 페이지 판정이 키워드 방식으로 물러납니다.

## 배포 (Vercel)

Vercel에서 **Add New → Project**로 이 저장소를 임포트하면 끝이에요. 브랜치나 Root Directory를
따로 만질 필요가 없어요. 임포트 화면에서 환경 변수 세 가지(`DATABASE_URL`, `CRON_SECRET`,
그리고 선택인 `GEMINI_API_KEY`)만 넣어주세요. Postgres는 Storage에서 새로 붙이면
`DATABASE_URL`이 자동으로 채워져요.

`vercel.json`에 1시간 주기 크론이 들어 있고, `CRON_SECRET`을 넣어야 `/api/cron`이 열려요
(없으면 503). Vercel Hobby 요금제는 크론 주기 제한이 있어 하루 1회로 줄여야 할 수 있어요.

## 데이터를 어디서 가져오는지

| 소스 | 방식 | 비고 |
| --- | --- | --- |
| 스팀 | `store.steampowered.com`의 `/api/storesearch`, `/api/appdetails` | 키 없이 쓰는 공개 엔드포인트. 문서화되지 않은 API라 IP당 5분에 200회 정도 제한이 있다고 알려져 있어요. 가격은 통화 최소 단위(×100)로 와서 100으로 나눠 씁니다. |
| 브랜드 사이트 | 페이지를 직접 읽어 텍스트로 변환 | `robots.txt`를 먼저 확인해 **수집이 금지된 경로는 읽지 않아요.** User-Agent도 `SignalDealWatcher/0.1`로 밝히고 다녀요. |

브랜드 사이트는 사이트마다 HTML이 달라 선택자를 하드코딩하지 않았어요. 본문 텍스트를
Gemini에게 읽혀 "지금 세일 중인지, 내 조건에 맞는지"를 판정합니다(`src/lib/match.ts`).
키가 없거나 호출이 실패하면 세일 키워드와 최대 할인율 숫자로 판정하는 방식으로 물러나요.

## 구조

```
src/lib/steam.ts    스팀 가격·검색
src/lib/web.ts      robots.txt 확인 + 페이지를 텍스트 스냅샷으로
src/lib/match.ts    조건 충족 판정 (스팀=규칙, 웹=Gemini 또는 키워드)
src/lib/check.ts    감시 한 바퀴 + 중복 알림 방지
src/app/api/*       관심사·알림·설정·확인·크론
src/components/*    화면 (관심사 / 피드 / 설정)
```

같은 세일로 두 번 알리지 않도록 마지막 상태(signature)를 기억하고, 세일이 끝나면 지워서
다음 세일은 다시 알립니다.

## 아직 안 되는 것

- 알림은 **앱 안 피드 + 탭이 열려 있을 때의 브라우저 알림**까지예요. 이메일·카카오톡은 아직이에요.
- 개발 환경에서 외부 접속이 막혀 있어 **실제 스팀 API와 belier.co.kr로는 검증하지 못했어요.**
  로컬에서 한 번 `지금 확인`을 눌러 판정이 맞는지 확인해주세요.

## 인스타그램 연동이 없는 이유

- Instagram Basic Display API는 2024년 12월 4일에 종료됐어요.
- 후속인 Instagram Graph API / Instagram Login API는 **계정 소유자가 권한을 준
  비즈니스·크리에이터 계정**만 읽을 수 있어요. 남의 브랜드 계정을 임의로 조회하는 공개
  엔드포인트나 해시태그 검색은 없어요.
- 그래서 브랜드 인스타 대신 **브랜드 웹사이트 감시**로 대체했어요. 인스타를 꼭 붙이려면
  브랜드에게 앱 권한을 받아야 하고, 비공식 스크래핑은 Meta 이용약관 위반이라 권하지 않아요.

## 기술 스택

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Prisma + Postgres
- `@google/genai` (`gemini-3.6-flash`) — 브랜드 페이지 판정에만 사용
- 디자인: 기획안 프로토타입의 팔레트·타이포(Sora / Public Sans / JetBrains Mono)를 그대로 옮김
