// 초기화 · 이벤트 연결 (반드시 마지막에 로드)
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
