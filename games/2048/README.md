# 2048

## 스택

- **빌드 방식**: 순수 HTML/CSS/JS (바닐라) — 빌드 도구 없음
- **게임 라이브러리**: 없음 (DOM 직접 제어)

## 학습 포인트

### 이동 알고리즘
"왼쪽 슬라이드" 하나만 구현하고, 나머지 방향은 행렬 변환(뒤집기·전치)으로 재활용한다.
Up/Down은 `transpose()` → 슬라이드 → `transpose()` 복원 순서로 처리하여 코드 중복을 제거.

### 입력 통합
Pointer Events(`pointerdown`/`pointerup`)를 사용해 마우스 드래그와 터치 스와이프를 단일 코드로 처리.
`board.setPointerCapture(e.pointerId)`로 보드 밖에서 손을 떼도 이벤트를 놓치지 않도록 처리.

### 다국어(i18n)
`lang/ko.json`, `lang/en.json`을 `fetch()`로 로드하고, `data-i18n` 속성으로 텍스트를 치환.
선택 언어는 `localStorage('lang')`에 저장해 다음 방문 시 유지.

### 점수 저장
`localStorage` 키를 `score:2048:best` 형식으로 지정. 프로젝트 공통 네이밍 규칙 준수.
