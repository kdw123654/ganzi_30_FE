// 섬 고민 리포트 · 닮은 고민 묶음
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
