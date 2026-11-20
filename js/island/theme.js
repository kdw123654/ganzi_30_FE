// 시간대별 배경 테마
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)


function toast(message) {
  el("notice").textContent = message;
  el("notice").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el("notice").hidden = true;
  }, 2400);
}
// 시간대별 배경: 일출 5시, 낮 6~17시, 노을 18~19시, 밤 20시~새벽 4시
function themeForHour(hour = new Date().getHours()) {
  if (hour === 5) return "dawn";
  if (hour >= 6 && hour < 18) return "day";
  if (hour >= 18 && hour < 20) return "sunset";
  return "night";
}
// 자동 모드(기본)면 지금 시각에 맞는 배경으로 바꿈
function syncThemeWithClock() {
  if (state.themeMode === "manual") return;
  changeTheme(themeForHour());
}
function changeTheme(nextTheme) {
  if (nextTheme === state.theme) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.theme = nextTheme;
    save();
    renderTheme();
    return;
  }

  const map = el("map");
  const nextImage = new Image();
  nextImage.src = `assets/village/village-${nextTheme}.webp`;
  clearTimeout(themeSwapTimer);
  clearTimeout(themeTransitionTimer);
  map.classList.remove("theme-transitioning");
  void map.offsetWidth;
  map.classList.add("theme-transitioning");

  themeSwapTimer = setTimeout(() => {
    state.theme = nextTheme;
    save();
    renderTheme();
  }, 360);
  themeTransitionTimer = setTimeout(() => {
    map.classList.remove("theme-transitioning");
  }, 900);
}
function renderTheme() {
  const [, name] = themes.find(([id]) => id === state.theme) ?? themes[2];
  const current = el("currentTheme");
  current.setAttribute("aria-label", "배경 시간대 선택 · 현재 " + name);
  current.title = name + " 배경";
  current.innerHTML = `<img src="assets/themes/theme-${state.theme}.png" alt="">`;
  el("land").src = "assets/village/village-" + state.theme + ".webp";
  el("map").dataset.time = state.theme; // 시간대별 빛·반딧불이 등 분위기 연출
  const auto = state.themeMode !== "manual";
  el("themes").innerHTML =
    themes
      .map(
        ([id, name]) =>
          `<button type="button" data-theme="${id}" aria-label="${name}" title="${name}" aria-pressed="${!auto && id === state.theme}"><img src="assets/themes/theme-${id}.png" alt=""></button>`,
      )
      .join("") +
    `<button type="button" class="theme-auto" data-theme-auto aria-label="시간에 맞춰 자동" title="시간에 맞춰 자동" aria-pressed="${auto}">자동</button>`;
}
