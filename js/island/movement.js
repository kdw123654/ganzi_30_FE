// 방향키(WASD) 캐릭터 이동
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

// ── 방향키(또는 WASD)로 내 캐릭터 이동 ──
const moveKeys = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};
const heldKeys = new Set();
let moveFrame = null;
// 지도 그림이 화면보다 넓어서, 캐릭터가 화면 밖으로 걸어가면 카메라(지도)가 따라가게 한다.
// 실제 동작은 지도 끌기 코드가 있는 곳에서 채운다 (dx·dy·positionMap이 그 안에 있음).
let followPlayer = () => {};
let lastMoveTime = 0;

const isTyping = (target) =>
  target?.closest?.("input, textarea, select, [contenteditable='true']");

function stepPlayer(time) {
  const dt = Math.min(50, time - (lastMoveTime || time));
  lastMoveTime = time;
  let mx = 0, my = 0;
  for (const key of heldKeys) {
    mx += moveKeys[key][0];
    my += moveKeys[key][1];
  }
  if (!mx && !my) {
    moveFrame = null;
    lastMoveTime = 0;
    save();
    const player = el("markers").querySelector(".player-marker");
    setTimeout(() => player?.classList.remove("keyboard"), 200);
    renderMarkers(); // 공명 이웃들도 새 자리 둘레로
    return;
  }
  const speed = 0.018 * dt; // 1초에 약 18%
  const length = Math.hypot(mx, my);
  state.player = {
    x: Number(clampPos(state.player.x + (mx / length) * speed, 4, 96).toFixed(2)),
    y: Number(clampPos(state.player.y + (my / length) * speed * 1.33, 7, 93).toFixed(2)),
  };
  const player = el("markers").querySelector(".player-marker");
  if (player) {
    player.classList.add("keyboard");
    player.classList.toggle("facing-left", mx < 0 || (mx === 0 && player.classList.contains("facing-left")));
    player.style.left = state.player.x + "%";
    player.style.top = state.player.y + "%";
  }
  followPlayer();
  moveFrame = requestAnimationFrame(stepPlayer);
}

document.addEventListener("keydown", (event) => {
  if (!moveKeys[event.key] || event.altKey || event.ctrlKey || event.metaKey) return;
  if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
  event.preventDefault();
  heldKeys.add(event.key);
  if (!moveFrame) moveFrame = requestAnimationFrame(stepPlayer);
});
document.addEventListener("keyup", (event) => heldKeys.delete(event.key));
window.addEventListener("blur", () => heldKeys.clear());
