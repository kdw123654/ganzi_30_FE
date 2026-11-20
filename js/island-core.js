const el = (id) => document.getElementById(id);
const me = loadProfile();
if (!me || !authToken())
  location.replace("index.html");

const escapeText = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const img = (index) =>
  Number.isInteger(index) && index >= 0 && index < 13
    ? "assets/characters/" + index + ".png"
    : "assets/characters/0.png";
const characterNames = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지", "사자"];
const ways = ["들어주세요", "경험을 나눠주세요", "함께 생각해주세요"];
const topics = {
  "업무·직장생활": [
    "업무량·스트레스",
    "직장 내 관계·갈등",
    "업무 실수",
    "성과 압박",
    "조직 문화",
    "워라밸",
    "직장 내 괴롭힘",
  ],
  "진로·성장": [
    "진로·직무 적성",
    "이직·퇴사",
    "커리어 성장·역량",
    "취업·입사 적응",
    "미래 불안",
  ],
  "감정·마음": [
    "번아웃·무기력",
    "불안·걱정",
    "외로움·고립감",
    "자존감·비교",
    "감정 조절",
  ],
  "관계·일상": [
    "인간관계·갈등",
    "연애·이별",
    "가족·결혼",
    "경제·금전",
    "건강·생활습관",
  ],
};
const config = window.ISLAND_CONFIG;
const key = config.storageKey;
const state = JSON.parse(
  localStorage.getItem(key) ||
    '{"posts":[],"replies":{},"theme":"day","read":[]}',
);
state.player ??= { x: 46, y: 62 };
const samples = [
  [
    "느린곰",
    0,
    "피드백을 받을 때마다 제가 부족한 사람 같아요",
    "상사에게 피드백을 받으면 자꾸 자신감이 떨어져요. 다음 일을 시작하기도 전에 걱정부터 앞서요.",
    0,
    "업무량·스트레스",
    "2년차",
    51,
    44,
    [],
  ],
  [
    "작은사슴",
    1,
    "회의에서 제 의견을 꺼내기가 어려워요",
    "회의 중에 하고 싶은 말이 있어도 타이밍을 놓쳐요. 다른 분들은 처음에 어떻게 의견을 꺼내셨는지 궁금해요.",
    1,
    "직장 내 관계·갈등",
    "1년차",
    41,
    50,
    [
      ["조용한 토끼", "저는 회의 전에 한 문장만 미리 적어두니 조금 편했어요."],
      ["포근한 양", "저도 비슷했어요. 먼저 질문으로 말을 시작해 봤어요."],
    ],
  ],
  [
    "밤산책",
    3,
    "퇴근해도 업무 생각이 멈추지 않아요",
    "집에 돌아와도 할 일이 계속 떠올라서 쉬는 시간이 짧게 느껴져요.",
    2,
    "워라밸",
    "3년차",
    58,
    49,
    [["다정한 용", "퇴근 전에 내일 할 일을 적어두는 게 도움이 됐어요."]],
  ],
  [
    "도토리",
    8,
    "첫 프로젝트를 끝냈는데 마음이 허전해요",
    "한동안 한 가지 일에 몰입했는데 마무리하고 나니 다음에 뭘 해야 좋을지 모르겠어요.",
    0,
    "커리어 성장·역량",
    "1년차",
    45,
    64,
    [],
  ],
].map(([nick, animal, title, body, way, topic, years, x, y, replies], i) => ({
  id: "sample-" + i,
  nick,
  animal,
  title,
  body,
  way,
  topic,
  years,
  x,
  y,
  replies,
  job: me?.job,
  time: ["방금", "5분 전", "12분 전", "18분 전"][i],
}));
const notices = [
  {
    id: "example-1",
    title: "팀 회의에서 말하기가 어려워요",
    time: "방금 전",
    name: "느린곰",
    body: "저도 비슷했어요. 다음 회의에 할 말을 한 문장만 적어두면 부담이 조금 줄더라고요.",
  },
  {
    id: "example-2",
    title: "퇴근 후에도 일이 생각나요",
    time: "1시간 전",
    name: "밤산책",
    body: "퇴근 전에 내일 할 일을 적어두니 조금 편해졌어요.",
  },
];
const themes = [
  ["night", "밤"],
  ["dawn", "새벽"],
  ["day", "낮"],
  ["sunset", "노을"],
];
const jobNames = {
  디자인: "Design village",
  개발: "Development village",
  마케팅: "Marketing village",
};
const save = () => localStorage.setItem(key, JSON.stringify(state));
const own = () => state.posts.filter((p) => p.job === me.job);
const repliesFor = (p) => [
  ...(p.replies || []),
  ...(state.replies[p.id] || []),
];
const find = (id) => [...own(), ...samples].find((p) => p.id === id);
const opt = (text, value = text) => new Option(text, value);
let comfortFilter = "";
let categoryFilter = ""; // 고민 주제(대분류) 필터
let waitingOnly = false; // "답을 기다리는 고민"만 보기
const activeFilters = () => searchText || comfortFilter || categoryFilter || waitingOnly;
const tokenise = (text) => text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
let selectedTopic = "";
let zoom = 1,
  visiblePins = [],
  recentWorryIds = new Set();
let searchText = "",
  tab = "alerts",
  editing = null,
  deleting = null,
  toastTimer;
let themeSwapTimer, themeTransitionTimer;

function toast(message) {
  el("notice").textContent = message;
  el("notice").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el("notice").hidden = true;
  }, 2400);
}
// 시간대별 배경: 일출 5시, 낮 6~17시, 노을 18~19시, 밤 20시~새벽 4시
function themeForHour(hour = new Date().getHours()) {
  if (hour === 5) return "dawn";
  if (hour >= 6 && hour < 18) return "day";
  if (hour >= 18 && hour < 20) return "sunset";
  return "night";
}
// 자동 모드(기본)면 지금 시각에 맞는 배경으로 바꿈
function syncThemeWithClock() {
  if (state.themeMode === "manual") return;
  changeTheme(themeForHour());
}
function changeTheme(nextTheme) {
  if (nextTheme === state.theme) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.theme = nextTheme;
    save();
    renderTheme();
    return;
  }

  const map = el("map");
  const nextImage = new Image();
  nextImage.src = `assets/village/village-${nextTheme}.webp`;
  clearTimeout(themeSwapTimer);
  clearTimeout(themeTransitionTimer);
  map.classList.remove("theme-transitioning");
  void map.offsetWidth;
  map.classList.add("theme-transitioning");

  themeSwapTimer = setTimeout(() => {
    state.theme = nextTheme;
    save();
    renderTheme();
  }, 360);
  themeTransitionTimer = setTimeout(() => {
    map.classList.remove("theme-transitioning");
  }, 900);
}
function renderTheme() {
  const [, name] = themes.find(([id]) => id === state.theme) ?? themes[2];
  const current = el("currentTheme");
  current.setAttribute("aria-label", "배경 시간대 선택 · 현재 " + name);
  current.title = name + " 배경";
  current.innerHTML = `<img src="assets/themes/theme-${state.theme}.png" alt="">`;
  el("land").src = "assets/village/village-" + state.theme + ".webp";
  el("map").dataset.time = state.theme; // 시간대별 빛·반딧불이 등 분위기 연출
  const auto = state.themeMode !== "manual";
  el("themes").innerHTML =
    themes
      .map(
        ([id, name]) =>
          `<button type="button" data-theme="${id}" aria-label="${name}" title="${name}" aria-pressed="${!auto && id === state.theme}"><img src="assets/themes/theme-${id}.png" alt=""></button>`,
      )
      .join("") +
    `<button type="button" class="theme-auto" data-theme-auto aria-label="시간에 맞춰 자동" title="시간에 맞춰 자동" aria-pressed="${auto}">자동</button>`;
}

let feedRequestId = 0;

// 고민 카드 한 장: 위로 방식 · 날짜 / (답을 기다려요) 제목 / 닉네임 / 주제 · 답글 수
function worryCard(post, { unread = false } = {}) {
  const way = COMFORT_KEYS.indexOf(post.comfort_type);
  const mode = post.visibility === "private" ? "나만보기" : ways[way] || "";
  return `
    <button type="button" class="card worry-card" data-post="${post.id}">
      <small class="mode">${escapeText([mode, new Date(post.created_at).toLocaleString("ko-KR")].filter(Boolean).join(" · "))}</small>
      <strong>${unread ? '<i class="unread-dot" aria-label="새 댓글"></i>' : ""}${post.waiting ? '<span class="waiting-badge">답을 기다려요</span>' : ""}${escapeText(post.title)}</strong>
      <small class="card-author">${escapeText(post.author?.nickname || "떠난 이용자")} ${titleBadge(post.author?.title)}</small>
      <small class="card-meta">${escapeText(post.topic)} · 답글 ${Number(post.comment_count) || 0}</small>
    </button>`;
}

async function renderFeed() {
  const requestId = ++feedRequestId;
  loadTemperature();
  const query = searchText.trim();

  el("reset").hidden = !activeFilters();

  if (query && (query.length < 2 || query.length > 200)) {
    el("count").textContent = "검색어를 확인해주세요.";
    el("feed").textContent = "검색어는 2~200자로 입력해주세요.";
    return;
  }

  el("count").textContent = "고민을 불러오는 중...";
  el("feed").textContent = "잠시만 기다려주세요.";

  try {
    if (!Number.isInteger(islandId) || islandId <= 0) {
      throw new Error("섬 선택 화면에서 다시 입장해주세요.");
    }

    let posts;
    let fallback = null;
    let hasMore = false;

    if (query) {
      const params = new URLSearchParams({
        q: query,
        island_id: String(islandId),
        limit: "20"
      });

      const result = await api(`/search?${params}`);
      posts = result.items;
      fallback = result.empty ? result.fallback : null;
    } else {
      const params = new URLSearchParams({ limit: "50" });

      if (waitingOnly) params.set("waiting", "true");
      if (categoryFilter) params.set("category", categoryFilter);

      if (comfortFilter !== "") {
        params.set(
          "comfort_type",
          COMFORT_KEYS[Number(comfortFilter)]
        );
      }

      const result = await api(`/islands/${islandId}/posts?${params}`);
      posts = result.posts;
      hasMore = Boolean(result.next_before_id);
    }

    if (requestId !== feedRequestId) return;

    // 유사 검색 결과에도 선택한 위로 방식 적용
    if (query && comfortFilter !== "") {
      posts = posts.filter(
        post => post.comfort_type === COMFORT_KEYS[Number(comfortFilter)]
      );
    }

    if (query && waitingOnly) posts = posts.filter(post => post.waiting);
    if (query && categoryFilter) {
      const inCategory = new Set(topics[categoryFilter] || []);
      posts = posts.filter(post => inCategory.has(post.topic));
    }

    recentWorryIds = new Set(posts.slice(0, 3).map(post => post.id));

    el("count").textContent =
      (query ? "비슷한 고민 " : activeFilters()
        ? "조건에 맞는 고민 "
        : "최근 올라온 고민 ") +
      posts.length + (hasMore ? "+" : "");

    if (fallback) {
      el("feed").innerHTML = `
        <p>${escapeText(fallback.message)}</p>
        <div id="fallbackKeywords" class="row"></div>
        <button type="button" id="writeFromSearch">
          이 내용으로 고민 쓰기
        </button>
      `;

      for (const keyword of fallback.keywords || []) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "soft";
        button.textContent = keyword.label;
        button.onclick = () => {
          searchText = el("query").value = keyword.query;
          renderFeed();
        };
        el("fallbackKeywords").append(button);
      }

      el("writeFromSearch").onclick = () => {
        editor();
        el("body").value = fallback.write_prefill?.content || query;
        updateDraftCounts();
      };

      return;
    }

    el("feed").innerHTML = posts.map(post => worryCard(post)).join("") || (
      activeFilters()
        ? "<p>조건에 맞는 고민이 없어요.</p>"
        : "<p>아직 올라온 고민이 없어요.</p>"
    );
  } catch (error) {
    if (requestId !== feedRequestId) return;

    el("count").textContent = "고민을 불러오지 못했어요.";
    el("feed").textContent = error.message;
  }
}

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

function renderMarkers() {
  const mine = serverNeighbors.find(neighbor => neighbor.is_me);
  const others = serverNeighbors.filter(neighbor => !neighbor.is_me);
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
    const latest = neighbor.latest_post;
    // 서버가 내용이 닮은 고민끼리 묶어 줌 → 대표 글 자리에만 말풍선 하나("+N"), 나머지는 그리지 않음
    const merged = Boolean(latest?.bubble && latest.bubble !== latest.id);
    const groupSize = latest?.bubble === latest?.id ? latest.bubble_size || 1 : 1;
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

  // 글은 없지만 지금 섬을 돌아다니는 사람
  for (const [id, live] of onlineNeighbors) {
    if (placed.has(id)) continue;
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

// ── 유리병 편지: 다른 섬에서 떠내려온 고민과, 그 뒤 글쓴이가 남긴 이야기 ──
const bottlePoint = { x: 65, y: 62 }; // 강물 위
let bottle = null; // 오늘의 유리병 편지 (하루 한 통, 아침 8시에 새로 옴)
let bottleTimer = null;

async function loadBottle() {
  if (!Number.isInteger(islandId)) return;
  try {
    bottle = await api(`/islands/${islandId}/bottle`);
  } catch {
    bottle = null; // 오늘 편지를 이미 읽었거나, 떠내려온 병이 없음
  }
  renderMarkers();
}

function bottleItem() {
  if (!bottle) return [];
  return [{
    key: "bottle",
    ...bottlePoint,
    html: `
      <button type="button" class="marker bottle" data-bottle aria-label="떠내려온 유리병 편지 열기">
        <svg viewBox="0 0 40 24" aria-hidden="true">
          <rect x="4" y="6" width="24" height="12" rx="6" fill="#d9f2ee" stroke="#4f8f86" stroke-width="1.6"/>
          <rect x="27" y="9" width="7" height="6" rx="1.5" fill="#d9f2ee" stroke="#4f8f86" stroke-width="1.6"/>
          <rect x="33" y="8.5" width="4" height="7" rx="1.2" fill="#b0855a"/>
          <path d="M10 10h12M10 14h9" stroke="#c9a46a" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span class="bottle-label">편지</span>
      </button>`,
  }];
}

// ── 섬지기: 섬의 규칙·안전·소식을 맡는 운영자 캐릭터 (위로는 온도와 이웃이, 섬지기는 댓글을 달지 않음) ──
const keeperPoint = { x: 77, y: 56 }; // 강 오른쪽 집 앞 (섬지기의 집)
let keeper = null;

// 섬지기 그림 (선장 모자 + 등불을 든 작은 지기)
// 받침이 있으면 "이에요", 없으면 "예요" (예: 워라밸이에요 / 업무량·스트레스예요)
// 마지막 글자에 받침이 있나 → 이에요/예요, 은/는
function hasFinal(word) {
  const code = String(word).charCodeAt(String(word).length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}
const copula = (word) => (hasFinal(word) ? "이에요" : "예요");
const topicMark = (word) => (hasFinal(word) ? "은" : "는");

const keeperSvg = (size = 70) => `
  <svg class="keeper-art" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="59" rx="15" ry="3.5" fill="#00000022"/>
    <path d="M18 56c0-12 6-20 14-20s14 8 14 20z" fill="#2f6f8f"/>
    <path d="M26 38h12l-2 6h-8z" fill="#f4e3c3"/>
    <circle cx="32" cy="27" r="11" fill="#ffe2c4"/>
    <circle cx="28" cy="27.5" r="1.4" fill="#3a2a20"/>
    <circle cx="36" cy="27.5" r="1.4" fill="#3a2a20"/>
    <path d="M29 31.5q3 2.4 6 0" stroke="#c46a4a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="25.5" cy="30.5" r="2" fill="#f7b3a2" opacity=".7"/>
    <circle cx="38.5" cy="30.5" r="2" fill="#f7b3a2" opacity=".7"/>
    <path d="M19 21c2-8 24-8 26 0z" fill="#ffffff" stroke="#24594f" stroke-width="1.6"/>
    <rect x="18" y="20" width="28" height="4" rx="2" fill="#24594f"/>
    <path d="M30 14.5l2-2 2 2-2 2z" fill="#f2c14e"/>
    <path d="M46 44v8" stroke="#6b4a2b" stroke-width="2" stroke-linecap="round"/>
    <rect x="42.5" y="46" width="7" height="9" rx="2" fill="#f2c14e" stroke="#b7791f" stroke-width="1.2"/>
    <circle class="keeper-glow" cx="46" cy="50.5" r="7" fill="#ffd56b" opacity=".35"/>
  </svg>`;

// 섬지기 말풍선: 요일·시간대 한마디와 이번 주의 질문을 몇 초마다 번갈아 보여 줌
const KEEPER_BUBBLE_MS = 7000;
let keeperPhase = 0; // 짝수 = 한마디, 홀수 = 이번 주의 질문
let keeperTimer = null;
const keeperBubble = () =>
  keeperPhase % 2 === 0
    ? { text: keeper.greeting, cls: "say" }
    : { text: `이번 주의 질문 · ${keeper.question.text}`, cls: "ask" };

function rotateKeeperBubble() {
  if (!keeper) return;
  keeperPhase += 1;
  const { text, cls } = keeperBubble();
  document.querySelectorAll(".keeper-bubble").forEach((bubble) => {
    bubble.textContent = text;
    bubble.dataset.kind = cls;
  });
}

async function loadKeeper() {
  if (!Number.isInteger(islandId)) return;
  try {
    keeper = await api(`/islands/${islandId}/keeper`);
  } catch {
    keeper = null; // 이전 서버면 섬지기 없이
  }
  renderMarkers();
  if (keeper && !keeperTimer) keeperTimer = setInterval(rotateKeeperBubble, KEEPER_BUBBLE_MS);
}

function keeperItem() {
  if (!keeper) return [];
  const bubble = keeperBubble();
  return [{
    key: "keeper",
    ...keeperPoint,
    html: `
      <button type="button" class="marker keeper" data-keeper aria-label="섬지기: 오늘의 한마디, 이번 주의 질문, 섬 소식 보기">
        <span class="keeper-bubble" data-kind="${bubble.cls}" aria-hidden="true">${escapeText(bubble.text)}</span>
        ${keeperSvg(52)}
        <span class="keeper-name">섬지기</span>
      </button>`,
  }];
}

async function openKeeper() {
  let dialog = el("keeperDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "keeperDialog";
    dialog.className = "keeper-dialog";
    dialog.setAttribute("aria-labelledby", "keeperTitle");
    document.body.append(dialog);
  }
  try {
    keeper = await api(`/islands/${islandId}/keeper`); // 열 때마다 최신 소식
  } catch (error) {
    if (!keeper) return toast(error.message);
  }
  const k = keeper;
  const w = k.week;
  const stat = (num, label) => `<div class="keeper-stat"><b>${Number(num)}</b><span>${label}</span></div>`;
  dialog.innerHTML = `
    <form method="dialog" class="keeper-paper">
      <div class="keeper-head">
        ${keeperSvg(72)}
        <div>
          <h2 id="keeperTitle">${escapeText(k.name)} <small class="keeper-role">섬 운영</small></h2>
          ${k.moment ? `<small class="keeper-moment">${escapeText(k.moment)}의 한마디</small>` : ""}
          <p class="keeper-say">${escapeText(k.greeting)}</p>
        </div>
      </div>

      <div class="keeper-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="true" data-keeper-tab="news">섬 소식</button>
        <button type="button" role="tab" aria-selected="false" data-keeper-tab="report">섬 고민 리포트</button>
      </div>
      <div class="keeper-panel" data-keeper-panel="report" hidden></div>
      <div class="keeper-panel" data-keeper-panel="news">
      <section class="keeper-card keeper-question">
        <h3>이번 주의 질문</h3>
        <p>“${escapeText(k.question.text)}”</p>
        <button type="button" id="keeperWrite">이 질문으로 고민 나누기</button>
      </section>

      <section class="keeper-card">
        <h3>최근 ${Number(w.days)}일 섬 소식</h3>
        <div class="keeper-stats">
          ${stat(w.posts, "나눈 고민")}
          ${stat(w.comforts, "이웃의 위로")}
          ${stat(w.ai_comforts, "온도의 위로")}
          ${stat(w.thanks, "받은 고마움")}
          ${stat(w.visitors, "다녀간 이웃")}
        </div>
        ${w.top_topic ? `<p class="keeper-note">이번 주에 가장 많이 나눈 고민은 <b>${escapeText(w.top_topic)}</b>${copula(w.top_topic)}.</p>` : ""}
      </section>

      <section class="keeper-card">
        <h3>섬 이용 원칙</h3>
        <ul class="keeper-rules">${k.rules.map((rule) => `<li>${escapeText(rule)}</li>`).join("")}</ul>
      </section>

      <details class="keeper-card keeper-crisis">
        <summary>많이 힘들 땐 <small>상담 전화 보기</small></summary>
        <p>${escapeText(k.crisis_support.message)}</p>
        <div class="row">
          ${k.crisis_support.resources.map((r) => `<a class="keeper-call" href="tel:${escapeText(r.phone)}">${escapeText(r.name)} <b>${escapeText(r.phone)}</b> <small>${escapeText(r.hours)}</small></a>`).join("")}
        </div>
      </details>
      </div>

      <p class="keeper-foot">섬지기는 댓글을 달지 않아요. 위로는 온도와 이웃들이, 규칙과 안전은 섬지기가 맡아요.</p>
      <button value="close" class="soft wide">닫기</button>
    </form>`;
  dialog.querySelector("#keeperWrite").onclick = () => {
    dialog.close();
    editor();
    if (k.question.topic) {
      selectedTopic = k.question.topic;
      updateTopicSelection();
    }
    el("body").placeholder = `섬지기의 질문: ${k.question.text}`;
  };
  // 탭: 섬 소식 ↔ 섬 고민 리포트 (리포트는 처음 열 때 불러옴)
  dialog.querySelectorAll("[data-keeper-tab]").forEach((tab) => {
    tab.onclick = () => {
      const name = tab.dataset.keeperTab;
      dialog.querySelectorAll("[data-keeper-tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      dialog.querySelectorAll("[data-keeper-panel]").forEach((panel) => { panel.hidden = panel.dataset.keeperPanel !== name; });
      if (name === "report") loadInsights(dialog.querySelector('[data-keeper-panel="report"]'), dialog);
    };
  });
  dialog.showModal();
}

// ───────── 섬 고민 리포트: 쌓인 공개 고민 분석 (GET /islands/{id}/insights) ─────────
const DAY_SHORT = ["월", "화", "수", "목", "금", "토", "일"];
const percent = (ratio) => `${Math.round(Number(ratio) * 100)}%`;

async function loadInsights(panel, dialog) {
  panel.innerHTML = `<p class="report-empty">섬에 쌓인 고민을 살펴보는 중이에요…</p>`;
  let d;
  try {
    d = await api(`/islands/${islandId}/insights`);
  } catch (error) {
    panel.innerHTML = `<p class="report-empty">${escapeText(error.message)}</p>`;
    return;
  }
  panel.innerHTML = renderInsights(d);
  // 리포트 속 고민 카드를 누르면 그 글로 이동
  panel.querySelectorAll("[data-report-post]").forEach((button) => {
    button.onclick = () => {
      dialog.close();
      showPost(Number(button.dataset.reportPost));
    };
  });
}

// "11월 19일 아침 8시" (리포트 기준 시각)
const reportStamp = (iso) => {
  if (!iso) return "오늘 아침 8시";
  const t = new Date(iso);
  return `${t.getMonth() + 1}월 ${t.getDate()}일 아침 8시`;
};

function renderInsights(d) {
  if (!d.enough) {
    return `<p class="report-empty">아직 이 섬에 공개 고민이 ${Number(d.total_posts)}개예요.<br>
      ${Number(d.min_posts)}개가 넘게 쌓이면 어떤 고민이 많은지 정리해 드릴게요.</p>`;
  }
  const bar = (item, max) => `
    <li class="report-bar">
      <span class="report-bar-label">${escapeText(item.label)}</span>
      <span class="report-bar-track"><i style="width:${Math.max(4, (item.count / max) * 100)}%"></i></span>
      <b>${percent(item.ratio)}</b>
    </li>`;
  const pick = (item, kind) => item ? `
    <button type="button" class="report-pick ${kind}" data-report-post="${Number(item.post_id)}">
      <small>${kind === "warm" ? `오늘 공감이 모인 고민 · 공감 ${Number(item.count)}` : "아직 답을 기다리는 고민"}</small>
      <strong>${escapeText(item.title)}</strong>
      <span class="topic-chip">${escapeText(item.topic)}</span>
    </button>` : "";
  const maxTopic = Math.max(...d.topics.map((t) => t.count), 1);
  const maxDay = Math.max(...d.time.days, 1);
  const me = d.me;
  return `
    <section class="keeper-card report-summary">
      <h3>한눈에 보기 <small>${reportStamp(d.as_of)} 기준 · 공개 고민 ${Number(d.total_posts)}개 · 이번 주 ${Number(d.week_posts)}개</small></h3>
      <ul class="report-lines">${d.headlines.map((line) => `<li>${escapeText(line)}</li>`).join("")}</ul>
    </section>

    ${d.warmest || d.waiting ? `<section class="report-picks">${pick(d.warmest, "warm")}${pick(d.waiting, "wait")}</section>` : ""}

    <section class="keeper-card">
      <h3>많이 나눈 고민 <small>주제 ${Number(d.topic_kinds)}가지 중 상위</small></h3>
      <ul class="report-bars">${d.topics.map((t) => bar(t, maxTopic)).join("")}</ul>
      <div class="report-stack" aria-label="큰 분류별 비율">
        ${d.categories.map((c, i) => `<i class="c${i % 4}" style="flex:${c.count}" title="${escapeText(c.label)} ${percent(c.ratio)}"></i>`).join("")}
      </div>
      <p class="report-legend">${d.categories.map((c, i) => `<span><i class="c${i % 4}"></i>${escapeText(c.label)} ${percent(c.ratio)}</span>`).join("")}</p>
    </section>

    ${d.groups.length ? `
    <section class="keeper-card">
      <h3>결이 닮은 고민 묶음 <small>내용이 비슷한 글끼리 AI가 묶었어요</small></h3>
      <div class="report-groups">
        ${d.groups.map((g) => `
          <button type="button" class="report-group" data-report-post="${Number(g.post_id)}">
            <strong>${escapeText(g.title)}</strong>
            <small>닮은 고민 ${Number(g.size)}개 · 평균 유사도 ${percent(g.similarity)} · ${escapeText(g.topic)}</small>
          </button>`).join("")}
      </div>
    </section>` : ""}

    ${me ? `
    <section class="keeper-card report-me">
      <h3>내 고민과 공명</h3>
      <p>내 최근 고민 <b>‘${escapeText(me.title)}’</b></p>
      ${me.similar_posts ? `
      <div class="keeper-stats">
        <div class="keeper-stat"><b>${Number(me.similar_posts)}</b><span>닮은 고민</span></div>
        <div class="keeper-stat"><b>${Number(me.neighbors)}</b><span>공명하는 이웃</span></div>
        <div class="keeper-stat"><b>${percent(me.top_similarity)}</b><span>가장 닮은 정도</span></div>
      </div>` : `<p class="keeper-note">아직 이 섬엔 꼭 닮은 고민이 없어요. 처음 꺼낸 이야기일 수 있어요. 비슷한 마음의 이웃이 오면 공명으로 알려 드릴게요.</p>`}
      ${me.topic_rank ? `<p class="keeper-note">내 주제 <b>${escapeText(me.topic)}</b>${topicMark(me.topic)} ${me.topic_rank === 1 ? "이 섬에서 가장 많이 나눈 고민이에요" : `이 섬에서 ${Number(me.topic_rank)}번째로 많아요`}. 혼자만의 고민이 아니에요.</p>` : ""}
      <button type="button" class="soft wide" data-report-post="${Number(me.post_id)}">닮은 고민 보러 가기</button>
    </section>` : ""}

    <section class="keeper-card">
      <h3>언제 고민이 올라오나 ${d.time.busiest && d.time.busiest_count >= 2 ? `<small>가장 많은 때: ${escapeText(d.time.busiest)}</small>` : ""}</h3>
      <div class="report-days">
        ${d.time.days.map((n, i) => `<span><i style="height:${Math.max(6, (n / maxDay) * 100)}%"></i><b>${DAY_SHORT[i]}</b></span>`).join("")}
      </div>
      <p class="report-legend">${d.time.slots.map((s) => `<span>${escapeText(s.label)} ${percent(s.ratio)}</span>`).join("")}</p>
    </section>

    <section class="keeper-card">
      <h3>바라는 위로</h3>
      <ul class="report-bars">${d.comfort.map((c) => bar(c, Math.max(...d.comfort.map((x) => x.count), 1))).join("")}</ul>
    </section>

    ${d.jobs.length ? `
    <section class="keeper-card">
      <h3>직무섬마다 많은 고민</h3>
      <ul class="report-jobs">
        ${d.jobs.map((j) => `<li class="${j.island_id === d.island_id ? "here" : ""}"><b>${escapeText(j.island_name)}</b><span>${escapeText(j.topic)}</span><small>${percent(j.ratio)}</small></li>`).join("")}
      </ul>
    </section>` : ""}

    <p class="keeper-foot">리포트는 매일 아침 8시에 새로 정리돼요. 공개 고민만 모아 셌어요.</p>`;
}

// 닮은 고민 말풍선을 누르면: 그 묶음에 든 고민 목록
function openBubbleGroup(leadId) {
  const members = serverNeighbors
    .filter((n) => n.latest_post?.bubble === leadId)
    .sort((a, b) => (b.latest_post.id === leadId) - (a.latest_post.id === leadId));
  if (!members.length) return;
  let dialog = el("bubbleDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "bubbleDialog";
    dialog.className = "keeper-dialog";
    dialog.setAttribute("aria-labelledby", "bubbleTitle");
    document.body.append(dialog);
  }
  dialog.innerHTML = `
    <form method="dialog" class="keeper-paper">
      <h2 id="bubbleTitle" class="bubble-title">닮은 고민 ${members.length}개</h2>
      <p class="keeper-note">내용이 비슷한 고민을 AI가 한 말풍선으로 모았어요. 같은 마음인 이웃이 이만큼 있어요.</p>
      <div class="report-groups">
        ${members.map((n) => `
          <button type="button" class="report-group" data-group-post="${Number(n.latest_post.id)}">
            <strong>${escapeText(n.latest_post.title)}</strong>
            <small>${escapeText(n.author.nickname)}</small>
          </button>`).join("")}
      </div>
      <button value="close" class="soft wide">닫기</button>
    </form>`;
  dialog.querySelectorAll("[data-group-post]").forEach((button) => {
    button.onclick = () => {
      dialog.close();
      showPost(Number(button.dataset.groupPost));
    };
  });
  dialog.showModal();
}

function openBottle() {
  if (!bottle) return;
  const letter = bottle;
  let dialog = el("bottleDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "bottleDialog";
    dialog.className = "bottle-dialog";
    dialog.setAttribute("aria-labelledby", "bottleTitle");
    document.body.append(dialog);
  }
  const when = new Date(letter.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  dialog.innerHTML = `
    <form method="dialog" class="bottle-paper">
      <p class="bottle-from">${escapeText(letter.island_name)}에서 떠내려온 편지 · ${when}</p>
      <h2 id="bottleTitle">${escapeText(letter.title)}</h2>
      <p class="bottle-author">${escapeText(letter.author.nickname)} ${personaChip(letter.author.character)}</p>
      <p class="bottle-body">${escapeText(letter.content)}</p>
      ${letter.follow_up ? `
        <div class="bottle-story">
          <strong>그 뒤 이야기</strong>
          <p>${escapeText(letter.follow_up)}</p>
        </div>` : ""}
      <label for="bottleReply">이 고민에 댓글을 남겨요</label>
      <textarea id="bottleReply" maxlength="400" rows="3" placeholder="같은 마음이었던 적이 있다면 한마디 남겨 주세요"></textarea>
      <p class="bottle-error" id="bottleError" role="alert" hidden></p>
      <p class="bottle-next">유리병은 하루에 한 통, 아침 8시에 떠내려와요. 읽고 나면 강물로 돌아가요.</p>
      <div class="row bottle-actions">
        <button type="button" class="soft" id="bottleOpenPost">글 전체 보기</button>
        <button type="button" id="bottleSend">댓글 달기</button>
      </div>
      <button value="close" class="plain bottle-close" aria-label="닫기">닫기</button>
    </form>`;

  // 열면 읽음으로 표시 → 닫으면 병이 떠내려가 사라지고, 다음 날 아침 8시에 새 병이 옴
  api(`/islands/${islandId}/bottle/open`, { method: "POST" }).catch(() => {});
  const gone = () => {
    bottle = null;
    renderMarkers();
    clearTimeout(bottleTimer);
    const wait = new Date(letter.next_at).getTime() - Date.now();
    if (wait > 0 && wait < 86400000) bottleTimer = setTimeout(loadBottle, wait + 5000);
  };
  let finished = false;
  const done = (message) => {
    if (finished) return; // 닫기·답장·글 보기 어느 쪽으로 닫혀도 한 번만
    finished = true;
    dialog.close();
    if (message) toast(message);
    el("markers").querySelector(".bottle")?.classList.add("drift");
    setTimeout(gone, 900);
  };
  // 닫기 버튼·Esc·글 보기 어느 쪽으로 닫아도 병이 사라지게 (close 이벤트는 예비)
  dialog.querySelector(".bottle-close").onclick = (event) => {
    event.preventDefault();
    done("");
  };
  dialog.oncancel = (event) => {
    event.preventDefault();
    done("");
  };
  dialog.onclose = () => done("");
  dialog.querySelector("#bottleOpenPost").onclick = () => {
    done("");
    showPost(letter.post_id);
  };
  dialog.querySelector("#bottleSend").onclick = async (event) => {
    const text = dialog.querySelector("#bottleReply").value.trim();
    const error = dialog.querySelector("#bottleError");
    if (!text) {
      error.textContent = "답장을 한 줄 적어 주세요.";
      error.hidden = false;
      return;
    }
    event.target.disabled = true;
    try {
      await api(`/posts/${letter.post_id}/comments`, { method: "POST", body: { content: text } });
      done("댓글을 남겼어요. 글쓴이에게 닿을 거예요");
    } catch (e) {
      const suggestion = e.detail?.issues?.[0]?.guide || e.detail?.suggestion;
      error.textContent = suggestion ? `${e.message} ${suggestion}` : e.message;
      error.hidden = false;
      event.target.disabled = false;
    }
  };
  dialog.showModal();
}

function showCampfireInfo() {
  if (!islandTemp) return;
  toast(
    `섬 온도 ${islandTemp.temperature}° · 최근 ${islandTemp.days}일 고민 ${islandTemp.posts}개, 위로 ${islandTemp.comments}개. ${weatherText[islandTemp.level]}`,
  );
}

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

let detailRequestId = 0;
let currentPostId = null; // 지금 상세 창에 떠 있는 글
let replyTo = null; // 답글 대상 { postId, id, name }
let aiPending = null; // AI 이어 답글 대기 { postId, baseline }
let aiPollToken = 0;
const similarCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 상담 안내(글·댓글 작성 응답의 crisis_support) 표시
function showCrisisSupport(support) {
  if (!support) return;
  const resources = (support.resources || []).map((r) =>
    typeof r === "string"
      ? `<span class="keeper-call">${escapeText(r)}</span>`
      : `<a class="keeper-call" href="tel:${escapeText(r.phone)}">${escapeText(r.name)} <b>${escapeText(r.phone)}</b> <small>${escapeText(r.hours || "")}</small></a>`,
  );
  // alert 대신 접고 펼치는 카드 (처음엔 접힌 상태, 눌러야 상담 전화가 보임)
  document.getElementById("crisisSupport")?.remove();
  const box = document.createElement("aside");
  box.id = "crisisSupport";
  box.className = "crisis-support keeper-crisis";
  box.setAttribute("role", "status");
  box.innerHTML = `
    <details>
      <summary>${escapeText(support.message || "많이 힘들 땐 상담 전화가 있어요.")} <small>상담 전화 보기</small></summary>
      <div class="row">${resources.join("")}</div>
    </details>
    <button type="button" class="crisis-close" aria-label="상담 안내 닫기">×</button>`;
  box.querySelector(".crisis-close").addEventListener("click", () => box.remove());
  document.body.append(box);
}

const commentName = (comment) =>
  comment.is_ai ? "온도 · AI 이웃" : comment.author?.nickname || "떠난 이용자";

// 댓글 하나 그리기 (답글이면 child 클래스로 한 단계 들여쓰기)
// 온도(AI)·내 댓글은 모양을 구분하고, 버튼은 작은 글자 링크로 (위로 내용이 먼저 보이게)
function renderComment(comment, post, child = false) {
  const cls = [
    "reply",
    child ? "child" : "",
    comment.is_ai ? "from-ai" : "",
    comment.is_mine && !comment.is_ai ? "mine" : "",
  ].filter(Boolean).join(" ");

  // 가려진·삭제된 댓글은 이름·아바타·버튼 없이 안내 문구만
  if (comment.is_hidden || comment.is_deleted) {
    const canAppeal = comment.is_mine && comment.is_hidden;
    return `
      <div class="${cls}">
        <p class="muted">${escapeText(comment.content)}</p>
        ${canAppeal ? `<button type="button" class="soft" data-appeal-comment="${comment.id}">이의 제기</button>` : ""}
      </div>`;
  }

  const avatar = comment.is_ai
    ? "assets/welcome/welcome-heart.png"
    : img(CHARACTER_KEYS.indexOf(comment.author?.character));
  const canReport = !comment.is_mine && !comment.is_ai;
  const canDelete = comment.is_mine && !comment.is_ai;
  const canThank = post.is_mine && !comment.is_ai && !comment.is_mine;
  const canReply = post.visibility === "public";

  return `
    <div class="${cls}">
      <div class="reply-head">
        <img class="reply-avatar ${comment.is_ai ? "" : toneClass(comment.author?.color)}" src="${avatar}" alt="">
        <strong>${escapeText(commentName(comment))}</strong>
        ${comment.is_mine && !comment.is_ai ? `<span class="me-tag">나</span>` : ""}
        ${comment.is_ai ? "" : titleBadge(comment.author?.title)}
      </div>
      <p>${escapeText(comment.content)}</p>
      <div class="reply-actions">
        ${canThank ? `<button type="button" class="link-btn thank-btn" data-thank-comment="${comment.id}" aria-pressed="${comment.thanked}">${comment.thanked ? "♥ 고마워요" : "♡ 고마워요"}</button>` : ""}
        ${canReply ? `<button type="button" class="link-btn" data-reply-to="${comment.id}">답글</button>` : ""}
        ${canReport ? `<button type="button" class="link-btn quiet" data-report-comment="${comment.id}">신고</button>` : ""}
        ${canDelete ? `<button type="button" class="link-btn quiet" data-delete-comment="${comment.id}">삭제</button>` : ""}
      </div>
    </div>`;
}

// 댓글을 루트 + 답글(한 단계)로 묶어서 그리기. 한 묶음(thread)씩 감싸서 대화 단위가 보이게
function renderComments(comments, post) {
  const roots = comments.filter((c) => !c.parent_id);
  const childrenOf = (id) => comments.filter((c) => c.parent_id === id);
  if (!roots.length) {
    return `<p class="empty-replies">아직 위로가 없어요. 첫 위로를 남겨 주세요.</p>`;
  }
  return roots
    .map(
      (root) => `
      <div class="thread">
        ${renderComment(root, post)}
        ${childrenOf(root.id).map((c) => renderComment(c, post, true)).join("")}
      </div>`,
    )
    .join("");
}

const aiReplyCount = (comments) =>
  comments.filter((c) => c.is_ai && c.parent_id).length;

// 신고 사유 선택 창. 선택한 사유 문자열 또는 취소 시 null
let reportDialog;
function askReportReason() {
  if (!reportDialog) {
    reportDialog = document.createElement("dialog");
    reportDialog.className = "report-dialog";
    reportDialog.innerHTML = `
      <form method="dialog">
        <h2>신고 사유를 골라 주세요</h2>
        <label><input type="radio" name="reportReason" value="욕설·비방" checked> 욕설·비방</label>
        <label><input type="radio" name="reportReason" value="개인정보 노출"> 개인정보 노출</label>
        <label><input type="radio" name="reportReason" value="광고·도배"> 광고·도배</label>
        <label><input type="radio" name="reportReason" value="기타"> 기타 직접 입력</label>
        <input id="reportEtc" maxlength="200" placeholder="사유를 적어 주세요 (1~200자)" hidden>
        <div class="row">
          <button value="cancel" class="soft" formnovalidate>취소</button>
          <button value="ok">신고하기</button>
        </div>
      </form>`;
    document.body.append(reportDialog);
    const etc = reportDialog.querySelector("#reportEtc");
    reportDialog.querySelectorAll("[name=reportReason]").forEach((radio) => {
      radio.onchange = () => {
        etc.hidden = radio.value !== "기타" || !radio.checked;
        etc.required = !etc.hidden;
        if (!etc.hidden) etc.focus();
      };
    });
  }

  const form = reportDialog.querySelector("form");
  form.reset();
  reportDialog.querySelector("#reportEtc").hidden = true;
  reportDialog.querySelector("#reportEtc").required = false;

  return new Promise((resolve) => {
    reportDialog.onclose = () => {
      if (reportDialog.returnValue !== "ok") return resolve(null);
      const choice = form.querySelector("[name=reportReason]:checked").value;
      const reason =
        choice === "기타"
          ? reportDialog.querySelector("#reportEtc").value.trim()
          : choice;
      resolve(reason || null);
    };
    reportDialog.returnValue = "";
    reportDialog.showModal();
  });
}

async function report(targetType, targetId, button) {
  const reason = await askReportReason();
  if (!reason) return;
  button.disabled = true;
  try {
    await api("/reports", {
      method: "POST",
      body: { target_type: targetType, target_id: targetId, reason },
    });
    toast("신고가 접수됐어요. 섬지기가 확인할게요");
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function appeal(targetType, targetId, button) {
  const input = prompt("이의 제기 사유를 적어 주세요. (1~200자)");
  if (input === null) return;
  const reason = input.trim();
  if (!reason || reason.length > 200) {
    alert("이의 제기 사유는 1~200자로 입력해주세요.");
    return;
  }
  button.disabled = true;
  try {
    await api("/reports/appeal", {
      method: "POST",
      body: { target_type: targetType, target_id: targetId, reason },
    });
    toast("이의 제기를 보냈어요. 섬지기가 다시 살펴볼게요");
  } catch (error) {
    // 409(이미 이의를 제기함) 등은 서버 문구 그대로
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

// 상세 하단 "비슷한 고민을 먼저 겪은 이웃들" 카드
async function renderSimilar(postId) {
  const box = el("similarPosts");
  if (!box) return;
  try {
    if (!similarCache.has(postId)) {
      similarCache.set(postId, await api(`/posts/${postId}/similar`));
    }
    const items = similarCache.get(postId).slice(0, 3);
    if (el("similarPosts") !== box || !items.length) return;
    // 댓글과 헷갈리지 않게: 구역 설명 + "다른 글로 이동"하는 링크 카드 모양
    box.innerHTML = `
      <h3 class="section-title">둘러보기 <span class="count">비슷한 고민을 먼저 겪은 이웃들</span></h3>
      <p class="section-note">이 글과 비슷한 다른 이웃의 고민이에요. 누르면 그 글로 이동해요.</p>
      ${items
        .map(
          (item) => `
        <button type="button" class="similar-card" data-similar="${item.id}">
          <strong>${escapeText(item.title)}</strong>
          <span>${escapeText(item.preview || "")}</span>
          <small><span>위로 ${item.comment_count}</span><span class="go">읽어 보기 →</span></small>
        </button>`,
        )
        .join("")}`;
    box.querySelectorAll("[data-similar]").forEach((card) => {
      card.onclick = () => showPost(Number(card.dataset.similar));
    });
  } catch (error) {
    // 비슷한 글은 보조 기능이라 실패해도 상세 화면은 그대로 둠
    console.error(error.message);
  }
}

// 온도(AI)의 이어 답글을 1.5초 간격으로 최대 5번 확인
async function waitForAiReply(postId, baseline) {
  const token = ++aiPollToken;
  aiPending = { postId, baseline };
  const stillHere = () =>
    token === aiPollToken && currentPostId === postId && el("detail").open;

  try {
    for (let i = 0; i < 5; i++) {
      await sleep(1500);
      if (!stillHere()) return;
      const post = await showPost(postId, false);
      if (!stillHere()) return;
      if (post && aiReplyCount(post.comments || []) > baseline) return;
    }
  } finally {
    if (token === aiPollToken) {
      aiPending = null;
      el("aiTyping")?.remove();
    }
  }
}

async function showPost(id, open = true) {
  const requestId = ++detailRequestId;

  if (currentPostId !== id) {
    replyTo = null;
    aiPollToken++; // 다른 글을 열면 이전 글의 AI 답글 대기는 멈춤
    aiPending = null;
  }
  currentPostId = id;

  if (open) {
    el("detailBody").textContent = "고민을 불러오는 중...";
    if (!el("detail").open) el("detail").showModal();
  }

  try {
    const post = await api(`/posts/${encodeURIComponent(id)}`);

    if (requestId !== detailRequestId) return null;

    const author = post.author;
    const nickname = author?.nickname || "떠난 이용자";
    const animal = CHARACTER_KEYS.indexOf(author?.character);
    const way = COMFORT_KEYS.indexOf(post.comfort_type);
    const comments = post.comments || [];
    const showTyping =
      aiPending?.postId === post.id &&
      aiReplyCount(comments) <= aiPending.baseline;
    const draftText = el("reply")?.value || "";

    // 구역 ① 고민 본문: 흰 카드. 신고·차단·수정·삭제는 오른쪽 위 "⋯" 메뉴 안으로
    el("detailBody").innerHTML = `
      <div class="between detail-head detail-topbar">
        <strong class="detail-crumb">고민 읽기</strong>
        <button data-close="detail" class="soft detail-close">닫기</button>
      </div>


      ${post.is_mine && post.status === "hidden" ? `
        <div class="hidden-banner" role="status">
          <span>신고가 쌓여 잠시 가려졌어요. 섬지기가 확인하는 동안 다른 이웃에게는 보이지 않아요.</span>
          <button type="button" class="soft" id="appealPost">이의 제기</button>
        </div>
      ` : ""}

      <!-- 큰 카드 하나 = 글 + 위로 (안쪽은 이어지게) / 둘러보기는 카드 밖에 따로 -->
      <div class="talk-card">
      <article class="post-main" aria-label="작성자의 고민">
        <div class="row post-author">
          <img class="detail-avatar ${toneClass(author?.color)}" src="${img(animal)}" alt="">
          <!-- 첫 줄: 닉네임 + 칭호 / 둘째 줄: 직무 · 연차 -->
          <div class="author-text">
            <span class="author-line">
              <strong>${escapeText(nickname)}${post.is_mine ? ` <span class="me-tag">나</span>` : ""}</strong>
              <span class="badge-row">${titleBadge(author?.title)}</span>
            </span>
            ${author?.job || post.years ? `<span class="author-sub">
              ${author?.job ? `<span class="job-chip">${escapeText(author.job)}</span>` : ""}
              ${post.years ? `<small>${escapeText(post.years)}</small>` : ""}
            </span>` : ""}
          </div>
        </div>
        <h2 class="detail-title">${escapeText(post.title)}</h2>
        <p class="post-text">${escapeText(post.content)}</p>
        <div class="between post-foot">
          <small class="detail-meta">
            <span class="topic-chip">${escapeText(post.topic)}</span>
            ${post.visibility === "private" ? "나만보기" : escapeText(ways[way] || "")}
          </small>
          <span class="row post-foot-actions">
            ${post.visibility === "private" ? "" : `<button
              type="button"
              class="soft reaction-btn"
              id="reactionButton"
              aria-pressed="${post.reacted_by_me}"
            >
              ${post.reacted_by_me ? "♥" : "♡"} 공감 ${post.reaction_count}
            </button>`}
            ${post.is_mine ? `
              <button type="button" class="link-btn quiet" id="editServerPost">수정</button>
              <button type="button" class="link-btn quiet" id="deleteServerPost">삭제</button>
            ` : `
              <button type="button" class="link-btn quiet" id="reportServerPost">신고</button>
              ${author?.user_id ? `<button type="button" class="link-btn quiet" id="blockPostAuthor">차단</button>` : ""}
            `}
          </span>
        </div>
      </article>

      ${post.is_mine && post.visibility === "private" ? `
      <section class="private-chat talk-replies" id="privateChat" aria-labelledby="privateChatTitle">
        <h3 id="privateChatTitle">온도와 둘만의 이야기</h3>
        <p class="private-note">나만보기 글이라 이 대화는 나만 볼 수 있어요. 글을 공개로 바꿔도 이웃에게 보이지 않아요.</p>
        <div class="chat-log" id="chatLog" aria-live="polite">대화를 불러오는 중...</div>
        <form id="chatForm" class="row" hidden>
          <label class="sr-only" for="chatInput">온도에게 할 말</label>
          <input id="chatInput" maxlength="500" placeholder="편하게 이어서 이야기해 주세요" autocomplete="off">
          <button>보내기</button>
        </form>
        <small class="chat-remaining" id="chatRemaining"></small>
      </section>` : `
      <section class="replies talk-replies" aria-labelledby="repliesTitle">
        <h3 class="section-title" id="repliesTitle">이웃들의 위로 <span class="count">${
          comments.filter(comment => !comment.is_deleted).length
        }</span></h3>

        ${renderComments(comments, post)}

        ${showTyping ? `<p id="aiTyping" class="ai-typing" aria-live="polite">온도가 답글을 쓰고 있어요…</p>` : ""}

        ${post.visibility === "public" ? `
          <form id="replyForm" class="composer">
            <label for="reply" class="sr-only">위로 남기기</label>
            <p id="replyTarget" class="reply-target" hidden>
              <span></span><button type="button" class="plain" id="cancelReply" aria-label="답글 취소">✕</button>
            </p>
            <div class="row">
              <input
                id="reply"
                required
                maxlength="400"
                placeholder="따뜻한 위로를 남겨 주세요"
              >
              <button>남기기</button>
            </div>
          </form>
        ` : ""}
      </section>`}
      </div>
    `;

    if (post.is_mine && post.visibility === "private") setupPrivateChat(post.id);

    const body = el("detailBody");

    body.querySelectorAll("[data-delete-comment]").forEach(button => {
      button.onclick = async () => {
        if (!confirm("이 댓글을 삭제할까요?")) return;

        button.disabled = true;

        try {
          await api(
            `/posts/${post.id}/comments/${button.dataset.deleteComment}`,
            { method: "DELETE" }
          );

          await showPost(post.id, false);
          await renderFeed();
          toast("댓글을 삭제했어요.");
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      };
    });

    body.querySelectorAll("[data-thank-comment]").forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          const result = await api(
            `/posts/${post.id}/comments/${button.dataset.thankComment}/thanks`,
            { method: "POST" }
          );
          button.setAttribute("aria-pressed", String(result.thanked));
          button.textContent = result.thanked ? "♥ 고마워요" : "♡ 고마워요";
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      };
    });

    body.querySelectorAll("[data-report-comment]").forEach(button => {
      button.onclick = () =>
        report("comment", Number(button.dataset.reportComment), button);
    });

    body.querySelectorAll("[data-appeal-comment]").forEach(button => {
      button.onclick = () =>
        appeal("comment", Number(button.dataset.appealComment), button);
    });

    if (el("appealPost")) {
      el("appealPost").onclick = () => appeal("post", post.id, el("appealPost"));
    }

    if (el("reactionButton")) el("reactionButton").onclick = async () => {
      const button = el("reactionButton");
      if (button.disabled) return;

      button.disabled = true;

      try {
        const result = await api(`/posts/${post.id}/reactions`, {
          method: "POST"
        });

        button.setAttribute("aria-pressed", String(result.reacted));
        button.textContent =
          `${result.reacted ? "♥" : "♡"} 공감 ${result.reaction_count}`;
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    };

    if (post.is_mine) {
      el("editServerPost").onclick = () => {
        el("detail").close();

        editor({
          id: post.id,
          title: post.title,
          body: post.content,
          topic: post.topic,
          way: COMFORT_KEYS.indexOf(post.comfort_type),
          private: post.visibility === "private",
          years: post.years || ""
        });
      };

      el("deleteServerPost").onclick = async () => {
        if (!confirm("이 고민을 삭제할까요? 삭제 후에는 복구할 수 없어요.")) {
          return;
        }

        const button = el("deleteServerPost");
        button.disabled = true;

        try {
          await api(`/posts/${post.id}`, {
            method: "DELETE"
          });

          el("detail").close();

          await Promise.all([
            renderFeed(),
            loadNeighbors()
          ]);

          toast("고민을 삭제했어요.");
        } catch (error) {
          alert(error.message);
        } finally {
          button.disabled = false;
        }
      };
    }

    const reportButton = el("reportServerPost");
    if (reportButton) {
      reportButton.onclick = () => report("post", post.id, reportButton);
    }

    const blockButton = el("blockPostAuthor");

    if (blockButton) {
      blockButton.onclick = async () => {
        if (!confirm(`${nickname}님을 차단할까요? 이 이용자의 글과 댓글이 숨겨져요.`)) {
          return;
        }

        blockButton.disabled = true;

        try {
          await api("/blocks", {
            method: "POST",
            body: { user_id: author.user_id }
          });

          el("detail").close();

          await Promise.all([
            renderFeed(),
            loadNeighbors(),
            updateBadge()
          ]);

          toast("이용자를 차단했어요.");
        } catch (error) {
          alert(error.message);
        } finally {
          blockButton.disabled = false;
        }
      };
    }

    const form = el("replyForm");
    if (!form) return post;

    const input = el("reply");
    input.value = draftText; // 폴링으로 다시 그려도 쓰던 내용 유지

    // 답글 대상 표시 ("○○님에게 답글 · 취소")
    const updateReplyTarget = () => {
      const target = el("replyTarget");
      const active = replyTo?.postId === post.id;
      target.hidden = !active;
      if (active) target.querySelector("span").textContent = `↳ ${replyTo.name}님에게 답글`;
      input.placeholder = active ? `${replyTo.name}님에게 답글을 남겨 주세요` : "따뜻한 위로를 남겨 주세요";
    };
    updateReplyTarget();

    body.querySelectorAll("[data-reply-to]").forEach(button => {
      button.onclick = () => {
        const target = comments.find(c => c.id === Number(button.dataset.replyTo));
        replyTo = {
          postId: post.id,
          id: target.id,
          name: target.is_ai ? "온도" : commentName(target)
        };
        updateReplyTarget();
        input.focus();
      };
    });

    el("cancelReply").onclick = () => {
      replyTo = null;
      updateReplyTarget();
      input.focus();
    };

    form.onsubmit = async event => {
      event.preventDefault();

      const content = input.value.trim();
      const button = form.querySelector("button:not(.plain)");

      if (!content || button.disabled) return;

      const parentId = replyTo?.postId === post.id ? replyTo.id : null;
      const parent = comments.find(c => c.id === parentId);
      const root = parent?.parent_id
        ? comments.find(c => c.id === parent.parent_id)
        : parent;
      const toAiThread = Boolean(parent && (parent.is_ai || root?.is_ai));

      button.disabled = true;
      button.textContent = "등록 중...";

      try {
        const result = await api(`/posts/${post.id}/comments`, {
          method: "POST",
          body: parentId ? { content, parent_id: parentId } : { content }
        });

        input.value = "";
        replyTo = null;

        if (result.ai_reply_pending === true) {
          aiPending = { postId: post.id, baseline: aiReplyCount(comments) };
        }

        await showPost(post.id, false);
        await renderFeed();
        toast(parentId ? "답글을 남겼어요." : "위로를 남겼어요.");

        showCrisisSupport(result.crisis_support);

        if (result.ai_reply_pending === true) {
          waitForAiReply(post.id, aiReplyCount(comments));
        } else if (post.is_mine && toAiThread) {
          toast("이제 이웃들이 함께할 거예요");
        }
      } catch (error) {
        alert(
          [
            error.message,
            error.detail?.suggestion
          ].filter(Boolean).join("\n\n")
        );
      } finally {
        button.disabled = false;
        button.textContent = "남기기";
      }
    };

    return post;
  } catch (error) {
    if (requestId !== detailRequestId) return null;
    el("detailBody").textContent = error.message;
    return null;
  }
}

// "⋯" 메뉴: 메뉴 밖을 누르거나 메뉴 안 버튼을 누르면 닫힘
document.addEventListener("click", (event) => {
  document.querySelectorAll(".more-menu[open]").forEach((menu) => {
    if (!menu.contains(event.target) || event.target.closest(".more-list button")) {
      menu.open = false;
    }
  });
});

// 상세 창을 닫으면 AI 답글 대기도 멈춤
el("detail").addEventListener("close", () => {
  currentPostId = null;
  aiPollToken++;
  aiPending = null;
});

let serverUnreadCount = 0;

async function updateBadge({ announce = false } = {}) {
  try {
    const result = await api("/notifications?limit=1");

    if (announce && result.unread_count > serverUnreadCount) {
      toast("새 알림이 왔어요. 프로필의 알림에서 확인해 보세요");
    }
    serverUnreadCount = result.unread_count;
    el("badge").textContent = serverUnreadCount;
    el("badge").hidden = serverUnreadCount === 0;
  } catch (error) {
    el("badge").hidden = true;
    console.error(error.message);
  }
}

async function loadMyPosts(selectedTab) {
  const container = el("myServerPosts");
  if (!container) return;

  const visibility = selectedTab === "private" ? "private" : "public";

  try {
    const posts = await api(
      `/users/me/posts?visibility=${visibility}`
    );

    // 응답을 기다리는 동안 탭을 바꿨다면 이전 화면을 갱신하지 않음
    if (
      el("myServerPosts") !== container ||
      tab !== selectedTab
    ) return;

    container.innerHTML = posts.map(post => worryCard({
      ...post,
      author: { nickname: me.nick },
    }, { unread: post.has_unread })).join("") || "<p>작성한 고민이 없어요.</p>";
  } catch (error) {
    if (el("myServerPosts") === container) {
      container.textContent = error.message;
    }
  }
}

// 알림 종류별 문구와 표시할 이름 (이름이 없으면 null)
function notificationText(n) {
  const who = n.is_ai ? "온도" : n.actor?.nickname || null;
  switch (n.type) {
    case "comment":
      return { text: n.is_ai ? "온도가 첫 댓글을 남겼어요" : "내 고민에 댓글이 달렸어요", name: who };
    case "reply":
      return { text: n.is_ai ? "온도가 답했어요" : "내 댓글에 답글이 달렸어요", name: who };
    case "reaction":
      return { text: "이웃이 내 고민에 공감했어요", name: n.actor?.nickname || null };
    case "invite":
      return { text: "비슷한 고민을 가진 이웃이 글을 올렸어요. 경험을 나눠 줄래요?", name: null };
    case "thanks":
      return { text: "글쓴이가 내 댓글에 고마워했어요", name: null };
    case "hidden":
      return { text: "신고가 쌓여 내 글이나 댓글을 잠시 가렸어요. 이의가 있으면 글에서 알려 주세요", name: "섬지기" };
    case "restored":
      return { text: "살펴보니 문제가 없어서 다시 보이게 했어요", name: "섬지기" };
    default:
      return { text: "새 알림", name: null };
  }
}

async function loadNotifications() {
  const container = el("serverAlerts");
  if (!container) return;

  try {
    const result = await api("/notifications?limit=50");

    if (el("serverAlerts") !== container) return;

    serverUnreadCount = result.unread_count;
    el("badge").textContent = serverUnreadCount;
    el("badge").hidden = serverUnreadCount === 0;

    // 안 읽은 알림을 맨 위로 (같은 묶음 안에서는 원래 순서인 최신순 유지)
    const sortedNotifications = [...result.notifications].sort((a, b) => Number(a.is_read) - Number(b.is_read));
    container.innerHTML = sortedNotifications.map(notification => {
      const { text, name } = notificationText(notification);
      return `
      <button
        class="alert-row ${notification.is_read ? "is-read" : "is-unread"}"
        data-notification-post="${notification.post_id}"
      >
        <span>
          <strong>${notification.is_read ? "" : `<em class="alert-new">새 알림</em>`}${escapeText(notification.post_title)}</strong>
          <small>
            ${escapeText(text)}${name ? ` · ${escapeText(name)}` : ""}
          </small>
          <small>
            ${escapeText(
              new Date(notification.created_at).toLocaleString("ko-KR")
            )}
          </small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    `;
    }).join("") || "<p>아직 받은 알림이 없어요.</p>";

    container.querySelectorAll("[data-notification-post]")
      .forEach(button => {
        button.onclick = async () => {
          button.disabled = true;

          try {
            const postId = Number(button.dataset.notificationPost);

            await api("/notifications/read", {
              method: "POST",
              body: { post_id: postId }
            });

            await showPost(postId);
            await updateBadge();

            if (el("serverAlerts") === container) {
              await loadNotifications();
            }
          } catch (error) {
            alert(error.message);
          } finally {
            button.disabled = false;
          }
        };
      });
  } catch (error) {
    if (el("serverAlerts") === container) {
      container.textContent = error.message;
    }
  }
}

async function showBlockedUsers() {
  // 이전 글 상세 요청이 차단 목록을 덮어쓰지 않도록 무효화
  const requestId = ++detailRequestId;
  const container = el("detailBody");

  container.textContent = "차단 목록을 불러오는 중...";
  if (!el("detail").open) el("detail").showModal();

  try {
    const users = await api("/blocks");

    if (requestId !== detailRequestId) return;

    container.innerHTML = `
      <div class="between">
        <h2>차단한 이용자</h2>
        <button class="soft" data-close="detail">닫기</button>
      </div>

      ${users.map(user => `
        <article class="reply">
          <strong>${escapeText(user.nickname)}</strong>
          <button
            type="button"
            class="soft"
            data-unblock-user="${user.user_id}"
          >차단 해제</button>
        </article>
      `).join("") || "<p>차단한 이용자가 없어요.</p>"}
    `;

    container.querySelectorAll("[data-unblock-user]")
      .forEach(button => {
        button.onclick = async () => {
          if (!confirm("이 이용자의 차단을 해제할까요?")) return;

          button.disabled = true;

          try {
            await api(`/blocks/${button.dataset.unblockUser}`, {
              method: "DELETE"
            });

            await Promise.all([
              renderFeed(),
              loadNeighbors(),
              updateBadge()
            ]);

            if (requestId === detailRequestId && el("detail").open) {
              await showBlockedUsers();
            }

            toast("차단을 해제했어요.");
          } catch (error) {
            alert(error.message);
          } finally {
            button.disabled = false;
          }
        };
      });
  } catch (error) {
    if (requestId === detailRequestId) {
      container.textContent = error.message;
    }
  }
}

async function loadMyComments() {
  const container = el("myServerComments");
  if (!container) return;

  try {
    const comments = await api("/users/me/comments");

    if (el("myServerComments") !== container) return;

    container.innerHTML = comments.map(comment => `
      <button type="button" class="card comment-card" ${comment.post_id === null ? "disabled" : `data-post="${comment.post_id}"`}>
        <small class="mode">${escapeText(new Date(comment.created_at).toLocaleString("ko-KR"))}</small>
        <strong>${comment.post_id === null ? "현재 볼 수 없는 글" : escapeText(comment.post_title)}</strong>
        <small class="comment-preview">${escapeText(comment.content)}</small>
      </button>
    `).join("") || "<p>아직 작성한 댓글이 없어요.</p>";
  } catch (error) {
    if (el("myServerComments") === container) {
      container.textContent = error.message;
    }
  }
}

// 내 프로필 패널이 화면 아래로 넘치지 않게: 실제 위치(top)에서 화면 끝까지만 높이를 주고 나머지는 패널 안 스크롤
function fitPersonal() {
  const section = el("personal");
  if (!section || section.hidden) return;
  const top = section.getBoundingClientRect().top;
  section.style.maxHeight = Math.max(220, window.innerHeight - top - 12) + "px";
}
window.addEventListener("resize", fitPersonal);

function personal(detail = null) {
  const section = el("personal");
  const unread = serverUnreadCount;
  const tabs = [
    ["alerts", unread ? "댓글 알림 " + unread : "댓글 알림"],
    ["private", "나만보기"],
    ["own", "내 고민글"],
    ["comments", "작성한 댓글"],
    ["titles", "칭호 도감"],
  ];
  const heading = detail
    ? "댓글 상세"
    : tab === "alerts"
      ? "댓글 알림"
      : (tabs.find(([id]) => id === tab) || tabs[0])[1];
  section.hidden = false;
  el("profile").setAttribute("aria-expanded", "true");
  requestAnimationFrame(fitPersonal);
  let content;
  if (detail) {
    content = `<article><strong>${escapeText(detail.title)}</strong><small>${escapeText(detail.name)}</small><p>${escapeText(detail.body)}</p></article><div class="row"><button data-tab="alerts" class="soft">← 알림 목록</button></div>`;
    } else if (tab === "alerts") {
    content = '<div id="serverAlerts">알림을 불러오는 중...</div>';
  } else if (tab === "comments") {
  content = '<div id="myServerComments">내 댓글을 불러오는 중...</div>';
  } else if (tab === "titles") {
    content = '<div id="titleBook" class="title-book">칭호를 불러오는 중...</div>';
  } else {
    content = '<div id="myServerPosts">내 고민을 불러오는 중...</div>';
  }
  section.innerHTML = `<div class="between"><h3>${heading}</h3><button id="hideProfile" class="soft">닫기</button></div>
    ${detail ? "" : '<p id="mySummary" class="my-summary">활동 요약을 불러오는 중...</p>'}
    ${detail ? "" : '<div class="row personal-tabs">' + tabs.map(([id, label]) => `<button data-tab="${id}" ${id === tab ? "" : 'class="soft"'} aria-pressed="${id === tab}">${label}</button>`).join("") + "</div>"}${content}`;
  if (!detail) loadMySummary();
  if (!detail && tab === "titles") loadTitleBook();
  if (!detail && (tab === "own" || tab === "private")) {
    loadMyPosts(tab);
  }
  if (!detail && tab === "alerts") {
  loadNotifications();
}
  const logoutButton = document.createElement("button");
logoutButton.type = "button";
logoutButton.className = "soft logout-btn";
logoutButton.textContent = "로그아웃";

logoutButton.onclick = () => {
  logoutButton.disabled = true;
  logout();
};

const blocksButton = document.createElement("button");
blocksButton.type = "button";
blocksButton.className = "link-btn quiet";
blocksButton.textContent = "차단한 이용자";
blocksButton.onclick = showBlockedUsers;

const characterButton = document.createElement("button");
characterButton.type = "button";
characterButton.className = "link-btn quiet";
characterButton.textContent = "캐릭터 수정";
// 가입할 때 쓰던 캐릭터 고르기 화면으로 보냄. 저장하면 지금 보던 섬으로 돌아오게 주소를 기억해 둠
characterButton.onclick = () => {
  sessionStorage.setItem("ondo-edit-return", location.pathname.split("/").pop() + location.search);
  location.href = "index.html#edit-character";
};

// 탈퇴: 서버(DELETE /auth/me)가 이메일·닉네임을 지우고 나만보기 글·공감·알림·차단을 삭제.
// 공개 글과 댓글은 대화 흐름이 끊기지 않게 "떠난 이용자"로 남는다
const withdrawButton = document.createElement("button");
withdrawButton.type = "button";
withdrawButton.className = "link-btn quiet withdraw-btn";
withdrawButton.textContent = "탈퇴하기";
withdrawButton.onclick = async () => {
  const ok = confirm(
    "정말 탈퇴할까요?\n\n· 이메일·닉네임이 지워지고 되돌릴 수 없어요.\n· 나만보기 고민과 알림은 삭제돼요.\n· 공개 고민과 댓글은 '떠난 이용자'로 남아요.",
  );
  if (!ok) return;
  withdrawButton.disabled = true;
  try {
    await api("/auth/me", { method: "DELETE" });
    clearAuth();
    alert("탈퇴했어요. 그동안 함께해 주셔서 고마워요.");
    location.replace("index.html");
  } catch (error) {
    withdrawButton.disabled = false;
    toast(error.message);
  }
};

// 아래 줄: 왼쪽에 작은 글자 링크(캐릭터 수정 · 차단한 이용자 · 탈퇴하기), 오른쪽 끝에 로그아웃
const foot = document.createElement("div");
foot.className = "personal-foot";
const links = document.createElement("span");
links.append(characterButton, blocksButton, withdrawButton);
foot.append(links, logoutButton);
section.append(foot);
if (!detail && tab === "comments") {
  loadMyComments();
}
}

// 마이페이지 상단 활동 요약
async function loadMySummary() {
  const box = el("mySummary");
  if (!box) return;
  try {
    const s = await api("/users/me/summary");
    if (el("mySummary") !== box) return;
    box.textContent = `작성한 글 ${s.post_count}개 · 받은 고마움 ${s.thanks_received}번`;
    box.title = "받은 고마움: 내 고민에 남긴 위로에 작성자가 '고마워요'를 누른 횟수";
  } catch (error) {
    if (el("mySummary") === box) box.textContent = "활동 요약을 불러오지 못했어요.";
  }
}

// 칭호 도감: 얻은 칭호는 색으로, 아직 못 얻은 칭호는 진행도와 함께. 얻은 칭호를 누르면 대표 칭호로
const TIER_LABELS = { 1: "새싹", 2: "따뜻한", 3: "빛나는", 4: "전설" };
async function loadTitleBook(data = null) {
  const box = el("titleBook");
  if (!box) return;
  try {
    const book = data || (await api("/users/me/titles"));
    if (el("titleBook") !== box) return;
    const tiers = [1, 2, 3, 4].map((tier) => {
      const items = book.items.filter((t) => t.tier === tier);
      return `
        <section class="title-tier">
          <h4>${TIER_LABELS[tier]} 칭호</h4>
          <div class="title-grid">
            ${items.map((t) => `
              <button type="button" class="title-card tier-${t.tier} ${t.earned ? "earned" : "locked"}"
                data-title-key="${escapeText(t.key)}" ${t.earned ? "" : "disabled"}
                aria-pressed="${book.current?.key === t.key}"
                aria-label="${escapeText(t.name)}${t.earned ? " (얻음, 누르면 대표 칭호로)" : ` (${t.progress}/${t.need})`}">
                <span class="title-icon${TITLE_ICON_KEYS.has(t.key) ? " has-img" : ""}" aria-hidden="true">${TITLE_ICON_KEYS.has(t.key) ? titleIcon(t, "title-icon-img") : ""}</span>
                <strong>${escapeText(t.name)}</strong>
                <small>${escapeText(t.desc)}</small>
                ${t.earned
                  ? (book.current?.key === t.key ? '<em class="title-current">대표 칭호</em>' : "")
                  : `<span class="title-progress" aria-hidden="true"><i style="width:${Math.round((t.progress / t.need) * 100)}%"></i></span>
                     <small class="title-count">${escapeText(t.stat_label)} ${t.progress}/${t.need}</small>`}
              </button>`).join("")}
          </div>
        </section>`;
    }).join("");
    box.innerHTML = `
      <div class="title-now">
        <span>지금 대표 칭호</span>
        ${book.current ? titleBadge(book.current) : '<small>아직 칭호가 없어요. 고민을 나누거나 위로를 건네 보세요.</small>'}
        <small>${book.earned_count}/${book.items.length}개 얻음${book.chosen_key ? "" : " · 자동으로 가장 높은 칭호를 보여 줘요"}</small>
        ${book.chosen_key ? '<button type="button" class="link-btn" id="titleAuto">자동으로 되돌리기</button>' : ""}
      </div>
      ${tiers}`;
    const choose = async (key) => {
      try {
        const next = await api("/users/me/title", { method: "PATCH", body: { key } });
        loadTitleBook(next);
        loadNeighbors();
        toast(key ? "대표 칭호를 바꿨어요" : "가장 높은 칭호를 자동으로 보여 줄게요");
      } catch (error) {
        toast(error.message);
      }
    };
    box.querySelectorAll(".title-card.earned").forEach((card) => {
      card.onclick = () => choose(card.dataset.titleKey);
    });
    el("titleAuto")?.addEventListener("click", () => choose(null));
  } catch (error) {
    if (el("titleBook") === box) box.textContent = "칭호를 불러오지 못했어요.";
  }
}

// 설정 탭: "비슷한 고민 초대 받기" (바꾸면 바로 저장)
async function setupInviteSetting(form) {
  const label = document.createElement("label");
  label.className = "invite-setting";
  label.innerHTML = '<input type="checkbox" id="acceptInvites" disabled> 비슷한 고민 초대 받기';
  form.after(label);
  const box = label.querySelector("input");

  try {
    const profile = await api("/auth/me");
    box.checked = profile.accept_invites !== false;
    box.disabled = false;
  } catch (error) {
    label.append(" (불러오지 못했어요)");
    return;
  }

  box.onchange = async () => {
    box.disabled = true;
    try {
      const updated = await api("/users/me", {
        method: "PATCH",
        body: { accept_invites: box.checked }
      });
      box.checked = updated.accept_invites !== false;
      toast(box.checked ? "비슷한 고민 초대를 받을게요." : "비슷한 고민 초대를 받지 않을게요.");
    } catch (error) {
      box.checked = !box.checked;
      alert(error.message);
    } finally {
      box.disabled = false;
    }
  };
}

// 설정 탭: 🎨 팔레트를 누르면 캐릭터 색감을 고를 수 있음 (바로 저장, 이웃에게도 보임)
function setupColorPalette(form) {
  const current = () => me.color || "original";
  const wrap = document.createElement("div");
  wrap.className = "color-palette";
  wrap.innerHTML = `
    <button type="button" class="soft" id="paletteToggle" aria-expanded="false" aria-controls="paletteOptions">색감 고르기</button>
    <div id="paletteOptions" class="palette-options" role="group" aria-label="캐릭터 색감" hidden>
      ${CHARACTER_COLORS.map(([key, label]) => `
        <button type="button" data-color="${key}" aria-pressed="${key === current()}">
          <img class="${toneClass(key)}" src="${img(me.animal)}" alt="">
          <span>${label}</span>
        </button>`).join("")}
    </div>`;
  form.after(wrap);

  const toggle = wrap.querySelector("#paletteToggle");
  const options = wrap.querySelector("#paletteOptions");
  toggle.onclick = () => {
    options.hidden = !options.hidden;
    toggle.setAttribute("aria-expanded", String(!options.hidden));
  };

  options.querySelectorAll("[data-color]").forEach((button) => {
    button.onclick = async () => {
      const color = button.dataset.color;
      if (color === current()) return;
      options.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        const updated = await api("/users/me", { method: "PATCH", body: { color } });
        if (updated.color !== color) {
          // 아직 색감을 모르는 이전 서버
          toast("서버 업데이트 후 색감을 저장할 수 있어요.");
          return;
        }
        me.color = color;
        saveProfile(me);
        el("avatar").className = toneClass(me.color);
        options.querySelectorAll("[data-color]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.color === color)),
        );
        loadNeighbors(); // 지도 위 내 캐릭터에도 바로 반영
        toast("캐릭터 색감을 바꿨어요.");
      } catch (error) {
        alert(error.message);
      } finally {
        options.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    };
  });
}

function setupProfileSettings(section) {
  let selectedAnimal = me.animal;
  let requestId = 0;
  let saving = false;

  const form = el("profileSettings");
  const nick = el("profileNick");
  const submit = form.querySelector("button.wide");
  const buttons = [...section.querySelectorAll("[data-profile-animal]")];

  setupInviteSetting(form);
  setupColorPalette(form);

  nick.readOnly = true;
  nick.maxLength = 40;

  const shuffle = document.createElement("button");
  shuffle.type = "button";
  shuffle.className = "soft";
  shuffle.textContent = "다시 뽑기";
  nick.after(shuffle);

  async function recommendProfileNickname() {
    if (saving) return;

    const currentRequest = ++requestId;
    submit.disabled = true;
    nick.value = "";
    nick.placeholder = "닉네임을 추천받고 있어요...";

    try {
      const result = await api(
        `/auth/nickname?character=${CHARACTER_KEYS[selectedAnimal]}`,
        { auth: false }
      );

      if (currentRequest !== requestId) return;

      nick.value = result.nickname;
      submit.disabled = false;
    } catch (error) {
      if (currentRequest !== requestId) return;

      nick.placeholder = "다시 뽑기를 눌러주세요.";
      alert(error.message);
    }
  }

  shuffle.onclick = recommendProfileNickname;

  for (const button of buttons) {
    button.onclick = () => {
      if (saving) return;

      selectedAnimal = Number(button.dataset.profileAnimal);

      for (const choice of buttons) {
        choice.setAttribute("aria-pressed", String(choice === button));
      }

      recommendProfileNickname();
    };
  }

  form.onsubmit = async event => {
    event.preventDefault();
    if (saving || submit.disabled || !nick.value.trim()) return;

    saving = true;
    submit.disabled = true;
    shuffle.disabled = true;
    submit.textContent = "저장 중...";

    try {
      const updated = await api("/users/me", {
        method: "PATCH",
        body: {
          character: CHARACTER_KEYS[selectedAnimal],
          nickname: nick.value.trim()
        }
      });

      me.nick = updated.nickname;
      me.animal = CHARACTER_KEYS.indexOf(updated.character);

      saveProfile(me);

      el("myName").textContent = me.nick;
      el("avatar").src = img(me.animal);
  el("avatar").className = toneClass(me.color);

      await Promise.all([
        renderFeed(),
        loadNeighbors()
      ]);

      if (section.open) section.close();

      toast("캐릭터와 닉네임을 변경했어요.");
    } catch (error) {
      alert(error.message);
    } finally {
      saving = false;
      submit.disabled = false;
      shuffle.disabled = false;
      submit.textContent = "변경사항 저장";
    }
  };
}

// 캐릭터 수정은 좁은 프로필 패널 대신 큰 창에서. 기존 설정 폼(setupProfileSettings)을 그대로 씀
function openCharacterSettings() {
  let dialog = el("characterDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "characterDialog";
    dialog.className = "paper character-dialog";
    dialog.setAttribute("aria-labelledby", "characterDialogTitle");
    document.body.append(dialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-close-character]")) dialog.close();
    });
  }
  dialog.innerHTML = `<div class="between"><h2 id="characterDialogTitle">캐릭터 수정</h2><button type="button" class="soft" data-close-character>닫기</button></div>
    <form id="profileSettings" class="profile-settings">
      <label for="profileNick">닉네임</label><input id="profileNick" maxlength="18" required value="${escapeText(me.nick)}">
      <strong>캐릭터</strong><div class="profile-character-grid">${characterNames.map((name, index) => `<button type="button" data-profile-animal="${index}" aria-label="${name}" aria-pressed="${index === me.animal}"><img class="${toneClass(me.color)}" src="${img(index)}" alt=""><span>${name}</span></button>`).join("")}</div>
      <button class="wide">변경사항 저장</button></form>`;
  setupProfileSettings(dialog);
  closeProfile();
  dialog.showModal();
}

function closeProfile() {
  el("personal").hidden = true;
  el("profile").setAttribute("aria-expanded", "false");
}
function updateTopicSelection() {
  el("topicSelection").textContent = selectedTopic
    ? "선택한 주제 · " + selectedTopic
    : "세부 주제를 선택해 주세요.";
  el("topicSelection").classList.toggle("needs-topic", false);
  for (const category of el("categories").querySelectorAll(".category")) {
    const picked = Array.from(category.querySelectorAll("[data-category-topic]")).some(
      (button) => button.dataset.categoryTopic === selectedTopic,
    );
    category.classList.toggle("selected", picked);
    // 고른 세부 주제가 이 분류 안에 있으면 분류 이름 대신 세부 주제를 보여 줌 (다시 열면 다른 세부 주제로 바꿀 수 있음)
    const summary = category.querySelector("summary");
    summary.textContent = picked ? selectedTopic : summary.dataset.group;
    summary.title = picked ? `${summary.dataset.group} · ${selectedTopic}` : "";
  }
  for (const button of el("categories").querySelectorAll(
    "[data-category-topic]",
  )) {
    button.setAttribute(
      "aria-pressed",
      button.dataset.categoryTopic === selectedTopic,
    );
  }
}
function setupCategories() {
  const list = el("categories");
  list.innerHTML = Object.entries(topics)
    .map(
      ([group, items]) =>
        `<details class="category" name="worry-category"><summary data-group="${group}">${group}</summary><div class="topic-options">
      ${items.map((topic) => `<button type="button" data-category-topic="${topic}" aria-pressed="false">${topic}</button>`).join("")}
    </div></details>`,
    )
    .join("");
  list.onclick = (event) => {
    const button = event.target.closest("[data-category-topic]");
    if (!button) return;
    selectedTopic = button.dataset.categoryTopic;
    const category = button.closest("details");
    category.open = false;
    updateTopicSelection();
    category.querySelector("summary").focus();
  };
}
function updateDraftCounts() {
  el("titleCount").textContent = el("postTitle").value.length + " / 40";
}
function showFeed(open) {
  el("feedPanel").hidden = !open;
  el("feedToggle").setAttribute("aria-expanded", open);
}
let bodyPlaceholder = null;
function editor(p = null) {
  editing = p?.id ?? null;
  el("postForm").reset();
  el("editorTitle").textContent = p
    ? "고민 수정"
    : "어떤 고민을 나누고 싶나요?";
  el("postTitle").value = p?.title || "";
  el("body").value = p?.body || "";
  if (bodyPlaceholder === null) bodyPlaceholder = el("body").placeholder;
  el("body").placeholder = bodyPlaceholder; // 섬지기 질문으로 바꿨던 안내를 되돌림
  el("postTitle").setCustomValidity("");
  el("body").setCustomValidity("");
  el("privatePost").checked = Boolean(p?.private);
  selectedTopic = p?.topic || "";
  for (const category of el("categories").querySelectorAll("details"))
    category.open = false;
  updateTopicSelection();
  el("comfort").querySelectorAll("input")[p?.way ?? 0].checked = true;
  el("shareYears").checked = p ? Boolean(p.years) : true;
  updateDraftCounts();
  el("editor").show();
}
if (me && authToken()) {
  const heading = el("villageName");
  const title = config.title(me, jobNames);
  heading.textContent = title.heading;
  el("zoomVillageName").textContent = title.zoom;
  heading.classList.toggle("long-name", heading.textContent.length > 15);
  el("myName").textContent = me.nick;
  el("avatar").src = img(me.animal);
  el("avatar").className = toneClass(me.color);

  setupCategories();
  // 받고 싶은 위로 ↔ 12간지 페르소나 칭호 연결 (들어주세요=💗 공감형 …)
  el("comfort").innerHTML = ways
    .map(
      (way, i) =>
        `<label class="toggle" title="${PERSONAS[COMFORT_KEYS[i]].label} 이웃이 잘 도와줘요"><input type="radio" name="way" value="${i}"> ${PERSONAS[COMFORT_KEYS[i]].icon} ${way}</label>`,
    )
    .join("");
  setupWorldGuide();
  // 글쓰기 창: 고민이 지도 어디에 놓이는지 안내
  const placeHint = document.createElement("p");
  placeHint.className = "place-hint";
  placeHint.textContent = "지금 내 캐릭터가 서 있는 자리에 고민이 놓여요.";
  [...el("postForm").querySelectorAll("button:not([type=button])")].pop()?.before(placeHint);
  el("profile").onclick = () =>
    el("personal").hidden ? personal() : closeProfile();
  el("compose").onclick = () =>
    el("editor").open ? el("editor").close() : editor();
  el("feedToggle").onclick = () => showFeed(el("feedPanel").hidden);
  const search = el("search");
  const filters = el("searchFilters");
  function chooseComfort(value) {
    comfortFilter = value;
    for (const button of filters.querySelectorAll("[data-way]")) {
      button.setAttribute("aria-pressed", button.dataset.way === value);
    }
  }
  // 고민 주제 칩: 다시 누르면 해제(전체)
  const categoryBox = el("categoryFilterOptions");
  if (categoryBox) {
    categoryBox.innerHTML = Object.keys(topics).map(group =>
      `<button type="button" data-filter-category="${escapeText(group)}" aria-pressed="false">${escapeText(group)}</button>`).join("");
  }
  function chooseCategory(value) {
    categoryFilter = value;
    for (const button of filters.querySelectorAll("[data-filter-category]")) {
      button.setAttribute("aria-pressed", String(button.dataset.filterCategory === value));
    }
  }
  el("query").onfocus = el("query").onclick = () => {
    filters.hidden = false;
  };
  document.addEventListener("pointerdown", (event) => {
    if (!search.contains(event.target)) filters.hidden = true;
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") filters.hidden = true;
  });
  filters.onclick = (event) => {
    const button = event.target.closest("[data-way]");
    if (button) chooseComfort(button.dataset.way);
    const category = event.target.closest("[data-filter-category]");
    if (category) chooseCategory(categoryFilter === category.dataset.filterCategory ? "" : category.dataset.filterCategory);
    if (event.target.closest("#filterReset")) {
      chooseComfort("");
      chooseCategory("");
    }
    if (event.target.closest("#filterApply")) search.requestSubmit();
  };
  search.onsubmit = (event) => {
    event.preventDefault();
    searchText = el("query").value.trim();
    filters.hidden = true;
    renderFeed();
    showFeed(true);
  };
  el("query").oninput = () => {
    if (!el("query").value) {
      searchText = "";
      renderFeed();
    }
  };
  function setWaitingOnly(value) {
    waitingOnly = value;
    el("waitingToggle").setAttribute("aria-pressed", String(value));
    el("waitingToggle").classList.toggle("soft", !value);
  }
  el("waitingToggle").onclick = () => {
    setWaitingOnly(!waitingOnly);
    renderFeed();
  };
  el("reset").onclick = () => {
    searchText = el("query").value = "";
    chooseComfort("");
    chooseCategory("");
    setWaitingOnly(false);
    renderFeed();
  };
  el("editor").addEventListener("keydown", (event) => {
    if (event.key === "Escape") el("editor").close();
  });
  const reviewDialog = el("reviewDialog");
  let pendingDraft = null;
  let serverReview = null; // 서버(BE)가 422 NEED_EDIT로 돌려준 점검 결과
  let reviewLoading = false;
  let reviewError = "";
  let reviewRequest = 0;
  let reviewTimer;
  async function checkPost(requestId) {
    try {
      const result = await api("/posts/check", {
        method: "POST",
        body: {
          title: pendingDraft.title,
          content: pendingDraft.body,
        },
      });
      if (requestId !== reviewRequest) return;
      serverReview = result;
    } catch (error) {
      if (requestId !== reviewRequest) return;
      reviewError = "서버 점검에 실패했어요. 그래도 게시할 수 있어요.";
    } finally {
      if (requestId === reviewRequest) {
        reviewLoading = false;
        renderReview();
      }
    }
  }
  function schedulePostCheck(delay = 350) {
    clearTimeout(reviewTimer);
    const requestId = ++reviewRequest;
    serverReview = null;
    reviewError = "";
    if (!pendingDraft || pendingDraft.private) {
      reviewLoading = false;
      renderReview();
      return;
    }
    reviewLoading = true;
    renderReview();
    reviewTimer = setTimeout(() => checkPost(requestId), delay);
  }
  let reviewFixTotal = 0; // 이번 점검 창에서 처음 찾은 문제 수 (몇 건 반영했는지 보여 주려고)
  const issueLabels = { PERSONAL_INFO: "개인정보·회사명", OFFENSIVE: "거친 표현", CRISIS: "위기 신호" };
  function showReviewResults(showResults) {
    el("suggestionPanel").hidden = showResults;
    el("resultPanel").hidden = !showResults;
  }
  el("showResults").onclick = () => {
    showReviewResults(true);
    el("resultHeading").focus();
  };
  let resumeDraft = false;
  el("yearsVisibility").hidden = !me.years;
  el("yearsPreview").textContent = me.years ? me.job + " · " + me.years : "";
  for (const field of ["postTitle", "body"])
    el(field).oninput = () => {
      el(field).setCustomValidity("");
      updateDraftCounts();
    };
  function setupReviewDraft() {
    const selectedGroup = Object.keys(topics).find((group) =>
      topics[group].includes(pendingDraft.topic),
    );
    const chip = (text, active) =>
      `<span class="review-chip${active ? " active" : ""}">${escapeText(text)}</span>`;
    const years = pendingDraft.years ? "연차 정보 공개" : "연차 정보 비공개";
    el("draftPreview").innerHTML = `
      <div class="review-chip-row" aria-label="고민 분야">${Object.keys(topics)
        .map((group) => chip(group === selectedGroup ? pendingDraft.topic : group, group === selectedGroup))
        .join("")}</div>
      <div class="editor-label"><label for="reviewDraftTitle">제목</label><small>필수 · 40자 이내</small></div>
      <div class="review-field review-field-title"><div class="review-edit"><span id="reviewTitleHighlight" aria-hidden="true"></span><input id="reviewDraftTitle" maxlength="40" required></div><small id="reviewTitleCount"></small></div>
      <small class="review-caption">읽는 사람이 상황을 바로 알 수 있도록, 겪고 있는 일을 한 문장으로 적어주세요.</small>
      <div class="editor-label"><label for="reviewDraftBody">편하게 고민을 적어주세요.</label><small>필수 · 1,000자 이내</small></div>
      <div class="review-field review-body"><div class="review-edit"><span id="reviewBodyHighlight" aria-hidden="true"></span><textarea id="reviewDraftBody" maxlength="1000" required></textarea></div></div>
      <div class="editor-label"><strong>받고 싶은 위로</strong></div>
      <div class="review-chip-row">${ways.map((way, index) => chip(way, index === pendingDraft.way)).join("")}</div>
      <div class="review-visibility"><strong>${years}</strong><small>${escapeText(pendingDraft.years ? pendingDraft.job + " · " + pendingDraft.years : "")}</small></div>
      ${pendingDraft.private ? "<small>나만보기로 저장돼요.</small>" : ""}`;
    for (const [field, id] of [
      ["title", "reviewDraftTitle"],
      ["body", "reviewDraftBody"],
    ]) {
      el(id).oninput = (event) => {
        pendingDraft[field] = event.target.value;
        schedulePostCheck();
      };
    }
  }
  // 기능 3. 12간지 보안관: 회사명·개인정보를 가려서 보여 주고, 가린 내용으로 고칠 수 있게 함
  function maskDraft(issues, replace) {
    const titleLength = pendingDraft.title.length;
    const parts = { title: pendingDraft.title, body: pendingDraft.body };
    const spans = { title: [], body: [] };
    for (const issue of issues) {
      const { start, end } = issue;
      if (Number.isInteger(start) && Number.isInteger(end) && end > start) {
        if (end <= titleLength) spans.title.push([start, end, issue]);
        else if (start > titleLength) spans.body.push([start - titleLength - 1, end - titleLength - 1, issue]);
        continue;
      }
      // 위치가 없으면 같은 글자를 찾아서 가림
      for (const field of ["title", "body"]) {
        if (!issue.text) continue;
        let index = parts[field].indexOf(issue.text);
        while (index !== -1) {
          spans[field].push([index, index + issue.text.length, issue]);
          index = parts[field].indexOf(issue.text, index + issue.text.length);
        }
      }
    }
    for (const field of ["title", "body"]) {
      // 뒤에서부터 바꿔야 앞쪽 위치가 어긋나지 않음
      for (const [start, end, issue] of spans[field].sort((a, b) => b[0] - a[0])) {
        parts[field] = parts[field].slice(0, start) + replace(issue, parts[field].slice(start, end)) + parts[field].slice(end);
      }
    }
    return parts;
  }

  // 문제 표현 하나를 무엇으로 바꿀지: 개인정보는 자연스러운 말로 가리고, 거친 표현은 지움
  function replacementFor(issue, text) {
    if (issue.type !== "PERSONAL_INFO") return "";
    if (/^(01[016789]|0\d{1,2})[-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(text)) return "[전화번호]";
    if (/@/.test(text)) return "[이메일]";
    if (/^\d{6}-?\d{7}$/.test(text)) return "[주민번호]";
    if ((issue.guide || "").startsWith("회사명 대신")) return "우리 회사";
    return "○○";
  }
  function fixLabel(issue) {
    if (issue.type !== "PERSONAL_INFO") return "거친 표현 지우기";
    const text = issue.text || "";
    if (/@|\d{3,4}[-\s.]?\d{4}/.test(text)) return "연락처 가리기";
    if ((issue.guide || "").startsWith("회사명 대신")) return "회사명 가리기";
    return "개인정보 가리기";
  }
  // 문제 구절이 들어 있는 문장을 찾아 [원래 문장, 고친 문장]을 만든다
  function fixPreview(issue) {
    const text = issue.text || "";
    const source = pendingDraft.body.includes(text) ? pendingDraft.body : pendingDraft.title;
    const at = text ? source.indexOf(text) : -1;
    if (at < 0) return { before: text, after: replacementFor(issue, text) };
    const from = Math.max(source.lastIndexOf("\n", at), ...[".", "!", "?"].map((m) => source.lastIndexOf(m, at - 1))) + 1;
    const ends = ["\n", ".", "!", "?"].map((m) => source.indexOf(m, at + text.length)).filter((i) => i >= 0);
    const to = ends.length ? Math.min(...ends) + 1 : source.length;
    const sentence = source.slice(from, to).trim();
    const after = sentence.split(text).join(replacementFor(issue, text)).replace(/[ \t]{2,}/g, " ").trim();
    // 지우고 나면 문장부호만 남는 경우는 '이 부분을 지워요'로 보여 줌
    return { before: sentence, after: /[\p{L}\p{N}]/u.test(after) ? after : "" };
  }
  function applyFixes(list, message) {
    const fixed = maskDraft(list, (issue, text) => replacementFor(issue, text));
    pendingDraft.title = fixed.title.replace(/[ \t]{2,}/g, " ").trim() || pendingDraft.title;
    pendingDraft.body = fixed.body.replace(/[ \t]{2,}/g, " ").trim();
    el("reviewDraftTitle").value = pendingDraft.title;
    el("reviewDraftBody").value = pendingDraft.body;
    schedulePostCheck();
    renderReview();
    toast(message);
  }

  // ON-DO 보안관 사자: 개인정보·거친 표현을 찾으면 통통 튀어나와서 알려 주고, 아래 항목에서 하나씩 '적용하기'
  function guardCard(issues) {
    const personal = issues.filter((issue) => issue.type === "PERSONAL_INFO").length;
    const rough = issues.length - personal;
    const found = [personal ? `회사명·개인정보 ${personal}곳` : "", rough ? `상처가 될 수 있는 표현 ${rough}곳` : ""]
      .filter(Boolean).join("과 ");
    return `<div class="guard-card lion-guide" role="alert">
      <img src="${img(CHARACTER_KEYS.indexOf("lion"))}" alt="ON-DO 보안관 사자">
      <div>
        <strong>ON-DO 보안관 · 사자</strong>
        <p>잠깐! ${found}을 찾았어요. 아래에서 하나씩 고치거나, 한 번에 고칠 수 있어요.</p>
        <button type="button" id="applyAllFixes">모두 적용하기</button>
      </div>
    </div>`;
  }
  function fixItems(issues, required) {
    return `<ol class="fix-list">${issues.map((issue, index) => {
      const { before, after } = fixPreview(issue);
      return `<li class="fix-item">
        <div class="fix-head">
          <span class="fix-no">${index + 1}</span>
          <span class="fix-badge${required ? " required" : ""}">${required ? "필수" : "안내"}</span>
          <strong>${escapeText(fixLabel(issue))}</strong>
          <button type="button" class="fix-apply" data-fix="${index}">✓ 적용하기</button>
        </div>
        <del>${escapeText(before)}</del>
        <p class="fix-after">↩ ${escapeText(after || "(이 부분을 지워요)")}</p>
        ${issue.guide ? `<small>${escapeText(issue.guide)}</small>` : ""}
      </li>`;
    }).join("")}</ol>`;
  }

  function renderReview() {
    const incomplete =
      !pendingDraft.title.trim() ||
      !pendingDraft.body.trim() ||
      pendingDraft.title.length > 40 ||
      pendingDraft.body.length > 1000;
    const blocked = serverReview?.ok === false;
    el("publishPost").disabled = Boolean(incomplete || reviewLoading || blocked);
    el("reviewStatus").textContent = pendingDraft.private
      ? "나만보기 글은 검사 없이 게시할 수 있어요."
      : incomplete
        ? "제목과 본문 길이를 확인해 주세요."
        : reviewLoading
          ? "서버에서 게시 전 점검을 진행하고 있어요."
          : reviewError
            ? reviewError
            : blocked
              ? "서버 점검에서 수정이 필요한 표현이 발견됐어요."
              : serverReview?.ok && serverReview.hint
                ? "게시할 수 있어요. 조금만 더 적어 주면 이웃이 위로하기 쉬워요."
              : serverReview?.ok
                ? "서버 점검을 통과했어요. 게시할 수 있어요."
                : "게시 전 점검을 준비하고 있어요.";

    const issueHits = (field) => {
      const hits = [];
      const titleLength = pendingDraft.title.length;
      for (const issue of serverReview?.issues || []) {
        const start = issue.start;
        const end = issue.end;
        if (Number.isInteger(start) && Number.isInteger(end) && end > start) {
          if (field === "title" && start >= 0 && end <= titleLength) {
            hits.push({ index: start, text: pendingDraft.title.slice(start, end) });
            continue;
          }
          if (field === "body" && start > titleLength) {
            const bodyStart = start - titleLength - 1;
            const bodyEnd = end - titleLength - 1;
            if (bodyStart >= 0 && bodyEnd <= pendingDraft.body.length) {
              hits.push({ index: bodyStart, text: pendingDraft.body.slice(bodyStart, bodyEnd) });
              continue;
            }
          }
        }
        if (!issue.text) continue;
        let index = pendingDraft[field].indexOf(issue.text);
        while (index !== -1) {
          hits.push({ index, text: issue.text });
          index = pendingDraft[field].indexOf(issue.text, index + issue.text.length);
        }
      }
      return hits.sort((a, b) => a.index - b.index);
    };
    const highlight = (field) => {
      let cursor = 0;
      let html = "";
      for (const hit of issueHits(field)) {
        if (hit.index < cursor || !hit.text) continue;
        html +=
          escapeText(pendingDraft[field].slice(cursor, hit.index)) +
          "<mark>" +
          escapeText(hit.text) +
          "</mark>";
        cursor = hit.index + hit.text.length;
      }
      return html + escapeText(pendingDraft[field].slice(cursor));
    };
    for (const [field, input, mirror] of [
      ["title", "reviewDraftTitle", "reviewTitleHighlight"],
      ["body", "reviewDraftBody", "reviewBodyHighlight"],
    ]) {
      if (el(input).value !== pendingDraft[field]) el(input).value = pendingDraft[field];
      el(mirror).innerHTML = highlight(field) + (field === "body" ? "&#8203;" : "");
    }
    el("reviewTitleCount").textContent = pendingDraft.title.length + " / 40";

    const issues = serverReview?.issues || [];
    el("reviewResultSummary").textContent = reviewLoading
      ? "서버 응답을 기다리는 중"
      : serverReview
        ? (reviewFixTotal = Math.max(reviewFixTotal, issues.length),
          reviewFixTotal > issues.length || issues.length
            ? `${reviewFixTotal}건 중 ${reviewFixTotal - issues.length}건 반영 · 남은 ${blocked ? "필수" : "안내"} ${issues.length}건`
            : "서버 점검 완료 · 문제 표현 없음")
        : reviewError || (pendingDraft.private ? "나만보기는 점검하지 않음" : "점검 결과 없음");
    el("reviewSuggestionSummary").textContent = serverReview?.suggestion || "";

    if (reviewLoading) {
      el("reviewResults").innerHTML = '<p class="review-note">게시할 수 있는 글인지 확인하고 있어요.</p>';
    } else if (reviewError) {
      el("reviewResults").innerHTML = `<p class="review-note">${escapeText(reviewError)}</p>`;
    } else if (serverReview) {
      // 내용이 부실해 보이면 막지 않고 '조금 더 적어 볼래요?'만 권한다 (기준은 BE app/draft_hint.py)
      const hint = serverReview.hint;
      const hintBox = hint && !blocked ? `<div class="draft-hint" role="note">
        <strong>조금만 더 적어 볼래요?</strong>
        <p>${escapeText(hint.message)}</p>
        <ul>${(hint.tips || []).map((tip) => `<li>${escapeText(tip)}</li>`).join("")}</ul>
        <div class="row"><button type="button" class="soft" data-hint-write>본문 더 적기</button><small>그대로 올려도 괜찮아요.</small></div>
      </div>` : "";
      const explain = `<div class="review-explain">
          <p>${escapeText(serverReview.reason || "수정이 필요한 표현이 있어요.")}</p>
          ${serverReview.suggestion ? `<p>${escapeText(serverReview.suggestion)}</p>` : ""}
        </div>`;
      el("reviewResults").innerHTML = hintBox + (issues.length
        ? guardCard(issues) + explain + fixItems(issues, blocked)
          + '<p class="fix-footnote">제안을 적용하지 않고 직접 고쳐도, 점검을 다시 통과하면 게시할 수 있어요.</p>'
        : `<div class="review-result check-row"><strong><span class="check-icon" aria-hidden="true">✓</span>서버 점검 통과</strong></div>`);
      el("applyAllFixes")?.addEventListener("click", () => applyFixes(issues, "보안관 사자가 모두 고쳤어요. 다시 점검할게요."));
      for (const button of el("reviewResults").querySelectorAll("[data-fix]")) {
        button.onclick = () => applyFixes([issues[Number(button.dataset.fix)]], "고쳤어요. 다시 점검할게요.");
      }
      el("reviewResults").querySelector("[data-hint-write]")?.addEventListener("click", () => {
        const body = el("reviewDraftBody");
        body.focus();
        body.setSelectionRange(body.value.length, body.value.length);
      });
    } else {
      el("reviewResults").innerHTML = `<p class="review-note">${pendingDraft.private ? "나만보기 글은 검사하지 않아요." : "점검 결과가 없어요."}</p>`;
    }

    const guides = issues.map((issue) => issue.guide).filter(Boolean);
    el("reviewSuggestions").innerHTML = serverReview?.suggestion || guides.length
      ? `<div class="review-result"><p>${escapeText(serverReview?.suggestion || "")}</p>${guides.map((guide) => `<small>${escapeText(guide)}</small>`).join("")}</div>`
      : '<p class="review-note">수정 제안이 없어요.</p>';
  }
  el("closeReview").onclick = () => reviewDialog.close();
  reviewDialog.onclose = () => {
    if (!resumeDraft || !pendingDraft) return;
    el("postTitle").value = pendingDraft.title;
    el("body").value = pendingDraft.body;
    updateDraftCounts();
    el("editor").show();
  };
  el("postForm").onsubmit = (event) => {
    event.preventDefault();
    for (const field of ["postTitle", "body"]) {
      if (el(field).value.trim()) continue;
      el(field).setCustomValidity("내용을 입력해주세요.");
      el(field).reportValidity();
      return;
    }
    if (!selectedTopic) {
      el("topicSelection").textContent =
        "고민 분야를 열고 세부 주제를 선택해 주세요.";
      el("topicSelection").classList.add("needs-topic");
      el("categories").querySelector("summary").focus();
      return;
    }
    const p = {
      id: editing || "post-" + Date.now(),
      nick: me.nick,
      animal: me.animal,
      job: me.job,
      years: el("shareYears").checked ? me.years : "",
      x: 50,
      y: 55,
      title: el("postTitle").value.trim(),
      body: el("body").value.trim(),
      topic: selectedTopic,
      way: Number(new FormData(event.currentTarget).get("way")),
      private: el("privatePost").checked,
    };
    if (p.title.length > 40 || p.body.length > 1000) {
      const field = p.title.length > 40 ? el("postTitle") : el("body");
      field.setCustomValidity("글자 수 제한을 확인해주세요.");
      field.reportValidity();
      return;
    }
    pendingDraft = p;
    serverReview = null;
    reviewFixTotal = 0;
    showReviewResults(true);
    resumeDraft = true;
    el("editor").close();
    setupReviewDraft();
    reviewDialog.showModal();
    schedulePostCheck(0);
  };
  
  el("publishPost").onclick = async () => {
  if (!pendingDraft) return;

  const button = el("publishPost");
  if (button.disabled) return;

  const p = {
    ...pendingDraft,
    title: pendingDraft.title.trim(),
    body: pendingDraft.body.trim()
  };

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "저장 중...";

  try {
    const body = {
      title: p.title,
      content: p.body,
      topic: p.topic,
      comfort_type: COMFORT_KEYS[p.way],
      visibility: p.private ? "private" : "public",
      show_years: Boolean(p.years)
    };

    const isEditing = editing !== null;

    if (!isEditing) {
      body.island_id = islandId;
      // 지금 내 캐릭터가 서 있는 자리에 고민이 놓임
      body.map_x = state.player.x;
      body.map_y = state.player.y;
    }

    const result = await api(
      isEditing ? `/posts/${editing}` : "/posts",
      {
        method: isEditing ? "PATCH" : "POST",
        body
      }
    );

    // 저장 성공 후에만 작성 내용을 비움
    resumeDraft = false;
    pendingDraft = null;
    editing = null;
    reviewDialog.close();

    await Promise.all([
      renderFeed(),
      loadNeighbors()
    ]);

    toast(
      isEditing
        ? "수정했어요."
        : p.private
          ? "나만보기로 저장했어요."
          : "고민을 나눴어요."
    );

    showCrisisSupport(result?.crisis_support);
  } catch (error) {
    const detail = error.detail;

    if (error.status === 422 && detail?.code === "NEED_EDIT") {
      // 팝업 대신 오른쪽 점검 패널에 서버 결과를 표시
      clearTimeout(reviewTimer);
      reviewRequest++;
      reviewLoading = false;
      reviewError = "";
      serverReview = { ...detail, ok: false };
      showReviewResults(true);
      el("resultHeading").focus();
    } else {
      alert(error.message);
    }
  } finally {
    button.textContent = originalText;
    if (pendingDraft) renderReview(); // 버튼 활성 여부를 점검 결과에 맞춰 다시 계산
    else button.disabled = false;
  }
};

  el("deleteDialog").onclose = () => {
    if (el("deleteDialog").returnValue !== "delete" || !deleting) return;
    state.posts = state.posts.filter((p) => p.id !== deleting);
    delete state.replies[deleting];
    deleting = null;
    save();
    renderFeed();
    personal();
    toast("고민글을 삭제했어요.");
  };
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const {
      theme,
      post,
      close,
      alert,
      tab: targetTab,
      edit,
      delete: remove,
    } = button.dataset;
    if (button.hasAttribute("data-campfire")) showCampfireInfo();
    if (button.hasAttribute("data-bottle")) openBottle();
    if (button.hasAttribute("data-keeper")) openKeeper();
    if (button.dataset.bubbleGroup) openBubbleGroup(Number(button.dataset.bubbleGroup));
    if (button.dataset.themeAuto !== undefined) {
      state.themeMode = "auto";
      save();
      renderTheme();
      syncThemeWithClock();
      el("themePicker").open = false;
      el("currentTheme").focus();
    }
    if (theme) {
      state.themeMode = "manual";
      save();
      if (theme === state.theme) renderTheme();
      changeTheme(theme);
      el("themePicker").open = false;
      el("currentTheme").focus();
    }
    if (post) showPost(post);
    if (button.hasAttribute("data-cluster")) {
      const rect = button.getBoundingClientRect();
      changeZoom(2.65, rect.left + rect.width / 2, rect.top + rect.height / 2);
      dx +=
        map.clientWidth * (map.clientWidth <= 690 ? 0.5 : 0.34) -
        (rect.left + rect.width / 2 - map.getBoundingClientRect().left);
      positionMap();
      el("markers").querySelector("button")?.focus({ preventScroll: true });
    }
    if (close) el(close).close();
    if (button.id === "hideProfile") {
      closeProfile();
      el("profile").focus();
    }
    if (targetTab) {
      tab = targetTab;
      personal();
    }
    if (alert) {
      if (!state.read.includes(alert)) state.read.push(alert);
      save();
      updateBadge();
      personal(notices.find((n) => n.id === alert));
    }
    if (edit) editor(find(edit));
    if (remove) {
      deleting = remove;
      el("deleteDialog").returnValue = "";
      el("deleteDialog").showModal();
    }
  });
  let drag,
    dx = 0,
    dy = 0;
  const map = el("map"),
    world = el("world");
  function positionMap() {
    const limitX = Math.max(
      0,
      (world.offsetWidth * zoom - map.clientWidth) / 2,
    );
    const limitY = Math.max(
      0,
      (world.offsetHeight * zoom - map.clientHeight) / 2,
    );
    dx = Math.max(-limitX, Math.min(limitX, dx));
    dy = Math.max(-limitY, Math.min(limitY, dy));
    world.style.setProperty("--dx", dx + "px");
    world.style.setProperty("--dy", dy + "px");
    world.style.setProperty("--scale", zoom);
  }
  // 내 캐릭터가 화면 가장자리 여백 안쪽에 머물도록 지도를 끌어옴.
  // 지도 끝에 닿으면 positionMap이 더 못 가게 막으므로, 그때는 캐릭터만 지도 끝(4~96%)까지 간다.
  followPlayer = () => {
    const box = world.getBoundingClientRect();
    const view = map.getBoundingClientRect();
    const px = box.left + (box.width * state.player.x) / 100;
    const py = box.top + (box.height * state.player.y) / 100;
    const marginX = Math.min(110, view.width * 0.18);
    const marginY = Math.min(110, view.height * 0.18);
    if (px < view.left + marginX) dx += view.left + marginX - px;
    else if (px > view.right - marginX) dx -= px - (view.right - marginX);
    if (py < view.top + marginY) dy += view.top + marginY - py;
    else if (py > view.bottom - marginY) dy -= py - (view.bottom - marginY);
    positionMap();
  };
  let guideTimer;
  function showZoomGuide() {
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((value) => String(value).padStart(2, "0"))
      .join(".");
    const weekday = new Intl.DateTimeFormat("ko-KR", {
      weekday: "long",
    }).format(now);
    const time = new Intl.DateTimeFormat("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
    el("zoomTime").dateTime = now.toISOString();
    el("zoomTime").textContent = date + " " + weekday + " · " + time;
    el("zoomIdentity").hidden = false;
    if (!document.activeElement?.closest("#search")) {
      filters.hidden = true;
      el("search").classList.add("search-paused");
      el("zoomGuide").hidden = false;
    }
    clearTimeout(guideTimer);
    guideTimer = setTimeout(() => {
      el("zoomIdentity").hidden = true;
      el("zoomGuide").hidden = true;
      el("search").classList.remove("search-paused");
    }, 1400);
  }
  function changeZoom(value, x, y) {
    const box = map.getBoundingClientRect();
    const stageX = box.left + box.width / 2;
    const stageY = box.top + box.height / 2;
    const next = Math.max(1, Math.min(MAX_ZOOM, value));
    if (next !== zoom) showZoomGuide();
    const ratio = next / zoom;
    const ax = (x ?? stageX) - stageX;
    const ay = (y ?? stageY) - stageY;
    dx = ax + (dx - ax) * ratio;
    dy = ay + (dy - ay) * ratio;
    const revealChanged = zoom < revealZoom !== next < revealZoom;
    zoom = next;
    el("map").classList.toggle("zoomed-out", zoom < 1.6); // 멀리서 볼 땐 이름표를 줄임
    positionMap();
    el("zoomReset").textContent = Math.round(zoom * 100) + "%";
    if (revealChanged) renderMarkers();
  }
  el("zoomIn").onclick = () => changeZoom(zoom * 1.3);
  el("zoomOut").onclick = () => changeZoom(zoom / 1.3);
  el("zoomReset").onclick = () => {
    dx = dy = 0;
    changeZoom(1);
  };
  map.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      changeZoom(
        zoom * Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.0035),
        event.clientX,
        event.clientY,
      );
    },
    { passive: false },
  );
  const pointers = new Map();
  let pointerOrigin = null,
    movedMap = false;
  let pinchDistance = 0;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  map.onpointerdown = (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    pointerOrigin = { x: event.clientX, y: event.clientY };
    movedMap = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) pinchDistance = distance(...pointers.values());
    drag = { x: event.clientX - dx, y: event.clientY - dy };
    map.setPointerCapture(event.pointerId);
  };
  map.onpointermove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    if (
      pointerOrigin &&
      Math.hypot(
        event.clientX - pointerOrigin.x,
        event.clientY - pointerOrigin.y,
      ) > 6
    )
      movedMap = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = pointers.values();
      const nextDistance = distance(a, b);
      if (pinchDistance > 0)
        changeZoom(
          (zoom * nextDistance) / pinchDistance,
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
        );
      pinchDistance = nextDistance;
    } else if (drag && pointers.size === 1) {
      dx = event.clientX - drag.x;
      dy = event.clientY - drag.y;
      positionMap();
    }
  };
  map.onlostpointercapture = (event) => {
    pointers.delete(event.pointerId);
    const remaining = pointers.values().next().value;
    drag = remaining ? { x: remaining.x - dx, y: remaining.y - dy } : null;
    pinchDistance = 0;
  };
  map.addEventListener("click", (event) => {
    if (event.target.closest("button") || movedMap) {
      movedMap = false;
      return;
    }
    const box = world.getBoundingClientRect();
    const x = Math.max(
      4,
      Math.min(96, ((event.clientX - box.left) / box.width) * 100),
    );
    const y = Math.max(
      7,
      Math.min(93, ((event.clientY - box.top) / box.height) * 100),
    );
    state.player = { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
    save();
    const player = el("markers").querySelector(".player-marker");
    if (player) {
      player.style.left = state.player.x + "%";
      player.style.top = state.player.y + "%";
    } else renderMarkers();
  });
  new ResizeObserver(positionMap).observe(map);
  document.addEventListener("click", (event) => {
    for (const category of el("categories").querySelectorAll("details[open]")) {
      if (!category.contains(event.target)) category.open = false;
    }
  });
  document.addEventListener("click", (event) => {
    const picker = el("themePicker");
    if (!picker.contains(event.target)) picker.open = false;
  });
  const themePicker = el("themePicker");
  themePicker.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    themePicker.open = true;
  });
  themePicker.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    if (el("themes").contains(document.activeElement))
      el("currentTheme").focus({ preventScroll: true });
    themePicker.open = false;
  });
  el("themePicker").addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !el("themePicker").open) return;
    el("themePicker").open = false;
    el("currentTheme").focus();
  });
  el("map").classList.add("zoomed-out");
  if (state.themeMode !== "manual") state.theme = themeForHour();
  renderTheme();
  setInterval(syncThemeWithClock, 60 * 1000); // 시간이 바뀌면 배경도 따라 바뀜
  setInterval(presenceTick, 3000); // 실시간 접속: 3초마다 내 위치 공유
  setInterval(loadTemperature, 30 * 1000); // 다른 이웃 활동으로 오른 온도 반영
  // 새 댓글·답글 알림: 화면을 보고 있을 때만 20초마다 확인
  setInterval(() => {
    if (!document.hidden) updateBadge({ announce: true });
  }, 20 * 1000);
  setupAmbient();
  presenceTick();
  updateBadge();
  renderFeed();
  loadNeighbors();
  loadBottle();
  loadKeeper();
}

// ── 나만보기 고민: 온도와 둘만의 대화 ──
function renderChat(result) {
  const log = el("chatLog");
  if (!log) return;
  log.innerHTML = result.messages.length
    ? result.messages.map((m) =>
        // pre-wrap이라 태그 안쪽에 공백·줄바꿈을 두지 않음
        `<p class="chat-bubble ${m.is_ai ? "from-ai" : "from-me"}"><span class="sr-only">${m.is_ai ? "온도" : "나"}: </span>${escapeText(m.content)}</p>`,
      ).join("")
    : `<button type="button" id="chatStart" class="wide">온도에게 이야기 걸기</button>`;
  log.scrollTop = log.scrollHeight;
  el("chatForm").hidden = !result.messages.length || result.remaining <= 0;
  el("chatRemaining").textContent = result.messages.length
    ? result.remaining > 0 ? `남은 대화 ${result.remaining}번` : "이 고민에서 나눌 수 있는 대화를 모두 나눴어요."
    : "";
  el("chatStart")?.addEventListener("click", () => sendChat(null));
  showCrisisSupport(result.crisis_support);
}

let chatPostId = null;
async function setupPrivateChat(postId) {
  chatPostId = postId;
  try {
    const result = await api(`/posts/${postId}/ai-chat`);
    if (chatPostId !== postId) return;
    renderChat(result);
  } catch (error) {
    if (el("chatLog")) {
      el("chatLog").textContent = error.status === 404 || error.status === 405
        ? "서버 업데이트 후 온도와 이야기할 수 있어요."
        : error.message;
    }
    return;
  }
  el("chatForm").onsubmit = (event) => {
    event.preventDefault();
    const text = el("chatInput").value.trim();
    if (text) sendChat(text);
  };
}

async function sendChat(text) {
  const postId = chatPostId;
  const log = el("chatLog");
  const input = el("chatInput");
  if (text) {
    log.querySelector("#chatStart")?.remove();
    log.insertAdjacentHTML("beforeend", `<p class="chat-bubble from-me">${escapeText(text)}</p>`);
    input.value = "";
  } else {
    log.innerHTML = "";
  }
  log.insertAdjacentHTML("beforeend", `<p class="chat-bubble from-ai typing" id="chatTyping">온도가 생각하고 있어요…</p>`);
  log.scrollTop = log.scrollHeight;
  input.disabled = true;
  try {
    const result = await api(`/posts/${postId}/ai-chat`, { method: "POST", body: text ? { content: text } : {} });
    if (chatPostId !== postId) return;
    renderChat(result);
  } catch (error) {
    el("chatTyping")?.remove();
    toast(error.message);
    if (text) input.value = text;
  } finally {
    input.disabled = false;
    if (chatPostId === postId) input.focus();
  }
}

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
