// 글쓰기 창 · 주제 선택
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
