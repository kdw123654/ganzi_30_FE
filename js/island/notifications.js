// 알림 배지 · 알림 목록
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

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
