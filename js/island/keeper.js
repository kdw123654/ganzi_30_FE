// 섬지기
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
