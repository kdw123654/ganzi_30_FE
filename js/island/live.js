// 공명 · 실시간 접속 · 섬 온도(모닥불)
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

// ── 기능 1. 공명: 내 최근 고민과 비슷한 고민을 쓴 이웃이 다가옴 ──
async function loadResonance() {
  const mine = serverNeighbors.find(neighbor => neighbor.is_me);
  const postId = mine?.latest_post?.id;
  if (!postId) return;
  try {
    if (!similarCache.has(postId)) {
      similarCache.set(postId, await api(`/posts/${postId}/similar`));
    }
    const onIsland = new Set(serverNeighbors.map(n => n.author.user_id));
    const next = new Map();
    const bestPost = new Map();
    for (const item of similarCache.get(postId)) {
      const id = item.author?.user_id;
      if (!id || id === me.id || !onIsland.has(id)) continue;
      if (item.similarity > (next.get(id) || 0)) bestPost.set(id, item.id);
      next.set(id, Math.max(next.get(id) || 0, item.similarity));
    }
    resonancePosts = bestPost;
    // 가장 비슷한 이웃 4명까지만
    resonance = new Map(
      [...next].sort((a, b) => b[1] - a[1]).slice(0, 4),
    );
    renderMarkers();
  } catch (error) {
    console.error(error.message);
  }
}

// ── 실시간 접속: 몇 초마다 내 위치를 보내고 이웃 위치를 받음 ──
async function presenceTick() {
  if (!presenceEnabled || document.hidden || !Number.isInteger(islandId)) return;
  try {
    const list = await api(`/islands/${islandId}/presence`, {
      method: "POST",
      body: { x: state.player.x, y: state.player.y },
    });
    onlineNeighbors = new Map(list.map(p => [p.author.user_id, p]));
    updateIslandCounts();
    renderMarkers();
  } catch (error) {
    // 실시간 접속을 모르는 이전 서버면 조용히 끔
    if (error.status === 404 || error.status === 405) presenceEnabled = false;
  }
}

// ── 기능 4. 섬 온도: 고민과 위로 댓글이 쌓이면 모닥불이 뜨거워짐 ──
const weatherText = {
  cold: "쌀쌀한 섬이에요. 첫 위로를 건네 볼까요?",
  mild: "섬이 조금씩 따뜻해지고 있어요.",
  warm: "이웃들의 위로로 섬이 따뜻해요.",
  hot: "ON-DO 36.5° 달성! 섬이 사람 체온만큼 따뜻해요.",
};
let lastTempLevel = null;
async function loadTemperature() {
  if (!Number.isInteger(islandId)) return;
  try {
    const next = await api(`/islands/${islandId}/temperature`);
    const rose = islandTemp && next.temperature > islandTemp.temperature;
    islandTemp = next;
    el("map").dataset.weather = next.level;
    renderMarkers();
    if (rose) {
      const fire = el("markers").querySelector(".campfire");
      fire?.classList.add("flare");
      setTimeout(() => fire?.classList.remove("flare"), 1600);
    }
    if (lastTempLevel && lastTempLevel !== next.level) toast(weatherText[next.level]);
    lastTempLevel = next.level;
  } catch (error) {
    if (error.status === 404) islandTemp = null; // 이전 서버
  }
}

function showCampfireInfo() {
  if (!islandTemp) return;
  toast(
    `섬 온도 ${islandTemp.temperature}° · 최근 ${islandTemp.days}일 고민 ${islandTemp.posts}개, 위로 ${islandTemp.comments}개. ${weatherText[islandTemp.level]}`,
  );
}
