/* 메인 선택 화면 전용 상태. 팀 로그인 화면의 ondo-profile 값은 읽기만 합니다. */
const islandSelectStoredProfile = loadProfile();
const islandSelectProfile = islandSelectStoredProfile || { job: '개발', nick: '게스트', animal: 0, years: '' };
let islandSelectItems = [];

const islandSelectJobMessages = {
  디자인: '디자이너 이웃들의 이야기를 만나요.',
  영업: '영업직 이웃들의 이야기를 만나요.',
  개발: '개발, 엔지니어링 이웃들의 이야기를 만나요.',
};

let islandSelectIndex = 0;
const islandSelectCard = document.getElementById('island-select-card');
const islandSelectCarousel = document.querySelector('.island-select-carousel');
const islandSelectTitle = document.getElementById('island-select-title');
const islandSelectSubtitle = document.querySelector('.island-select-stage > p');

function islandSelectArt(item) {
  return item.kind === 'unified' ? 'assets/islands/unified-island.png' : 'assets/islands/job-island.png';
}

function islandSelectPreviewMessage(item) {
  if (item.kind === 'unified') return '다양한 사람들의 이야기를 만나요.';
  return islandSelectJobMessages[islandSelectProfile.job] || `${islandSelectProfile.job} 이웃들의 이야기를 만나요.`;
}

function islandSelectShowPreview(item) {
  islandSelectCarousel.classList.add('is-preview');
  islandSelectCarousel.dataset.kind = item.kind;
  islandSelectCard.dataset.kind = item.kind;
  islandSelectTitle.textContent = '오늘의 고민은 무엇인가요?';
  islandSelectSubtitle.textContent = islandSelectPreviewMessage(item);
  islandSelectCard.innerHTML = `
    <button class="island-select-back" id="island-select-back">‹ 섬 선택으로 돌아가기</button>
    <img class="island-select-preview-art" src="${islandSelectArt(item)}" alt="${item.name}">
    <button class="island-select-browse" id="island-select-browse">고민 둘러보기</button>
  `;
  document.getElementById('island-select-back').onclick = islandSelectRender;
  document.getElementById('island-select-browse').onclick = () => {
    if (item.kind === 'job') {
      if (!islandSelectStoredProfile) saveProfile(islandSelectProfile);
      sessionStorage.setItem('ondo-session', '1');
    }
    location.assign(
      `${item.path}?island_id=${encodeURIComponent(item.id)}`
    );
  };
}

function islandSelectRender() {
  const item = islandSelectItems[islandSelectIndex];
  islandSelectCarousel.classList.remove('is-preview');
  islandSelectCarousel.dataset.kind = item.kind;
  islandSelectCard.dataset.kind = item.kind;
  islandSelectTitle.textContent = '어느 섬으로 갈까요?';
  islandSelectSubtitle.textContent = '두 섬을 둘러보고, 마음이 가는 곳으로 떠나보세요.';
  islandSelectCard.innerHTML = `
    <img class="island-select-art" src="${islandSelectArt(item)}" alt="${item.name} 미리보기">
    <svg class="island-select-route-line" aria-hidden="true"><path></path></svg>
    <img class="island-select-boat" src="assets/islands/route-boat.png" alt="">
    <div class="island-select-copy">
      <h2>${item.name}</h2>
      <p>${item.kind === 'unified' ? '다양한 직무의 이웃들과 고민을 나눠요.' : islandSelectPreviewMessage(item)}</p>
      <p class="island-select-status" id="island-select-status" aria-live="polite"></p>
      <button class="island-select-enter" id="island-select-enter">${item.name} 입장하기</button>
    </div>
  `;
  document.getElementById('island-select-prev').disabled = islandSelectIndex === 0;
  document.getElementById('island-select-next').disabled = islandSelectIndex === islandSelectItems.length - 1;
  document.getElementById('island-select-enter').onclick = () => islandSelectShowPreview(item);
  islandSelectShowStatus(item);
  islandSelectDrawRoute();
}

// 배에서 옆 섬까지 하얀 점선 경로를 화면 위치에 맞춰 그림 (그림 파일을 늘리면 섬에 안 닿아서)
function islandSelectDrawRoute() {
  const svg = islandSelectCard.querySelector('.island-select-route-line');
  const boat = islandSelectCard.querySelector('.island-select-boat');
  if (!svg || !boat) return;
  const box = islandSelectCard.getBoundingClientRect();
  const toRight = islandSelectCard.dataset.kind !== 'job';
  const edge = getComputedStyle(islandSelectCarousel, toRight ? '::after' : '::before');
  const w = parseFloat(edge.width), h = parseFloat(edge.height), top = parseFloat(edge.top);
  const edgeLeft = toRight ? box.width - parseFloat(edge.right) - w : parseFloat(edge.left);
  if (!w || !h) return;
  // 옆 섬 그림의 안쪽 물가 (화면 쪽 가장자리, 섬 아래쪽)
  const end = {
    x: edgeLeft + w * (toRight ? 0.2 : 0.8),
    y: top + h * 0.66,
  };
  const b = boat.getBoundingClientRect();
  const start = { x: b.left + b.width / 2 - box.left, y: b.top + b.height * 0.7 - box.top };
  // 배에서 옆 섬 쪽으로 위로만 완만하게 올라감 (아래로 처지면 안내 글과 겹침)
  const dx = end.x - start.x;
  const rise = start.y - end.y;
  const mid = { x: start.x + dx * 0.55, y: start.y - rise * 0.45 - 22 };
  const d = [
    `M ${start.x} ${start.y}`,
    `C ${start.x + dx * 0.22} ${start.y + 4} ${mid.x - dx * 0.22} ${mid.y + 8} ${mid.x} ${mid.y}`,
    `S ${end.x - dx * 0.16} ${end.y + 26} ${end.x} ${end.y}`,
  ].join(' ');
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  svg.querySelector('path').setAttribute('d', d);
}
window.addEventListener('resize', () => islandSelectDrawRoute());

// 섬 온도·접속 인원·이번 주 고민 수를 보여 줘서 들어가기 전부터 섬 분위기를 알 수 있게
const islandSelectStatusCache = new Map();
async function islandSelectShowStatus(item) {
  const box = document.getElementById('island-select-status');
  const parts = [`이번 주 고민 ${item.postCount}개`];
  box.textContent = parts.join(' · ');
  try {
    if (!islandSelectStatusCache.has(item.id)) {
      islandSelectStatusCache.set(item.id, await api(`/islands/${item.id}/temperature`));
    }
    const status = islandSelectStatusCache.get(item.id);
    if (document.getElementById('island-select-status') !== box) return;
    parts.unshift(`🌡️ ${status.temperature}°`);
    if (status.online) parts.push(`지금 접속 ${status.online}명`);
    box.textContent = parts.join(' · ');
  } catch {
    // 온도를 모르는 이전 서버면 고민 수만 보여 줌
  }
}

// 화살표로 넘길 때: 지금 섬이 경로 방향으로 밀려나고, 다음 섬이 반대쪽에서 들어옴
let islandSelectMoving = false;
function islandSelectMove(delta) {
  const next = islandSelectIndex + delta;
  if (next < 0 || next >= islandSelectItems.length || islandSelectMoving) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const out = delta > 0 ? 'is-out-left' : 'is-out-right';
  const into = delta > 0 ? 'is-in-right' : 'is-in-left';
  if (reduce) {
    islandSelectIndex = next;
    islandSelectRender();
    return;
  }
  islandSelectMoving = true;
  islandSelectCarousel.classList.add('is-moving');
  islandSelectCard.classList.add(out);
  setTimeout(() => {
    islandSelectIndex = next;
    islandSelectCard.classList.remove(out);
    islandSelectCard.classList.add(into);
    islandSelectRender();
    islandSelectCard.getBoundingClientRect(); // 들어오기 시작 위치를 먼저 적용
    islandSelectCard.classList.remove(into);
    setTimeout(() => {
      islandSelectCarousel.classList.remove('is-moving');
      islandSelectMoving = false;
    }, 420);
  }, 320);
}

document.getElementById('island-select-prev').onclick = () => islandSelectMove(-1);
document.getElementById('island-select-next').onclick = () => islandSelectMove(1);
async function loadIslandSelect() {
  const previous = document.getElementById('island-select-prev');
  const next = document.getElementById('island-select-next');

  previous.disabled = true;
  next.disabled = true;
  islandSelectSubtitle.textContent = '섬 목록을 불러오고 있어요.';

  if (!authToken()) {
    location.replace('index.html');
    return;
  }

  try {
    const islands = await api('/islands');

    islandSelectItems = islands.map(island => ({
      id: island.id,
      kind: island.type === 'common' ? 'unified' : 'job',
      name: island.name,
      postCount: island.post_count,
      path: island.type === 'common'
        ? 'unified-island.html'
        : 'village.html'
    }));

    // 기존 화면처럼 통합섬을 먼저 표시
    islandSelectItems.sort(
      (a, b) => Number(a.kind === 'job') - Number(b.kind === 'job')
    );

    if (!islandSelectItems.length) {
      islandSelectSubtitle.textContent = '입장할 수 있는 섬이 없어요.';
      return;
    }

    islandSelectIndex = 0;
    islandSelectRender();
  } catch (error) {
    islandSelectSubtitle.textContent = error.message;
  }
}

loadIslandSelect();
