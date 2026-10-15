# 오늘의 결

HTML·CSS·바닐라 JavaScript로 만든 운세 대시보드입니다. 검정 상단 메뉴, 최대 너비 1200px, 라임·민트 강조색을 사용합니다.

## 현재 구현 범위

- 오늘의 운세·사주팔자·내 성향 메뉴 전환
- 생년월일, 양력·음력, 윤달, 출생 시간·시간 모름 입력
- 이름 또는 별명 선택 입력(최대 20자), 메뉴별 결과 제목에 반영 및 같은 탭에서 복원
- 입력 정보 수정, 오늘의 실천 체크, 한국 시간 기준 날짜 표시
- 모바일 대응과 키보드 접근 가능한 입력 대화상자

**세 메뉴를 실제 입력과 저장된 해석 콘텐츠에 연결했습니다.** 사주팔자는 계산된 네 기둥·일간·오행 개수와 기본 설명, 내 성향은 일간 10종별 다섯 영역의 설명을 제공합니다. 오늘의 운세는 날짜와 출생 정보로 생활 조언을 선택하며 실제 사건의 길흉을 예측하지 않습니다. 입력 전에는 개인별 결과를 표시하지 않습니다. 양력·음력 변환은 korean-lunar-calendar 0.4.0, 사주 계산은 lunar-javascript 1.7.7에 한국 시간·자정 기준을 보정해 사용합니다. 시간 미상과 절입 경계의 불확실한 기둥은 제외합니다. 출생 정보는 서버로 전송하지 않고 sessionStorage에 임시 보관하며, 같은 탭에서 이동·새로고침하면 다시 계산합니다. 실천 체크는 현재 페이지의 입력·날짜·행동에만 적용됩니다.

## 로컬 실행

프로젝트 폴더에서 아래 명령을 실행하고 `http://localhost:8000`에 접속합니다.

```powershell
python -m http.server 8000
```

ES 모듈을 사용하므로 HTML 파일을 직접 여는 대신 개발 서버로 실행합니다. 별도 npm 패키지 설치나 빌드가 필요하지 않습니다.

## GitHub Pages

파일을 GitHub 저장소에 올린 후 Settings → Pages에서 배포할 브랜치와 `/(root)`를 선택합니다. 루트의 `index.html`이 진입점이며 자산은 상대 경로를 사용합니다. 이 작업에서는 실제 게시를 수행하지 않았습니다.

## 파일 구성

- `index.html`: 오늘의 운세
- `saju.html`: 사주팔자
- `personality.html`: 내 성향
- `css/style.css`: 디자인과 반응형 레이아웃
  - 공통 UI: `button`과 색상·형태 변형, `badge`, `form-input`, `card`, `dashboard-grid`
- `js/common.js`: 공통 출생 정보 입력·검증, 임시 저장, 날짜 표시
- `js/profile.js`: 공통 입력 정책·정규화·양력 날짜 검증·한국 날짜 키
- `js/calendar.js`: 음력·양력 변환 어댑터
- `js/saju-calculator.js`: 실제 사주 계산·일간·오행 개수·불확실성 공통 결과
- `js/vendor/lunar-javascript/`: MIT 고지와 ESM 엔진(UMD 포장만 변환)
- `js/date-picker.js`, `js/date-options.js`: 공통 연·월·일 선택 UI와 달력별 유효 날짜 선택지
- `js/vendor/korean-lunar-calendar/`: 버전 고정 배포 파일·라이선스·출처
- `tests/calendar.test.mjs`: 날짜 변환·유효성·범위·회귀 검증
- `js/today.js`: 오늘의 운세 화면과 실천 체크
- `js/saju.js`: 사주팔자 화면
- `js/personality.js`: 내 성향 화면
- `js/render.js`: 공통 해석 카드 출력
- `js/content/interpretations.js`: 일간 10종·주제 8종·실천 팁 24종과 기본 설명
- `js/interpreter.js`: 사주 특징과 날짜에 따른 해석 선택
- [개발 가이드](./doc/GUIDE.md)
- [실행순서](./doc/IMPLEMENTATION_PLAN.md)
- [입력·계산 기준](./doc/CALCULATION_POLICY.md)
- [해석 선택 규칙](./doc/INTERPRETATION_RULES.md)
- [1차 검수 결과](./doc/FIRST_REVIEW.md): 발견 사항·수정·테스트·화면 자료·남은 제한
- [사주 후보 검증 결과](./doc/SAJU_VALIDATION.md): 무료 후보 비교, 보정 방식, 테스트 결과와 제한사항

양력 환산 기준 1900년부터 오늘까지 지원하며, 달력 라이브러리 상한은 2050-12-31입니다. 음력 입력 연도는 1900년부터 허용합니다. 출생 시각은 고정 UTC+9이며 과거 표준시·서머타임·태양시 보정은 하지 않습니다. 과거 절기 전체의 독립 정확성 검증은 남아 있습니다. 성향 콘텐츠는 자기 성찰용 초안이며 전문 사주 감수를 마친 것은 아닙니다.

달력 검증 실행:

```powershell
node --experimental-default-type=module tests/calendar.test.mjs
```

사주 후보 검증(사이트에 미연결인 검증용 어댑터):

```powershell
node --experimental-default-type=module tests/saju-candidates.test.mjs
```

실제 계산 모듈 검증:

```powershell
node --experimental-default-type=module tests/saju-calculator.test.mjs
```

해석 선택 검증:

```powershell
node --experimental-default-type=module tests/interpreter.test.mjs
```

로컬 Chrome 통합 검수(Windows, Python, Node 22 필요):

```powershell
python tests/run-browser.py
```

콘텐츠 1.1.0은 8개 주제별 3종의 상세 설명과 실천 팁을 제공하며, 동일 주제가 돌아오는 날에는 다른 설명을 선택합니다.
