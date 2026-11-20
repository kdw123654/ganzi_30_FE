// 고민 상세 창 · 비슷한 고민 · AI 이어 답글
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
