# AI 에이전트 작업 가이드

이 지침은 `luck` 프로젝트 전체에 적용한다. 작업 전에 [README.md](./README.md), [개발 가이드](./doc/GUIDE.md), [실행순서](./doc/IMPLEMENTATION_PLAN.md)를 확인하고, 사용자의 최신 요청과 기존 변경 내용을 반영한다.

## 사용 기술

- HTML5, CSS, 바닐라 JavaScript를 사용한다.
- JavaScript는 ES 모듈(`import` / `export`, `type="module"`)로 구성한다.
- korean-lunar-calendar 0.4.0 ESM 배포 파일과 MIT 라이선스를 `js/vendor/korean-lunar-calendar/`에 보관한다. npm 설치, 빌드 과정, 백엔드는 없다.
- React, Vue, TypeScript 등으로 임의 전환하지 않는다.
- 라이브러리나 빌드 도구를 도입할 때는 기존 기술 방향과 요구사항에 맞는지 확인하고 필요 이유와 실행 방법을 기록한다.
- 운영 중 외부 운세 API나 AI API 없이, 브라우저 계산과 저장된 해석 문구로 제공하는 것이 기본 방향이다.
- 배포 대상은 GitHub Pages이며 정적 호스팅 환경에서 동작하도록 구현한다.

## 파일과 페이지 구조

| 파일 | 역할 |
| --- | --- |
| `index.html` | 오늘의 운세 |
| `saju.html` | 사주팔자 |
| `personality.html` | 내 성향 |
| `lifetime.html` | 평생운세·연도별 세운 |
| `css/style.css` | 공통 디자인과 반응형 스타일 |
| `js/common.js` | 공통 출생 정보 입력·검증, 임시 보관, 날짜 표시 |
| `js/today.js` | 오늘의 운세와 실천 체크 |
| `js/saju.js` | 사주팔자 화면 출력 |
| `js/personality.js` | 내 성향 화면 출력 |
| `js/lifetime.js`, `js/lifetime-interpreter.js` | 평생운세 표시·조회 시각에 따른 구간 선택 |
| `js/content/lifetime.js` | 오행별 인생 경향·천간 십성별 연도 해석 |
| `js/render.js` | 공통 해석 카드 출력 |
| `js/content/interpretations.js` | 일간별 해석·날짜별 주제·용어 설명 콘텐츠 |
| `js/interpreter.js` | 계산 특징·날짜와 저장된 문구를 연결하는 순수 함수 |

- 메뉴별 HTML 분리를 유지하고, 메뉴 이동은 상대 경로 링크로 연결한다.
- 모든 메뉴를 한 HTML에 합쳐 해시(`#`)로 전환하는 방식으로 되돌리지 않는다. 본문 이동용 앵커는 사용할 수 있다.
- 공통 동작은 `common.js`, 메뉴별 동작은 해당 페이지 스크립트에 둔다.
- 각 스크립트가 자신의 페이지에 존재하는 DOM 요소만 사용하도록 한다.
- 상단 메뉴·출생 정보·입력 대화상자는 각 HTML에 있으므로 공통 마크업을 변경하면 네 페이지에 일관되게 반영한다.
- 계산 기능과 해석 선택 기능은 화면 처리와 분리한다. 실제 사주 계산은 `js/saju-calculator.js`, 한국 음력 변환은 `js/calendar.js`를 사용한다. `common.js`의 `onBirthResult`로 입력 직후와 저장 정보 복원 후 계산 결과를 구독한다.
- GitHub Pages의 저장소 하위 경로를 고려해 `./css/style.css`, `./saju.html`처럼 상대 경로를 사용한다.

## 코드 작성 방식

- 파일은 UTF-8로 저장하고 한국어가 깨지지 않는지 확인한다.
- HTML은 태그 구조를 읽기 쉽게 줄바꿈하고 중첩에 맞춰 들여쓴다.
- CSS는 선택자별로 블록을 나누고, 속성은 한 줄에 하나씩 작성한다. 한 줄로 압축하지 않는다.
- JavaScript도 가독성을 유지하고, 동작이 다른 기능은 함수나 모듈로 분리한다.
- 기존 사용자의 디자인·문구·스타일 변경을 보존한다.
- 반복 UI는 공통 클래스를 조합한다. 버튼은 `.button` + 색상(`.button-dark`, `.button-soft`, `.button-lime`, `.button-outline`) + 형태(`.button-icon`, `.button-full`), 배지는 `.badge` + `.badge-mint`, 입력창은 `.form-input`, 카드는 `.card` + `.card-lime`, 대시보드 열 배치는 `.dashboard-grid`를 사용한다.
- 사용자가 입력한 값은 `textContent` 등 안전한 방식으로 표시한다.

## 디자인 기준

- 검정 상단 메뉴와 카드형 대시보드를 유지한다.
- 본문 최대 너비는 1200px이며, 상단 메뉴 내부도 같은 기준으로 정렬한다.
- 연한 회색 본문 배경, 흰색 카드, 라임색 주요 강조, 민트색 보조 강조를 사용한다.
- 좁은 화면에서는 너비를 줄이고, 모바일의 카드와 메뉴가 화면 밖으로 넘치지 않게 구성한다.
- 기존 글자 크기를 기준으로 작업한다. 사용자가 전체 글자 크기를 2px 높인 상태이므로 임의로 작은 크기로 되돌리지 않는다.
- 키보드 접근, 포커스 표시, 입력 레이블, 선택된 메뉴의 `aria-current`를 유지한다.

## 입력·저장·콘텐츠

- 공통 입력은 생년월일, 양력·음력, 윤달, 출생 시간 및 ‘시간 모름’이다.
- 이름 또는 별명은 선택 입력(최대 20자)이며 결과 제목에만 사용한다. 계산·해석에는 영향을 주지 않고 출생 정보와 함께 sessionStorage에 임시 보관한다. 기존 이름 없는 저장 데이터도 지원한다.
- 출생 정보는 `sessionStorage`의 `luck.birthProfile.v1` 키로 같은 탭의 이동·새로고침 시 복원한다.
- 저장 차단이나 잘못된 저장 데이터가 있어도 페이지 사용을 막지 않는다.
- 출생 정보를 서버로 전송하거나 `localStorage`에 영구 저장하는 기능은 현재 범위에 포함하지 않는다.
- 날짜 표시와 오늘의 운세 갱신 기준은 한국 시간(`Asia/Seoul`)을 사용한다.
- 세 메뉴는 실제 입력에 연결되어 있고 입력 전에는 개인별 결과를 만들지 않는다. 내 성향은 일간 10종 기반 자기 성찰 콘텐츠, 오늘의 운세는 날짜별 주제 8종과 실천 24종을 선택하는 생활 제안이다. `doc/INTERPRETATION_RULES.md`를 따르고 사건 예측·전문 용신 해석 등으로 과장하지 않는다. 오행 차트는 확정된 글자 개수이며 강약·용신 판단으로 단정하지 않는다.
- 양력·음력 모두 연·월·일 select를 사용한다. `js/date-picker.js`는 공통 선택 UI, `js/date-options.js`는 실제 달력과 범위에 따른 선택지를 담당한다. 저장은 기존 birthDate YYYY-MM-DD 형식을 유지한다. `js/calendar.js`에서 한국 음력 변환·윤달 검증을 수행하고 `js/profile.js`에서 환산 후 범위·미래 여부를 검사한다. 라이브러리의 간지 정보는 사주팔자로 직접 사용하지 않는다.
- 만세력 도입 시 라이선스, 지원 범위, 음력·윤달·절기·날짜 경계·시간 미상 처리를 확인하고 기준 사례로 검증한다.
- 해석은 재미와 자기 성찰을 위한 콘텐츠로 작성하고, 확정적 예측이나 불안을 유발하는 표현을 피한다.
- 1차 범위는 오늘의 운세·사주팔자·내 성향이다. 평생운세는 이후 확장한다.
- 평생운세 확장은 구현되어 있다. `doc/LIFETIME_GUIDE.md`를 따라 일간 기반 인생 경향과 입춘 기준 최대 5개 구간의 연도별 세운을 제공한다. 대운·시작 나이·순역·지지 합충은 포함하지 않는다. 성별 추가 입력 없이 천간 십성을 계산하며 생활 해석과 계산 사실을 구분한다.

## 실행·검증

프로젝트 루트에서 실행한다.

```powershell
python -m http.server 8000
```

`http://localhost:8000`에 접속한다. ES 모듈을 사용하므로 `file://`로 HTML을 직접 여는 방식으로 검증하지 않는다.

- 변경한 JavaScript의 문법은 Node.js가 있는 환경에서 아래처럼 확인할 수 있다.

```powershell
node --experimental-default-type=module --check js/common.js
```

- 변경 범위에 맞춰 세 페이지의 링크, 자산 경로, 메뉴 활성 상태, DOM 선택자, 공통 입력 복원을 확인한다.
- 브라우저 검수가 가능하면 모바일 배치, 입력 대화상자, 페이지 이동, 새로고침을 확인한다.
- 실제 계산을 구현할 때는 대표 사례와 경계 사례를 검증한다.
- 사주 후보 검증은 `doc/SAJU_VALIDATION.md`와 `tests/saju-candidates.test.mjs`, 실제 모듈 검증은 `tests/saju-calculator.test.mjs`를 참고한다. 앱 엔진은 `js/vendor/lunar-javascript/lunar.mjs`이며 UMD 포장만 ESM으로 변환했다. 원본 UTC+8 시각과 23시 시주를 그대로 쓰지 않는다. 고정 UTC+9·자정 일주·시간 미상 처리·절입 ±60초 불확실성 정책을 유지한다. 과거 전체 기간의 독립 정확성 검증은 완료되지 않았다.
- 확정된 입력·계산 정책은 `doc/CALCULATION_POLICY.md`를 따른다. 검증·정규화는 `js/profile.js`를 공통 사용한다. 달력 회귀 검증은 `node --experimental-default-type=module tests/calendar.test.mjs`로 실행한다.
- 검증하지 못한 항목을 완료했다고 기록하지 않는다.
- 구조나 실행 방법을 바꾸면 README.md와 GUIDE.md를 갱신하고, 실제 완료된 작업만 IMPLEMENTATION_PLAN.md에 반영한다.

1차 검수와 평생운세 확장까지 구현했다. 결과와 제한은 `doc/FIRST_REVIEW.md`, `doc/LIFETIME_GUIDE.md`를 참고한다. 콘텐츠 변경 시 interpreter·lifetime 테스트를 확인하고 입력·화면 변경 시 `tests/run-browser.py`로 로컬 Chrome 회귀 검수를 수행할 수 있다. 사용 중인 서버나 브라우저 프로필을 재사용하지 않는다.
