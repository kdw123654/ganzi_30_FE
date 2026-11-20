// 지도: 이웃 배치 · 마커 · 이름표/칭호 배지 · 검색 필터 · 처음 안내
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

// ───────── 지도: 이웃 배치 · 실시간 접속 · 공명 · 모닥불 · 방향키 ─────────
const clusterPoint = { x: 31, y: 57 };
const MAX_ZOOM = 2; // 지도 확대는 100~200%: 더 키우면 캐릭터·말풍선이 깨지고 길을 잃기 쉬움
const revealZoom = 0; // 이웃을 숫자로 묶지 않고 항상 각자 자리에 보여 줌
const campfirePoint = { x: 50, y: 44 }; // 섬 중앙 광장
// 섬 온도별 모닥불 그림 (피그마): 차가움·보통은 작은 불, 따뜻함은 중간 불, 뜨거움은 큰 불 + 불씨
const campfireSize = { cold: "s", mild: "s", warm: "m", hot: "l" };
// 강·호수·집을 피한 풀밭 자리(%). 글 위치가 없는 이웃은 이 중 한 곳에 선다
const SPOTS = [
  [12, 27], [25, 25], [36, 20], [40, 29], [55, 25], [63, 29], [45, 8], [55, 10],
  [30, 32], [12, 45], [28, 50], [35, 44], [40, 56], [45, 62], [56, 55], [66, 48],
  [82, 38], [86, 50], [78, 58], [85, 66], [75, 68], [60, 80], [45, 86], [30, 60],
  [22, 75], [40, 82], [65, 88], [8, 58], [80, 24], [88, 76],
];
const islandId = Number(
  new URLSearchParams(location.search).get('island_id')
);

let serverNeighbors = [];
let onlineNeighbors = new Map(); // user_id → { author, x, y } 지금 접속 중인 이웃
let resonance = new Map(); // user_id → similarity 내 고민과 공명하는 이웃
let resonancePosts = new Map(); // user_id → 그 이웃의 고민 중 내 고민과 가장 닮은 글 id ('🔥 공명'을 누르면 엶)
let presenceEnabled = true;
let islandTemp = null;
// 검색(내 고민과 닮은 이야기 찾기) 중이면: user_id → 그 이웃의 닮은 고민. 지도에는 이 이웃들만 보여 줌 (null = 모두)
let searchMatch = null;
let searchMatchQuery = "";

const shortTitle = (title, max = 14) =>
  title.length > max ? title.slice(0, max) + "…" : title;
const clampPos = (value, min, max) => Math.max(min, Math.min(max, value));

// 글 위치가 없을 때 쓰는 자리: 같은 사람은 항상 같은 자리
function spotFor(userId) {
  const [x, y] = SPOTS[userId % SPOTS.length];
  const ring = Math.floor(userId / SPOTS.length) % 4; // 자리가 겹치면 살짝 비켜 섬
  return { x: x + ring * 2.2, y: y + ring * 1.6 };
}
// 말풍선이 섬 가장자리 밖으로 잘리지 않게 안쪽으로 당김
const insideIsland = ({ x, y }) => ({ x: clampPos(x, 9, 91), y: clampPos(y, 10, 92) });
const postSpot = (neighbor) =>
  insideIsland(
    neighbor.latest_post?.map_x != null
      ? { x: neighbor.latest_post.map_x, y: neighbor.latest_post.map_y }
      : spotFor(neighbor.author.user_id),
  );

async function loadNeighbors() {
  try {
    if (!Number.isInteger(islandId) || islandId <= 0) {
      throw new Error('섬 선택 화면에서 다시 입장해주세요.');
    }

    const firstLoad = !serverNeighbors.length;
    serverNeighbors = await api(`/islands/${islandId}/neighbors`);
    updateIslandCounts();
    renderSearchNote();
    renderMarkers();
    if (firstLoad) followPlayer(); // 처음 들어오면 내 캐릭터가 보이는 곳에서 시작 (좁은 휴대폰 화면)
    loadResonance();
  } catch (error) {
    toast(error.message);
  }
}

function updateIslandCounts() {
  const online = onlineNeighbors.size;
  document.querySelectorAll(".island-counts").forEach(element => {
    // 항목마다 span으로 나눠, 좁은 화면에서는 항목 단위로 줄을 바꾼다 (말줄임으로 잘리지 않게)
    const items = [`총 이웃 ${Number(serverNeighbors.length)}명`];
    element.innerHTML = items.map(text => `<span>${escapeText(text)}</span>`).join("");
    element.title = online
      ? `공개 글을 작성한 이웃 · 지금 접속 ${Number(online) + 1}명`
      : "공개 글을 작성한 이웃";
  });
}

// 활동 칭호 배지. 등급(1 새싹 · 2 따뜻한 · 3 빛나는 · 4 전설)마다 모양이 달라지고, 3등급부터 반짝임
// 성격 배지: 이모지 없이 이름만 (api.js의 PERSONAS 라벨을 그대로 씀)
const personaChip = (character) => {
  const key = personaKeyOf(character);
  return key ? `<span class="persona-badge persona-${key}">${escapeText(PERSONAS[key].label)}</span>` : "";
};

// 칭호 아이콘 그림(assets/titles/키.png). 그림이 없는 칭호(섬의 등불·섬의 등대)는 서버가 준 이모지를 씀
const TITLE_ICON_KEYS = new Set([
  "first_post", "sprout", "traveler", "kind", "heart_rich", "honest",
  "storyteller", "first_comfort", "guide", "campfire", "shining",
]);
const titleIcon = (title, cls = "title-badge-icon") =>
  TITLE_ICON_KEYS.has(title?.key)
    ? `<img class="${cls}" src="assets/titles/${title.key}.png" alt="" aria-hidden="true">`
    : `<span class="${cls} is-emoji" aria-hidden="true">${escapeText(title?.icon || "")}</span>`;

// compact(지도 이름표): 아이콘만. 그 외(글 목록·댓글·글 상세·칭호 도감): 아이콘 + 칭호 이름 글자
const titleBadge = (title, { compact = false } = {}) =>
  title
    ? `<span class="title-badge tier-${Number(title.tier)}${compact ? " compact" : ""}" title="${escapeText(title.name)} · ${escapeText(title.tier_name)} 칭호 · ${escapeText(title.desc)}">${titleIcon(title)}${compact ? `<span class="sr-only">${escapeText(title.name)}</span>` : `<span class="title-badge-name">${escapeText(title.name)}</span>`}</span>`
    : "";

// 실시간 접속 정보에는 칭호가 없으니, 이웃 목록에서 같은 사람의 칭호를 찾아 씀
const titleOf = (author) =>
  author?.title || serverNeighbors.find((n) => n.author.user_id === author?.user_id)?.author.title || null;

// 이름표: 페르소나 아이콘 + 닉네임 (+ 접속 중 점) + 빛나는 칭호 아이콘(3등급 이상)
const nameTag = (author, cls, online = false) => {
  const title = titleOf(author);
  return `
  <span class="${cls}">
    ${online ? '<i class="online-dot" aria-label="접속 중"></i>' : ""}${escapeText(personaOf(author.character)?.icon || "")} ${escapeText(author.nickname)}${title && title.tier >= 3 ? " " + titleBadge(title, { compact: true }) : ""}
  </span>`;
};

const characterImg = (author, alt = "") => `
  <img class="${toneClass(author.color)}"
    src="${img(CHARACTER_KEYS.indexOf(author.character))}" alt="${alt}">`;

// 검색 결과 → 지도 필터. 같은 이웃의 글이 여러 개면 가장 닮은(앞쪽) 글 하나를 말풍선으로
function setSearchMatch(posts, query = "") {
  const next = posts
    ? new Map(posts.filter(p => p.author?.user_id && p.author.user_id !== me.id).reverse()
        .map(p => [p.author.user_id, p]))
    : null;
  searchMatch = next;
  searchMatchQuery = next ? query : "";
  renderSearchNote();
  renderMarkers();
}

// 지도 위 안내: "'퇴사'와 닮은 고민을 쓴 이웃 N명만 보여요 · 모두 보기"
function renderSearchNote() {
  let note = el("searchMapNote");
  if (!searchMatch) {
    note?.remove();
    return;
  }
  if (!note) {
    note = document.createElement("div");
    note.id = "searchMapNote";
    note.className = "search-map-note";
    note.setAttribute("role", "status");
    el("map").append(note);
  }
  const shown = serverNeighbors.filter(n => !n.is_me && searchMatch.has(n.author.user_id)).length;
  const word = shortTitle(searchMatchQuery, 12);
  note.innerHTML = `
    <span>🔍 <b>${escapeText(word)}</b>${hasFinal(word) ? "과" : "와"} 닮은 고민을 쓴 이웃 ${shown}명만 보여요</span>
    <button type="button" id="searchMapAll">모두 보기</button>`;
  el("searchMapAll").onclick = () => el("reset").click();
}

function renderMarkers() {
  const mine = serverNeighbors.find(neighbor => neighbor.is_me);
  const others = serverNeighbors.filter(neighbor => !neighbor.is_me && (!searchMatch || searchMatch.has(neighbor.author.user_id)));
  const items = [...bottleItem(), ...keeperItem()];

  // 섬 중앙 모닥불 (섬 온도)
  if (islandTemp) {
    items.push({
      key: "campfire",
      ...campfirePoint,
      html: `
        <button type="button" class="marker campfire level-${islandTemp.level}" data-campfire
          aria-label="섬 온도 ${islandTemp.temperature}도">
          <span class="campfire-flame" aria-hidden="true"><img src="assets/campfire/campfire-${campfireSize[islandTemp.level] || "m"}.png" alt=""></span>
          <span class="campfire-temp">🌡️ ${islandTemp.temperature}°</span>
        </button>`,
    });
  }

  // 공명하는 이웃은 내 캐릭터 둘레로 다가옴
  const resonant = [...resonance.keys()];
  const nearMe = (userId) => {
    const index = resonant.indexOf(userId);
    const angle = (index / Math.max(resonant.length, 1)) * Math.PI * 2 + 0.6;
    let pos = {
      x: state.player.x + Math.cos(angle) * 11,
      y: state.player.y + Math.sin(angle) * 13,
    };
    // 모닥불과 겹치면 모닥불 바깥쪽으로 밀어냄
    const fx = pos.x - campfirePoint.x, fy = pos.y - campfirePoint.y;
    const gap = Math.hypot(fx, fy);
    if (gap < 9) {
      const push = (9 - gap) / Math.max(gap, 0.1);
      pos = { x: pos.x + fx * push, y: pos.y + fy * push };
    }
    return insideIsland(pos);
  };

  const placed = new Set();
  for (const neighbor of others) {
    const author = neighbor.author;
    const id = author.user_id;
    const live = onlineNeighbors.get(id);
    const similarity = resonance.get(id);
    const anchor = postSpot(neighbor);
    const away = Boolean(live || similarity);
    const matched = searchMatch?.get(id);
    const latest = matched ? { id: matched.id, title: matched.title } : neighbor.latest_post;
    // 서버가 내용이 닮은 고민끼리 묶어 줌 → 대표 글 자리에만 말풍선 하나("+N"), 나머지는 그리지 않음
    // (검색 중에는 찾은 고민을 하나씩 보여 주므로 묶지 않음)
    const merged = !matched && Boolean(latest?.bubble && latest.bubble !== latest.id);
    const groupSize = !matched && latest?.bubble === latest?.id ? latest.bubble_size || 1 : 1;
    placed.add(id);
    if (merged && !away) continue;

    // 고민을 남긴 자리: 글쓴이 형체 + 글 말풍선
    if (latest && !merged) {
      const bubbleAttr = groupSize > 1 ? `data-bubble-group="${latest.id}"` : `data-post="${latest.id}"`;
      items.push({
        key: "post-" + id,
        ...anchor,
        html: `
          <div class="marker post-pin ${away ? "ghost" : "wander"}">
            <button type="button" class="worry-bubble${groupSize > 1 ? " grouped" : ""}" ${bubbleAttr}
              aria-label="${groupSize > 1 ? `닮은 고민 ${groupSize}개 모아 보기` : `${escapeText(author.nickname)}의 고민`}: ${escapeText(latest.title)}">
              ${escapeText(shortTitle(latest.title, groupSize > 1 ? 11 : 14))}${groupSize > 1 ? `<b class="bubble-count">+${groupSize - 1}</b>` : ""}
            </button>
            <div class="walker">
              ${characterImg(author, away ? "" : escapeText(author.nickname) + "의 캐릭터")}
              ${away ? "" : nameTag(author, "author-name")}
            </div>
          </div>`,
      });
    }

    // 접속 중이거나 공명해서 자리를 떠난 캐릭터
    if (away || !latest) {
      const pos = similarity ? nearMe(id) : live ? insideIsland(live) : anchor;
      items.push({
        key: "who-" + id,
        ...pos,
        // 공명하는 이웃은 자기 고민을 남긴 자리에서 출발해 한 명씩 차례로 걸어옴
        from: similarity ? anchor : null,
        delay: similarity ? resonant.indexOf(id) * 0.9 : 0,
        html: personMarker(author, { live: Boolean(live), similarity, postId: resonancePosts.get(id) }),
      });
    }
  }

  // 글은 없지만 지금 섬을 돌아다니는 사람 (검색 중에는 숨김)
  for (const [id, live] of onlineNeighbors) {
    if (placed.has(id) || searchMatch) continue;
    items.push({
      key: "who-" + id,
      ...insideIsland(live),
      html: personMarker(live.author, { live: true }),
    });
  }

  // 내 고민을 남긴 자리 (내 캐릭터는 따로 움직임)
  if (mine?.latest_post?.map_x != null) {
    items.push({
      key: "post-me",
      ...postSpot(mine),
      html: `
        <div class="marker post-pin ghost mine">
          <button type="button" class="worry-bubble" data-post="${mine.latest_post.id}"
            aria-label="내 고민: ${escapeText(mine.latest_post.title)}">
            ${escapeText(shortTitle(mine.latest_post.title))}
          </button>
          <div class="walker">${characterImg(mine.author)}</div>
        </div>`,
    });
  }

  if (mine) {
    items.push({
      key: "player",
      ...state.player,
      html: `
        <div class="marker player-marker" aria-label="내 캐릭터 ${escapeText(mine.author.nickname)}">
          ${resonance.size ? `
            <button type="button" class="resonance-count" data-post="${mine.latest_post.id}"
              aria-label="내 고민과 공명하는 이웃 ${resonance.size}명, 비슷한 고민 보기">
              🔥 공명 ${resonance.size} · 닮은 고민
            </button>` : mine.latest_post ? `
            <button type="button" class="worry-tag player-worry" data-post="${mine.latest_post.id}"
              aria-label="내 최근 고민 보기">고민</button>` : ""}
          ${characterImg(mine.author)}
          ${nameTag(mine.author, "player-name")}
        </div>`,
    });
  }

  syncMarkers(items);
}

function personMarker(author, { live = false, similarity = null, postId = null } = {}) {
  return `
    <div class="marker author-pin person ${live ? "live" : "wander"} ${similarity ? "resonant" : ""}">
      ${similarity ? postId ? `
        <button type="button" class="resonance-tag" data-post="${postId}"
          title="내 고민과 비슷한 정도 ${Math.round(similarity * 100)}% · 눌러서 이 이웃의 닮은 고민 보기"
          aria-label="${escapeText(author.nickname)}의 닮은 고민 보기">🔥 공명</button>` : `
        <span class="resonance-tag" title="내 고민과 비슷한 정도 ${Math.round(similarity * 100)}%">
          🔥 공명
        </span>` : ""}
      <div class="walker">
        ${characterImg(author, escapeText(author.nickname) + "의 캐릭터")}
        ${nameTag(author, "author-name", live)}
      </div>
    </div>`;
}

// 바뀐 마커만 다시 그려서, 위치가 바뀐 캐릭터는 부드럽게 걸어가게 함
const WALK_SECONDS = 7; // 공명 이웃이 내 곁까지 걸어오는 시간 (css .author-pin.resonant와 같게)
function syncMarkers(items) {
  const layer = el("markers");
  const existing = new Map(
    [...layer.children].map(node => [node.dataset.key, node]),
  );

  for (const item of items) {
    let node = existing.get(item.key);
    if (!node || node._html !== item.html) {
      const holder = document.createElement("div");
      holder.innerHTML = item.html.trim();
      const fresh = holder.firstElementChild;
      fresh.dataset.key = item.key;
      fresh._html = item.html;
      if (node) {
        // 이전 자리에서 출발해야 걸어가는 모습이 보임
        fresh.style.left = node.style.left;
        fresh.style.top = node.style.top;
        node.replaceWith(fresh);
        void fresh.offsetWidth;
      } else if (item.from) {
        // 처음 나타나는 공명 이웃: 출발 자리에 세운 뒤 내 곁까지 천천히 걸어오게
        fresh.style.left = item.from.x + "%";
        fresh.style.top = item.from.y + "%";
        fresh.style.transitionDelay = item.delay + "s";
        fresh.classList.add("approaching");
        fresh.classList.toggle("facing-left", item.x < item.from.x);
        layer.append(fresh);
        void fresh.offsetWidth;
        setTimeout(() => {
          fresh.classList.remove("approaching");
          fresh.style.transitionDelay = "";
        }, (item.delay + WALK_SECONDS) * 1000);
      } else {
        fresh.style.left = item.x + "%";
        fresh.style.top = item.y + "%";
        layer.append(fresh);
      }
      node = fresh;
    }
    node.style.left = item.x + "%";
    node.style.top = item.y + "%";
    // 지도 가장자리 말풍선은 안쪽으로 펼쳐서 화면 밖으로 잘리지 않게
    node.classList.toggle("edge-right", item.x > 78);
    node.classList.toggle("edge-left", item.x < 22);
    existing.delete(item.key);
  }

  existing.forEach(node => node.remove());
}

// 접속하지 않은 캐릭터도 제자리 근처를 어슬렁거림
setInterval(() => {
  if (document.hidden) return;
  document.querySelectorAll("#markers .wander .walker").forEach(walker => {
    const x = Math.round((Math.random() - 0.5) * 26);
    const y = Math.round((Math.random() - 0.5) * 14);
    walker.style.transform = `translate(${x}px, ${y}px)`;
    walker.classList.toggle("facing-left", x < 0);
  });
}, 3200);

// ── 처음 들어온 사람을 위한 안내 (한 번만 자동으로, 이후엔 ? 버튼) ──
function setupWorldGuide() {
  const guide = document.createElement("dialog");
  guide.className = "world-guide";
  guide.setAttribute("aria-labelledby", "worldGuideTitle");
  guide.innerHTML = `
    <form method="dialog">
      <div class="guide-keeper">${keeperSvg(56)}<p><b>섬지기</b>예요. 섬에 오신 걸 환영해요!<br><small>섬을 둘러보는 방법을 알려 드릴게요.</small></p></div>
      <h2 id="worldGuideTitle" class="sr-only">섬에 오신 걸 환영해요</h2>
      <ul>
        <li><b>움직이기</b> 방향키·WASD 또는 지도를 눌러 내 캐릭터를 옮겨요. 초록 점이 있는 이웃은 지금 접속 중이에요.</li>
        <li><b>고민 놓기</b> 고민을 쓰면 내 캐릭터가 서 있던 자리에 글 말풍선이 남아요.</li>
        <li><b>공명</b> 나와 닮은 고민을 쓴 이웃이 내 곁으로 다가와요.</li>
        <li><b>모닥불</b> 고민과 위로가 쌓일수록 섬이 따뜻해져요. 목표는 36.5°예요.</li>
        <li><b>유리병 편지</b> 강물에 떠내려온 병을 열면 다른 섬의 고민과 그 뒤 이야기가 들어 있어요.</li>
        <li><b>칭호</b> 캐릭터마다 위로 성향이 있고, 위로를 건넬수록 활동 칭호가 자라요. 프로필의 칭호 도감에서 볼 수 있어요.</li>
        <li><b>섬지기</b> 광장의 섬지기를 누르면 이번 주 질문, 섬 소식, 이용 원칙을 볼 수 있어요.</li>
      </ul>
      <button value="ok" class="wide">둘러보기</button>
    </form>`;
  document.body.append(guide);

  const help = document.createElement("button");
  help.type = "button";
  help.className = "guide-button";
  help.setAttribute("aria-label", "섬 이용 안내");
  help.textContent = "?";
  help.onclick = () => guide.showModal();
  el("zoomIn").parentElement.append(help);

  let seen = false;
  try {
    seen = localStorage.getItem("ondo-world-guide") === "1";
    localStorage.setItem("ondo-world-guide", "1");
  } catch {
    // 저장소를 못 쓰면 매번 보여 줘도 괜찮음
  }
  if (!seen) guide.showModal();
}
