// 유리병 편지
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
