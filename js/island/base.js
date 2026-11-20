// 공통 유틸 · 상수 · 저장 상태 · 토스트
// (island-core.js에서 분리. 모든 island/*.js는 전역 스코프를 공유하는 일반 스크립트라 HTML의 로드 순서가 중요합니다)

const el = (id) => document.getElementById(id);
const me = loadProfile();
if (!me || !authToken())
  location.replace("index.html");

const escapeText = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const img = (index) =>
  Number.isInteger(index) && index >= 0 && index < 13
    ? "assets/characters/" + index + ".png"
    : "assets/characters/0.png";
const characterNames = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지", "사자"];
const ways = ["들어주세요", "경험을 나눠주세요", "함께 생각해주세요"];
const topics = {
  "업무·직장생활": [
    "업무량·스트레스",
    "직장 내 관계·갈등",
    "업무 실수",
    "성과 압박",
    "조직 문화",
    "워라밸",
    "직장 내 괴롭힘",
  ],
  "진로·성장": [
    "진로·직무 적성",
    "이직·퇴사",
    "커리어 성장·역량",
    "취업·입사 적응",
    "미래 불안",
  ],
  "감정·마음": [
    "번아웃·무기력",
    "불안·걱정",
    "외로움·고립감",
    "자존감·비교",
    "감정 조절",
  ],
  "관계·일상": [
    "인간관계·갈등",
    "연애·이별",
    "가족·결혼",
    "경제·금전",
    "건강·생활습관",
  ],
};
const config = window.ISLAND_CONFIG;
const key = config.storageKey;
const state = JSON.parse(
  localStorage.getItem(key) ||
    '{"posts":[],"replies":{},"theme":"day","read":[]}',
);
state.player ??= { x: 46, y: 62 };
const samples = [
  [
    "느린곰",
    0,
    "피드백을 받을 때마다 제가 부족한 사람 같아요",
    "상사에게 피드백을 받으면 자꾸 자신감이 떨어져요. 다음 일을 시작하기도 전에 걱정부터 앞서요.",
    0,
    "업무량·스트레스",
    "2년차",
    51,
    44,
    [],
  ],
  [
    "작은사슴",
    1,
    "회의에서 제 의견을 꺼내기가 어려워요",
    "회의 중에 하고 싶은 말이 있어도 타이밍을 놓쳐요. 다른 분들은 처음에 어떻게 의견을 꺼내셨는지 궁금해요.",
    1,
    "직장 내 관계·갈등",
    "1년차",
    41,
    50,
    [
      ["조용한 토끼", "저는 회의 전에 한 문장만 미리 적어두니 조금 편했어요."],
      ["포근한 양", "저도 비슷했어요. 먼저 질문으로 말을 시작해 봤어요."],
    ],
  ],
  [
    "밤산책",
    3,
    "퇴근해도 업무 생각이 멈추지 않아요",
    "집에 돌아와도 할 일이 계속 떠올라서 쉬는 시간이 짧게 느껴져요.",
    2,
    "워라밸",
    "3년차",
    58,
    49,
    [["다정한 용", "퇴근 전에 내일 할 일을 적어두는 게 도움이 됐어요."]],
  ],
  [
    "도토리",
    8,
    "첫 프로젝트를 끝냈는데 마음이 허전해요",
    "한동안 한 가지 일에 몰입했는데 마무리하고 나니 다음에 뭘 해야 좋을지 모르겠어요.",
    0,
    "커리어 성장·역량",
    "1년차",
    45,
    64,
    [],
  ],
].map(([nick, animal, title, body, way, topic, years, x, y, replies], i) => ({
  id: "sample-" + i,
  nick,
  animal,
  title,
  body,
  way,
  topic,
  years,
  x,
  y,
  replies,
  job: me?.job,
  time: ["방금", "5분 전", "12분 전", "18분 전"][i],
}));
const notices = [
  {
    id: "example-1",
    title: "팀 회의에서 말하기가 어려워요",
    time: "방금 전",
    name: "느린곰",
    body: "저도 비슷했어요. 다음 회의에 할 말을 한 문장만 적어두면 부담이 조금 줄더라고요.",
  },
  {
    id: "example-2",
    title: "퇴근 후에도 일이 생각나요",
    time: "1시간 전",
    name: "밤산책",
    body: "퇴근 전에 내일 할 일을 적어두니 조금 편해졌어요.",
  },
];
const themes = [
  ["night", "밤"],
  ["dawn", "새벽"],
  ["day", "낮"],
  ["sunset", "노을"],
];
const jobNames = {
  디자인: "Design village",
  개발: "Development village",
  마케팅: "Marketing village",
};
const save = () => localStorage.setItem(key, JSON.stringify(state));
const own = () => state.posts.filter((p) => p.job === me.job);
const repliesFor = (p) => [
  ...(p.replies || []),
  ...(state.replies[p.id] || []),
];
const find = (id) => [...own(), ...samples].find((p) => p.id === id);
const opt = (text, value = text) => new Option(text, value);
let comfortFilter = "";
let categoryFilter = ""; // 고민 주제(대분류) 필터
let waitingOnly = false; // "답을 기다리는 고민"만 보기
const activeFilters = () => searchText || comfortFilter || categoryFilter || waitingOnly;
const tokenise = (text) => text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
let selectedTopic = "";
let zoom = 1,
  visiblePins = [],
  recentWorryIds = new Set();
let searchText = "",
  tab = "alerts",
  editing = null,
  deleting = null,
  toastTimer;
let themeSwapTimer, themeTransitionTimer;
