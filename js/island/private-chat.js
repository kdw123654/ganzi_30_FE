// 나만보기 고민: 온도와 둘만의 대화
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
