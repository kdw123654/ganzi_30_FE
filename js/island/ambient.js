// 살아 있는 섬 연출
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

// ── 살아 있는 섬: 시간대별 빛, 구름 그림자, 강물 반짝임, 모닥불 빛, 새·꽃잎·반딧불이 ──
// (초기화 코드가 이 파일 중간에서 먼저 실행되므로 값은 함수 안에 둔다)
function setupAmbient() {
  const world = el("world");
  if (!world || el("ambient")) return;
  // 강물 위 자리(지도 이미지 기준 %). 이미지에서 물 색 픽셀을 뽑아 정했다
  const RIVER_POINTS = [
    [66, 6], [65, 11], [67, 15], [71, 19], [75, 23], [72, 31], [67, 36], [70, 42],
    [73, 46], [76, 50], [71, 54], [64, 58], [61, 63], [56, 68], [46, 69], [39, 72],
    [31, 79], [24, 83], [15, 86], [6, 90], [12, 9], [20, 10], [26, 13], [16, 16],
    [22, 19], [96, 95],
  ];
  // 같은 화면이 매번 같게 보이도록 고정된 난수
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const pick = (min, max) => (min + rand() * (max - min)).toFixed(1);

  const sparkles = RIVER_POINTS.map(([x, y], i) =>
    `<i class="sparkle" style="left:${x}%;top:${y}%;animation-delay:${(i * 0.37) % 3.2}s"></i>`).join("");
  const fireflies = Array.from({ length: 16 }, (_, i) =>
    `<i class="firefly" style="left:${pick(8, 92)}%;top:${pick(15, 92)}%;animation-delay:${pick(0, 6)}s,${pick(0, 3)}s;--fx:${pick(-30, 30)}px;--fy:${pick(-26, 10)}px"></i>`).join("");
  const petals = Array.from({ length: 10 }, () =>
    `<i class="petal" style="left:${pick(0, 100)}%;animation-delay:${pick(0, 14)}s;animation-duration:${pick(11, 17)}s"></i>`).join("");
  const bird = `<svg viewBox="0 0 24 10"><path d="M1 6 Q6 0 12 6 Q18 0 23 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

  const layer = document.createElement("div");
  layer.id = "ambient";
  layer.className = "ambient";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <div class="light"></div>
    <div class="cloud-shadow one"></div>
    <div class="cloud-shadow two"></div>
    <div class="cloud-shadow three"></div>
    <div class="fire-glow" style="left:${campfirePoint.x}%;top:${campfirePoint.y}%"></div>
    ${sparkles}
    <div class="flock one">${bird}${bird}${bird}</div>
    <div class="flock two">${bird}${bird}</div>
    ${petals}
    ${fireflies}`;
  world.insertBefore(layer, el("markers"));
}
