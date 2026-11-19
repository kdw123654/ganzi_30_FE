const byId = id => document.getElementById(id);
const names = ['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지','사자'];
const adjectives = [
  '느긋한', '다정한', '용감한', '포근한', '씩씩한', '졸린',
  '부지런한', '호기심 많은', '행복한', '상냥한', '차분한', '엉뚱한',
  '재치 있는', '명랑한', '수줍은', '유쾌한', '모험심 많은', '든든한',
  '꼼꼼한', '낙천적인', '정겨운', '발랄한', '온화한', '장난기 많은'
];
const nicknameHistory = new Map();
let animal = 2, verified = false, draft = {};
let pickedColor = 'original'; // 팔레트에서 고른 캐릭터 색감 (BE CHARACTER_COLORS 키)
let saved = loadProfile();
// 'login' = 이메일로 시작하기 화면, 'signup' = 처음 온 사람의 직무·동의 화면 (이메일 인증은 이미 끝난 상태)
function showAuth(mode) {
  const login = mode === 'login';
  byId('loginForm').hidden = !login;
  byId('infoTitle').hidden = login;
  byId('onboard').hidden = login;
  if (login) byId('loginStatus').textContent = '';
}
function show(view) {
  for (const id of ['home','choose','done']) byId(id).hidden = id !== view;
  byId('account').hidden = view !== 'done';
  const heading = byId(view).querySelector('h1');
  heading.tabIndex = -1;
  heading.focus();
}

let nicknameRequest = 0;

async function recommend() {
  const requestId = ++nicknameRequest;
  const nick = byId('nick');
  const submit = byId('profile').querySelector('button.wide');

  nick.readOnly = true;
  nick.maxLength = 40;
  nick.value = '';
  nick.placeholder = '닉네임을 추천받고 있어요...';
  submit.disabled = true;

  try {
    const result = await api(
      `/auth/nickname?character=${CHARACTER_KEYS[animal]}`,
      { auth: false }
    );

    if (requestId !== nicknameRequest) return;

    nick.setCustomValidity('');
    nick.value = result.nickname;
    submit.disabled = false;
  } catch (error) {
    if (requestId !== nicknameRequest) return;

    nick.placeholder = '다시 추첨하기를 눌러주세요.';
    alert(error.message);
  }
}

function select(index, refreshNick = true) {
  animal = (index + names.length) % names.length;
  const cards = byId('cards');
  const paletteWasOpen = !byId('paletteOptions').hidden;
  cards.replaceChildren();
  for (const offset of [-1, 0, 1]) {
    const choice = (animal + offset + names.length) % names.length;
    // 가운데(고른) 카드는 안에 '색감 고르기' 버튼이 들어가야 해서 button 대신 div (버튼 안에 버튼은 안 됨)
    const card = document.createElement(offset ? 'button' : 'div');
    card.className = 'character-card' + (offset ? '' : ' is-current');
    if (offset) {
      card.type = 'button';
      card.setAttribute('aria-label', names[choice] + ' 고르기');
      card.setAttribute('aria-pressed', 'false');
    } else {
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', '고른 캐릭터 ' + names[choice]);
      card.tabIndex = -1;
    }
    // 위쪽 아이콘: 직무 아이콘(노트북 등) 대신 팔레트 (피그마). 가운데 카드만 눌러서 색감을 고를 수 있음
    const iconSlot = document.createElement(offset ? 'span' : 'button');
    iconSlot.className = 'palette-badge';
    iconSlot.innerHTML = '<img src="assets/palette.svg" alt="">' + (offset ? '' : '<span>색감 고르기</span>');
    if (!offset) {
      iconSlot.type = 'button';
      iconSlot.id = 'paletteToggle';
      iconSlot.setAttribute('aria-controls', 'paletteOptions');
      iconSlot.setAttribute('aria-expanded', String(paletteWasOpen));
      iconSlot.onclick = togglePalette;
    }
    const animalImage = new Image();
    animalImage.className = ['character-image', toneClass(pickedColor)].filter(Boolean).join(' ');
    animalImage.src = 'assets/characters/' + choice + '.png';
    animalImage.alt = '';
    const base = document.createElement('span');
    base.className = 'character-base';
    card.append(iconSlot, base, animalImage);
    if (offset) card.onclick = () => {
      select(choice);
      cards.children[1].focus();
    };
    cards.append(card);
  }
  byId('animalName').textContent = names[animal];
  // 칭호(12간지 × 위로 성향) 안내는 기획 확정 전이라 아직 숨김
  byId('animalPersona').hidden = true;
  renderPalette();
  if (refreshNick) recommend();
}
byId('previous').onclick = () => select(animal - 1);
byId('next').onclick = () => select(animal + 1);
byId('animals').onkeydown = event => {
  const offset = {ArrowLeft: -1, ArrowRight: 1}[event.key];
  if (!offset) return;
  event.preventDefault();
  select(animal + offset);
  byId('cards').children[1].focus();
};
// 마우스 휠(트랙패드 가로 스크롤 포함)로도 넘기기. 한 번 굴릴 때 한 칸만 넘어가게 잠깐 쉬었다가 받음
let wheelLock = 0;
byId('animals').addEventListener('wheel', event => {
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (Math.abs(delta) < 4) return;
  event.preventDefault(); // 고르는 동안 화면이 위아래로 스크롤되지 않게
  const now = Date.now();
  if (now < wheelLock) return;
  wheelLock = now + 280;
  select(animal + (delta > 0 ? 1 : -1), true);
}, {passive:false});

// 팔레트: 누르면 색감 8가지가 펼쳐지고, 고르면 캐릭터 색이 바로 바뀜 (가입·수정 때 함께 저장)
function renderPalette() {
  const box = byId('paletteOptions');
  if (!box) return;
  box.innerHTML = CHARACTER_COLORS.map(([key, label]) => `
    <button type="button" data-color="${key}" aria-pressed="${key === pickedColor}" title="${label}">
      <img class="${toneClass(key)}" src="assets/characters/${animal}.png" alt="">
      <span>${label}</span>
    </button>`).join('');
}
function togglePalette() {
  const box = byId('paletteOptions');
  box.hidden = !box.hidden;
  byId('paletteToggle').setAttribute('aria-expanded', String(!box.hidden));
}
byId('paletteOptions').onclick = event => {
  const button = event.target.closest('[data-color]');
  if (!button) return;
  pickedColor = button.dataset.color;
  select(animal, false);
};

let swipeStart;
byId('cards').addEventListener('touchstart', event => {
  swipeStart = event.changedTouches[0].clientX;
}, {passive:true});
byId('cards').addEventListener('touchend', event => {
  const delta = event.changedTouches[0].clientX - swipeStart;
  if (Math.abs(delta) > 45) select(animal + (delta < 0 ? 1 : -1));
}, {passive:true});
for (const id of ['job','years']) {
  const select = byId(id);
  const picker = document.createElement('details');
  picker.className = 'info-picker';
  picker.name = 'onboard-pickers';
  const trigger = document.createElement('summary');
  trigger.id = id + 'Choice';
  trigger.setAttribute('aria-labelledby', id + 'Label ' + trigger.id);
  trigger.textContent = '선택해주세요';
  const choices = document.createElement('div');
  choices.className = 'info-choices';
  for (const option of select.options) {
    if (id === 'job' && !option.value) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.textContent;
    button.setAttribute('aria-pressed','false');
    button.onclick = () => {
      select.value = option.value;
      trigger.textContent = option.textContent;
      for (const choice of choices.children) choice.setAttribute('aria-pressed', choice === button);
      picker.open = false;
      trigger.focus();
      updateVerification();
    };
    choices.append(button);
  }
  picker.append(trigger, choices);
  select.after(picker);
  function positionChoices() {
    if (!picker.open) return;
    const {left, bottom, width} = trigger.getBoundingClientRect();
    const top = bottom + 6;
    Object.assign(choices.style, {
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      maxHeight: Math.max(0, document.documentElement.clientHeight - top - 8) + 'px'
    });
  }
  picker.addEventListener('toggle', positionChoices);
  byId('info').addEventListener('scroll', positionChoices, {passive:true});
  window.addEventListener('resize', positionChoices);
  picker.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !picker.open) return;
    event.preventDefault();
    picker.open = false;
    trigger.focus();
  });
}

let verificationTimer;
let resendUntil = 0;
let sendingCode = false;
let codeEmail = '';
let codeVerified = false;
let verifyingCode = false;
let codeVerificationRequest = 0;

function updateVerification() {
  const email = byId('email').value.trim().toLowerCase();
  const remaining = Math.max(
    0,
    Math.ceil((resendUntil - Date.now()) / 1000)
  );

  byId('verify').disabled =
    !byId('email').validity.valid || sendingCode || remaining > 0;

  byId('verify').textContent = sendingCode
    ? '요청 중...'
    : remaining > 0
      ? `재전송 (${remaining}초)`
      : verified
        ? '인증코드 다시 받기'
        : '인증 메일 받기';

  byId('continue').disabled =
    !verified ||
    !codeVerified ||
    verifyingCode ||
    email !== codeEmail ||
    !/^[0-9]{6}$/.test(byId('signupCode').value.trim()) ||
    !byId('job').value ||
    !byId('agreePrivacy').checked;
}

byId('email').oninput = () => {
  verified = false;
  codeVerified = false;
  verifyingCode = false;
  codeVerificationRequest++;
  codeEmail = '';
  byId('signupCode').value = '';
  byId('status').hidden = true;
  updateVerification();
};

async function verifySignupCode() {
  const email = byId('email').value.trim().toLowerCase();
  const code = byId('signupCode').value.trim();

  if (!verified || email !== codeEmail || !/^[0-9]{6}$/.test(code)) return;

  const requestId = ++codeVerificationRequest;
  verifyingCode = true;
  codeVerified = false;
  byId('status').hidden = false;
  byId('status').textContent = '인증코드를 확인하고 있어요.';
  updateVerification();

  try {
    await api('/auth/email-code/verify', {
      method: 'POST',
      auth: false,
      body: { email, purpose: 'signup', code }
    });

    if (
      requestId !== codeVerificationRequest ||
      byId('email').value.trim().toLowerCase() !== email ||
      byId('signupCode').value.trim() !== code
    ) return;

    codeVerified = true;
    byId('status').textContent = '인증코드가 확인됐어요.';
  } catch (error) {
    if (requestId !== codeVerificationRequest) return;
    byId('status').textContent = error.message;
  } finally {
    if (requestId === codeVerificationRequest) {
      verifyingCode = false;
      updateVerification();
    }
  }
}

byId('signupCode').oninput = () => {
  codeVerified = false;
  verifyingCode = false;
  codeVerificationRequest++;
  updateVerification();
  verifySignupCode();
};
byId('agreePrivacy').onchange = updateVerification;

byId('start').onclick = () => { updateVerification(); showAuth('login'); byId('info').showModal(); };
byId('close').onclick = () => byId('info').close();
let loginResendUntil = 0;
let loginCodeTimer;
let loginSending = false;

function updateLoginCodeButton() {
  const remaining = Math.max(
    0,
    Math.ceil((loginResendUntil - Date.now()) / 1000)
  );

  byId('loginSendCode').disabled = loginSending || remaining > 0;
  byId('loginSendCode').textContent = loginSending
    ? '요청 중...'
    : remaining > 0
      ? `재전송 (${remaining}초)`
      : '인증코드 받기';
}

// /auth/start 결과: 처음 온 이메일인지 (코드를 받은 이메일 기준)
let startState = null;

byId('loginEmail').oninput = () => {
  byId('loginCode').value = '';
  byId('loginStatus').textContent = '';
  startState = null;
};

// 성공하면 서버 응답을, 실패하면 null을 돌려줌 (체험 계정 버튼에서 재사용)
// /auth/start가 없는 이전 서버면 예전 방식(로그인 코드 → 없으면 가입 코드)으로 같은 결과를 만듦
async function requestStartCode(email) {
  try {
    return await api('/auth/start', { method: 'POST', auth: false, body: { email } });
  } catch (error) {
    const missingRoute = (error.status === 404 && error.message === 'Not Found') || error.status === 405;
    if (!missingRoute) throw error;
  }
  try {
    const sent = await api('/auth/email-code', { method: 'POST', auth: false, body: { email, purpose: 'login' } });
    return { ...sent, is_new: false };
  } catch (error) {
    if (error.status !== 404) throw error;
    const sent = await api('/auth/email-code', { method: 'POST', auth: false, body: { email, purpose: 'signup' } });
    return { ...sent, is_new: true };
  }
}

async function requestLoginCode() {
  if (!byId('loginEmail').reportValidity()) return null;

  const email = byId('loginEmail').value.trim().toLowerCase();

  loginSending = true;
  byId('loginCode').value = '';
  byId('loginStatus').textContent = '인증코드를 요청하고 있어요.';
  updateLoginCodeButton();

  try {
    // 가입했는지는 서버가 판단: 처음이면 가입 코드, 이미 있으면 로그인 코드를 보냄
    const result = await requestStartCode(email);

    startLoginCooldown(result.resend_after);

    if (byId('loginEmail').value.trim().toLowerCase() !== email) return null;
    startState = { email, isNew: result.is_new };

    const greeting = result.is_new ? '처음 오셨네요! ' : '다시 만나서 반가워요. ';
    byId('loginStatus').textContent = greeting + (result.demo_code
      ? `체험용 인증코드: ${result.demo_code} (5분 동안 유효)`
      : '이메일로 인증코드를 보냈어요.');

    byId('loginCode').focus();
    return result;
  } catch (error) {
    // 503(EMAIL_UNAVAILABLE) 등은 안내 문구만 보여 주고 코드 입력칸으로 넘어가지 않음
    byId('loginStatus').textContent = error.message;
    if (error.retryAfter) startLoginCooldown(error.retryAfter);
    return null;
  } finally {
    loginSending = false;
    updateLoginCodeButton();
  }
}
byId('loginSendCode').onclick = requestLoginCode;

function startLoginCooldown(seconds) {
  loginResendUntil = Date.now() + seconds * 1000;
  clearInterval(loginCodeTimer);
  loginCodeTimer = setInterval(() => {
    updateLoginCodeButton();
    if (Date.now() >= loginResendUntil) clearInterval(loginCodeTimer);
  }, 1000);
}

async function saveLoginSession(accessToken, remember = false) {
  startAuth(accessToken, remember);

  const me = await api('/auth/me');

  // 기존 화면이 사용하는 이름으로 변환해 보관
  saved = {
    id: me.id,
    email: me.email,
    job: me.job,
    years: me.years || '',
    nick: me.nickname,
    animal: CHARACTER_KEYS.indexOf(me.character),
    color: me.color || 'original'
  };

  saveProfile(saved);
}

byId('loginForm').onsubmit = async event => {
  event.preventDefault();

  const submit = byId('loginSubmit');
  if (submit.disabled) return;

  const email = byId('loginEmail').value.trim().toLowerCase();
  const code = byId('loginCode').value.trim();
  const remember = byId('rememberMe').checked;

  if (!startState || startState.email !== email) {
    byId('loginStatus').textContent = '먼저 인증코드를 받아 주세요.';
    return;
  }

  submit.disabled = true;
  submit.textContent = '확인 중...';

  try {
    if (startState.isNew) {
      // 처음 온 사람: 코드만 확인하고 직무·캐릭터 고르기로 (가입은 마지막에 같은 코드로)
      await api('/auth/email-code/verify', {
        method: 'POST',
        auth: false,
        body: { email, purpose: 'signup', code }
      });
      startSignup(email, code, remember);
      return;
    }

    const result = await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, code, remember }
    });

    await saveLoginSession(result.access_token, remember);

    location.href = 'island-select.html';
  } catch (error) {
    byId('loginStatus').textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = '시작하기';
  }
};

// 이메일 인증을 마친 새 사용자: 가입 화면의 이메일·코드 칸은 채워서 숨기고 직무·동의만 받음
let signupRemember = false;
function startSignup(email, code, remember) {
  signupRemember = remember;
  byId('email').value = email;
  byId('signupCode').value = code;
  codeEmail = email;
  verified = true;
  codeVerified = true;
  verifyingCode = false;
  document.querySelectorAll('.signup-email').forEach(part => { part.hidden = true; });
  byId('startVerified').hidden = false;
  byId('startVerified').textContent = `${email} 인증을 마쳤어요. 직무를 고르면 섬에 초대돼요.`;
  showAuth('signup');
  updateVerification();
  byId('job').focus();
}

byId('verify').onclick = async () => {
  if (!byId('email').reportValidity()) return;

  const email = byId('email').value.trim().toLowerCase();

  sendingCode = true;
  verified = false;
  codeVerified = false;
  verifyingCode = false;
  codeVerificationRequest++;
  codeEmail = '';
  byId('signupCode').value = '';
  byId('status').hidden = false;
  byId('status').textContent = '인증코드를 요청하고 있어요.';
  updateVerification();

  try {
    const result = await api('/auth/email-code', {
      method: 'POST',
      auth: false,
      body: { email, purpose: 'signup' }
    });

    resendUntil = Date.now() + result.resend_after * 1000;

    clearInterval(verificationTimer);
    verificationTimer = setInterval(() => {
      updateVerification();

      if (Date.now() >= resendUntil) {
        clearInterval(verificationTimer);
        verificationTimer = null;
      }
    }, 1000);

    // 요청 중 이메일을 변경했다면 이전 이메일의 코드를 사용하지 않음
    if (byId('email').value.trim().toLowerCase() !== email) return;

    codeEmail = email;
    verified = true;
    byId('status').hidden = false;
    byId('status').textContent = result.demo_code
      ? `체험용 인증코드: ${result.demo_code} (5분 동안 유효)`
      : '이메일로 인증코드를 보냈어요. 5분 안에 입력해주세요.';

    byId('signupCode').focus();
  } catch (error) {
    byId('status').hidden = false;
    byId('status').textContent = error.message;
    if (error.retryAfter) {
      resendUntil = Date.now() + error.retryAfter * 1000;
      clearInterval(verificationTimer);
      verificationTimer = setInterval(() => {
        updateVerification();
        if (Date.now() >= resendUntil) clearInterval(verificationTimer);
      }, 1000);
    }
  } finally {
    sendingCode = false;
    updateVerification();
  }
};

byId('onboard').onsubmit = event => {
  event.preventDefault();

  const email = byId('email').value.trim().toLowerCase();
  const code = byId('signupCode').value.trim();

  if (
    !verified ||
    !codeVerified ||
    email !== codeEmail ||
    !/^[0-9]{6}$/.test(code) ||
    !byId('job').value ||
    !byId('agreePrivacy').checked
  ) return;

  draft = {
    email,
    code,
    job: byId('job').value,
    years: byId('years').value,
    agree_privacy: byId('agreePrivacy').checked,
    remember: signupRemember
  };

  byId('info').close();
  pickedColor = 'original';
  select(2);
  show('choose');
};


// 이미 로그인한 사람: '환영해요' 화면 없이 바로 섬 선택으로 (캐릭터 수정은 섬 프로필 메뉴에 있음)
function welcome() {
  sessionStorage.setItem('ondo-session', '1');
  location.replace('island-select.html');
}
byId('shuffle').onclick = recommend;
byId('nick').oninput = () => byId('nick').setCustomValidity('');
byId('profile').onsubmit = async event => {
  event.preventDefault();

  const nickname = byId('nick').value.trim();
  const submit = byId('profile').querySelector('button.wide');

  if (!nickname || submit.disabled) return;

    // 이미 가입한 사람이 수정하러 들어온 경우 → 가입이 아니라 프로필 수정
  if (!draft.code) {
    submit.disabled = true;
    submit.textContent = '저장 중...';
    try {
      const updated = await api('/users/me', {
        method: 'PATCH',
        body: { character: CHARACTER_KEYS[animal], nickname, color: pickedColor }
      });
      saved = { ...saved, nick: updated.nickname, animal: CHARACTER_KEYS.indexOf(updated.character), color: updated.color || pickedColor };
      saveProfile(saved);
      const back = editReturnUrl();
      sessionStorage.removeItem(EDIT_RETURN_KEY);
      if (back) location.href = back; // 섬에서 왔으면 그 섬으로 바로 돌아감
      else welcome();
    } catch (error) {
      alert(error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = '입력 완료';
    }
    return;
  }

  submit.disabled = true;
  submit.textContent = '가입 중...';

  try {
    const result = await api('/auth/signup', {
      method: 'POST',
      auth: false,
      body: {
        email: draft.email,
        code: draft.code,
        job: draft.job,
        years: draft.years || null,
        character: CHARACTER_KEYS[animal],
        nickname,
        agree_privacy: draft.agree_privacy,
        remember: Boolean(draft.remember),
        color: pickedColor
      }
    });

    await saveLoginSession(result.access_token, Boolean(draft.remember));

    draft = {};
    verified = false;
    codeVerified = false;
    codeEmail = '';

    byId('signupCode').value = '';
    byId('agreePrivacy').checked = false;
    byId('status').hidden = true;

    location.href = 'island-select.html';
  } catch (error) {
    alert(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = '입력 완료';
  }
};
// 섬에서 '캐릭터 수정'으로 들어오면 돌아갈 섬 주소가 남아 있음. 다른 사이트로 튀지 않게 같은 폴더의 .html만 허용
const EDIT_RETURN_KEY = 'ondo-edit-return';
function editReturnUrl() {
  const back = sessionStorage.getItem(EDIT_RETURN_KEY) || '';
  return /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(back) ? back : '';
}
function startEdit() {
  draft = {email:saved.email, job:saved.job, years:saved.years};
  pickedColor = saved.color || 'original';
  select(saved.animal, false);
  byId('nick').value = saved.nick;
  byId('editCancel').hidden = !editReturnUrl();
  show('choose');
}
byId('edit').onclick = startEdit;
byId('editCancel').onclick = () => {
  const back = editReturnUrl();
  sessionStorage.removeItem(EDIT_RETURN_KEY);
  location.href = back || 'island-select.html';
};
byId('account').onclick = logout;

// 심사위원용: 체험 계정으로 코드 요청 → 코드 입력 → 로그인까지 자동 진행
byId('demoLogin').onclick = async () => {
  const button = byId('demoLogin');
  button.disabled = true;
  byId('loginEmail').value = 'demo@example.com';
  try {
    const result = await requestLoginCode();
    if (!result?.demo_code) return;
    byId('loginCode').value = result.demo_code;
    byId('loginForm').requestSubmit();
  } finally {
    button.disabled = false;
  }
};

// 무료 서버는 잠들어 있을 수 있으니 첫 화면에서 미리 깨움 (결과는 무시)
(function wakeServer() {
  const status = byId('wakeStatus');
  const showTimer = setTimeout(() => { status.hidden = false; }, 800);
  fetch(API + '/health')
    .catch(() => {})
    .finally(() => {
      clearTimeout(showTimer);
      status.hidden = true;
    });
})();

if (saved && authToken()) {
  if (location.hash === '#edit-character') startEdit();
  else welcome();
}
