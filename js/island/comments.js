// 댓글 렌더링 · 신고 · 이의제기
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
