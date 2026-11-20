// 마이페이지: 내 글/댓글 · 차단 목록 · 프로필 · 칭호 도감 · 설정 · 탈퇴
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
    box.textContent = `작성한 글 ${s.post_count}개 · 건넨 위로 ${s.comment_count}번`;
    box.title = "건넨 위로: 이웃의 고민에 남긴 댓글 수";
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
                <span class="title-icon has-img" aria-hidden="true">${titleIcon(t, "title-icon-img")}</span>
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
