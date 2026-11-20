// 직무섬 설정. 공통 동작은 js/island/*.js에 있습니다.
window.ISLAND_CONFIG = {
  storageKey: "ondo-village-v1",
  // 섬 선택 화면과 같은 이름(예: 개발섬)으로 보여 줌
  title(me) {
    const heading = me.job + "섬";
    const koreanJob = { 디자인: "디자이너", 개발자: "개발자", 마케팅: "마케터", 영업: "영업인" }[
      me.job
    ];
    const zoom = koreanJob ? `${heading} · ${koreanJob} 마을` : heading;
    return { heading, zoom };
  },
};
