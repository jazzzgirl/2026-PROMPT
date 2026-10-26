/* ---------- 공통 도구 ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const filled = data => EL.filter(e => (data[e.k] || "").trim());
const toText = data => filled(data).map(e => e.label + "\n" + data[e.k].replace(/\s+$/, "")).join("\n\n");
const sectionsHTML = data => filled(data).map(e =>
  `<div class="psec" data-k="${e.k}"><span class="plabel">${esc(e.label)}</span><pre class="ptext">${esc(data[e.k].replace(/\s+$/, ""))}</pre></div>`).join("");

/* 알림(토스트): 필요하면 '되돌리기' 같은 버튼을 함께 보여준다 */
const toastEl = document.getElementById("toast");
let toastTimer;
function toast(msg, action){
  toastEl.innerHTML = `<span>${esc(msg)}</span>`;
  if(action){
    const b = document.createElement("button");
    b.type = "button"; b.textContent = action.label;
    b.addEventListener("click", () => { action.run(); toastEl.classList.remove("show"); });
    toastEl.appendChild(b);
  }
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), action ? 5000 : 1800);
}

async function copy(text){
  if(!text.trim()){ toast("복사할 내용이 없습니다. 입력창을 먼저 채우세요."); return; }
  let ok = false;
  try{ await navigator.clipboard.writeText(text); ok = true; }catch(e){}
  if(!ok){
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try{ ok = document.execCommand("copy"); }catch(_){}
    ta.remove();
  }
  toast(ok ? "프롬프트를 복사했습니다" : "복사하지 못했습니다. 내용을 직접 선택해 복사하세요.");
}

function renderBlock(id, title, data, extraClass){
  const host = document.getElementById(id);
  host.innerHTML = `<div class="pblock ${extraClass || ""}"><div class="pblock-head"><strong>${esc(title)}</strong><button class="btn sm" type="button">프롬프트 복사</button></div><div class="pblock-body">${sectionsHTML(data)}</div></div>`;
  host.querySelector("button").addEventListener("click", () => copy(toText(data)));
}

/* ---------- PROMPT 소개 ---------- */
document.getElementById("letters").innerHTML = EL.map(e =>
  `<a class="letter" data-k="${e.k}" href="#el-${e.k}"><b>${e.letter}</b><small>${e.ko}</small><i>${e.en}</i></a>`).join("");
document.getElementById("els").innerHTML = EL.map(e =>
  `<article class="el" id="el-${e.k}" data-k="${e.k}">
     <h3><span class="lt">${e.letter}</span>${e.ko}<span class="en">${e.en}</span></h3>
     <p class="q">${e.q}</p>
     <p class="d">${e.d}</p>
     <p class="ex">${esc(e.ex)}</p>
   </article>`).join("");

/* 후속 질문 목록: 질문마다 복사 버튼을 단다 */
function followupHTML(list){
  return `<ul class="fu">${list.map((q, i) =>
    `<li><span>${esc(q)}</span><button class="btn ghost sm" type="button" data-i="${i}">복사</button></li>`).join("")}</ul>`;
}
function bindFollowups(host, list){
  host.querySelectorAll(".fu button").forEach(b =>
    b.addEventListener("click", () => copy(list[+b.dataset.i])));
}
function renderSideFollowups(id, list){
  const host = document.getElementById(id);
  if(!host) return;
  host.innerHTML = `<h3 class="fu-title">코드를 읽은 뒤 물어볼 질문</h3>
    <p>코드를 실행하고 주석을 읽은 다음, 이해가 안 되는 부분을 이렇게 물어보세요.</p>${followupHTML(list)}`;
  bindFollowups(host, list);
}

renderBlock("goodPrompt", "좋은 프롬프트", GOOD, "compact");
renderBlock("healthPrompt", "예제 프롬프트", HEALTH);
renderBlock("analyzerPrompt", "예제 프롬프트", ANALYZER);
renderSideFollowups("healthFU", HEALTH_FU.concat(COMMON_FU));
renderSideFollowups("analyzerFU", ANALYZER_FU.concat(COMMON_FU));

/* ---------- 프롬프트 만들기 ---------- */
const STORE = "prompt-builder-v2";
let state = { tab: PRACTICE[0].id, drafts: {}, picks: {} };
try{
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if(saved && saved.drafts) state = { tab: saved.tab || state.tab, drafts: saved.drafts, picks: saved.picks || {} };
}catch(_){}
if(!PRACTICE.some(p => p.id === state.tab)) state.tab = PRACTICE[0].id;
function save(){ try{ localStorage.setItem(STORE, JSON.stringify(state)); }catch(_){} }

const tabsEl = document.getElementById("tabs");
const taskEl = document.getElementById("task");
const form = document.getElementById("form");
const builtBody = document.getElementById("builtBody");
const dots = document.getElementById("dots");
const progressText = document.getElementById("progressText");
const loadBtn = document.getElementById("loadExample");
const afterEl = document.getElementById("after");

/* T 입력창 아래: 기능·조건에 따라 넣을 관점을 고르는 안내 */
function tGuideHTML(){
  return `<details class="t-guide">
    <summary>T에 넣을 관점 고르기</summary>
    <p>위에 적은 기능·조건을 다시 읽고, 해당하는 관점만 T에 넣으세요.</p>
    <table>
      <thead><tr><th>기능·조건에 이런 것이 있으면</th><th>T에 넣을 관점</th></tr></thead>
      <tbody>${T_GUIDE.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody>
    </table>
  </details>`;
}

form.innerHTML = EL.map(e =>
  `<div class="field" data-k="${e.k}">
     <label for="f-${e.k}"><span class="plabel">${esc(e.label)}</span><span class="hint">${e.q}</span></label>
     <textarea id="f-${e.k}" rows="3" placeholder="${esc(e.ph)}"></textarea>
     ${e.k === "t" ? tGuideHTML() : ""}
     ${e.k === "o" ? '<div id="oDesign"></div>' : ""}
     ${e.k === "r" ? '<div id="rContent"></div>' : ""}
     ${e.k === "p1" ? '<div id="pPick"></div>' : ""}
   </div>`).join("");
const tas = Object.fromEntries(EL.map(e => [e.k, document.getElementById("f-" + e.k)]));
dots.innerHTML = EL.map(e => `<i data-k="${e.k}"></i>`).join("");

const practice = () => PRACTICE.find(p => p.id === state.tab);
const current = () => Object.fromEntries(EL.map(e => [e.k, tas[e.k].value]));
const hasText = data => Object.values(data || {}).some(v => (v || "").trim());

function autosize(ta){ ta.style.height = "auto"; ta.style.height = Math.max(84, ta.scrollHeight + 4) + "px"; }

function renderTabs(){
  tabsEl.innerHTML = PRACTICE.map((p, i) => {
    const sel = p.id === state.tab;
    const mark = hasText(state.drafts[p.id]) ? '<span class="mark" title="작성 중"></span>' : "";
    return `<button class="tab" type="button" role="tab" id="tab-${p.id}" aria-selected="${sel}" aria-controls="builderPanel" tabindex="${sel ? 0 : -1}" data-id="${p.id}">${mark}${esc(p.name)}</button>`;
  }).join("");
}

function renderTask(){
  const p = practice();
  const items = p.problem.items.length ? `<ol>${p.problem.items.map(t => `<li>${esc(t)}</li>`).join("")}</ol>` : "";
  const goal = p.id === "free" ? "" : '<p class="goal">위 문제를 해결하기 위한 프롬프트를 PROMPT 6요소에 맞춰 작성해 보세요.</p>';
  const note = p.note ? `<p style="margin-top:10px;font-size:15px">${esc(p.note)}</p>` : "";
  taskEl.innerHTML = `<h3>${esc(p.name)}</h3><p>${esc(p.problem.intro)}</p>${items}${note}${goal}`;
  renderAfter(p);
  renderCard(p);
  renderTheme(p);
  /* 탭마다 다른 입력 안내(placeholder)를 쓸 수 있다 */
  EL.forEach(e => { tas[e.k].placeholder = (p.ph && p.ph[e.k]) || e.ph; });
  loadBtn.hidden = !p.example;
  loadBtn.textContent = p.example ? `${p.name} 예시 넣기` : "";
}

/* 코드를 받은 다음에 할 일 (탭에 after가 있으면 그것을 쓴다) */
const DEFAULT_AFTER = [
  "O에 적은 실행 화면 예시를 그대로 입력해 결과가 같은지 직접 확인합니다.",
  "AI가 제안한 테스트 표의 값을 차례로 넣어 결과를 비교하고, 기대 결과 중 하나 이상은 계산기로 직접 확인합니다.",
  "주석과 실행 순서 요약을 읽으며 이해가 안 되는 줄에 표시합니다.",
  "표시한 줄이나 결과가 다른 부분을 그대로 인용해서 AI에게 후속 질문을 합니다."
];

/* =========================================================
   Streamlit 디지털 명함 만들기 도우미 (builder:"card" 탭에서만 보인다)
   - P 입력창 아래: 용도 고르기  → P에 넣기
   - R 입력창 아래: 내용 고르기 + 내 정보 채우기 → R에 넣기
   - O 입력창 아래: 화면 구성·디자인 고르기 → O에 넣기
   고른 항목과 입력한 정보는 탭별로 이 브라우저에 저장된다.
   ========================================================= */
const pPick = document.getElementById("pPick");
const rContent = document.getElementById("rContent");
const oDesign = document.getElementById("oDesign");
const buildAllBtn = document.getElementById("buildAll");
const allItems = () => CARD_CONTENT.flatMap(g => g.items);

function pick(p){
  const pk = state.picks[p.id] = state.picks[p.id] || {};
  if(!pk.sel) pk.sel = allItems().filter(it => it.base).map(it => it.id);
  if(!pk.vals) pk.vals = {};
  if(!pk.p) pk.p = cardDefaultSel(CARD_P);
  if(!pk.o) pk.o = cardDefaultSel(CARD_O);
  if(!pk.areas) pk.areas = {};
  /* 나중에 추가된 선택 항목이 있으면 기본값을 채운다 */
  CARD_P.forEach(g => { if(!pk.p[g.id]) pk.p[g.id] = (g.def || []).slice(); });
  CARD_O.forEach(g => { if(!pk.o[g.id]) pk.o[g.id] = (g.def || []).slice(); });
  return pk;
}
const myName = pk => ((pk.vals.name || {}).v || "").trim();

/* 선택 칩 묶음 하나 */
function choiceHTML(g, selArr){
  return `<div class="dgroup" data-g="${g.id}">
    <h5>${esc(g.title)}</h5>
    <div class="dopts">${g.options.map((o, i) => `<button type="button" class="dopt${g.emoji ? " solo" : ""}" aria-pressed="${selArr.includes(i)}" data-i="${i}">
      ${o.sw ? `<span class="sw">${o.sw.map(c => `<i style="background:${c}"></i>`).join("")}</span>` : ""}
      <span class="dl">${esc(o.label)}</span>${o.sub ? `<span class="ds">${esc(o.sub)}</span>` : ""}</button>`).join("")}</div>
  </div>`;
}
/* 칩을 눌렀을 때 선택값 바꾸기 (여러 개 선택 묶음은 켜고 끄기, 하나만 고르는 묶음은 바꾸기) */
function toggleChoice(selObj, g, i){
  const cur = selObj[g.id] || [];
  if(g.multi) selObj[g.id] = cur.includes(i) ? cur.filter(x => x !== i) : cur.concat(i).sort((a, b) => a - b);
  else selObj[g.id] = [i];
}

function panel(cls, title, intro, inner, foot){
  return `<details class="design-pick ${cls}" open>
    <summary>${title}</summary><p>${intro}</p>
    <div class="pick-inner">${inner}</div>
    <div class="dfoot">${foot}</div>
  </details>`;
}

/* ---------- P: 용도 고르기 ---------- */
function pInner(pk){ return CARD_P.map(g => choiceHTML(g, pk.p[g.id] || [])).join(""); }
function renderP(pk){
  pPick.innerHTML = panel("p-pick", "용도 고르기", "명함을 어디에, 누구에게 보여줄지 고르면 목적 문장이 만들어집니다.",
    pInner(pk), `<span class="dcount">${esc(buildCardP(pk.p).replace("\n", " "))}</span><button type="button" class="btn sm" data-act="p">P에 넣기</button>`);
}
pPick.addEventListener("click", e => {
  const p = practice(); if(p.builder !== "card") return;
  const pk = pick(p);
  const b = e.target.closest(".dopt");
  if(b){
    toggleChoice(pk.p, CARD_P.find(g => g.id === b.closest(".dgroup").dataset.g), +b.dataset.i);
    save(); renderP(pk); return;
  }
  if(e.target.dataset.act === "p") putInto({p1: buildCardP(pk.p)}, "목적 문장을 P에 넣었습니다");
});

/* ---------- R: 내용 고르기 + 내 정보 채우기 ---------- */
function renderR(pk){
  const groups = CARD_CONTENT.map(g => `<div class="dgroup">
      <h5>${esc(g.group)}</h5>${g.note ? `<p class="gnote">${esc(g.note)}</p>` : ""}
      <div class="dopts">${g.items.map(it => `<button type="button" class="dopt" aria-pressed="${pk.sel.includes(it.id)}" data-id="${it.id}">
        <span class="dl">${esc(it.label)}${it.base ? ' <span class="badge">기본</span>' : ""}</span><span class="ds">${esc(it.sub)}</span></button>`).join("")}</div>
    </div>`).join("");
  rContent.innerHTML = panel("content-pick", "내용 고르기",
    `명함에 보여줄 내용을 고르고 <b>내 정보</b>를 채우세요. <span class="badge">기본</span> 표시는 꼭 넣기를 권하는 항목입니다.`,
    groups + `<div class="myinfo"><h5>내 정보 채우기</h5><div id="infoFields"></div></div>`,
    `<span class="dcount" id="cCount"></span>
     <button type="button" class="btn ghost sm" data-act="base">기본 항목만</button>
     <button type="button" class="btn sm" data-act="r">R에 넣기</button>`);
  renderInfo(pk);
}

function renderInfo(pk){
  const chosen = allItems().filter(it => pk.sel.includes(it.id));
  document.getElementById("infoFields").innerHTML = chosen.length ? chosen.map(it => `<div class="info" data-id="${it.id}">
    <div class="info-head">${esc(it.label)}</div>
    ${it.fields.length ? it.fields.map(f => {
      const v = esc(((pk.vals[it.id] || {})[f.k]) || "");
      const id = `ci-${it.id}-${f.k}`;
      const hide = it.fields.length === 1 && f.label === it.label ? ' class="sr"' : "";
      return `<label for="${id}"${hide}>${esc(f.label)}</label>` + (f.area
        ? `<textarea id="${id}" data-id="${it.id}" data-k="${f.k}" rows="3" placeholder="${esc(f.ph)}">${v}</textarea>`
        : `<input id="${id}" type="text" data-id="${it.id}" data-k="${f.k}" placeholder="${esc(f.ph)}" value="${v}">`);
    }).join("") : '<p class="nofield">입력할 내용이 없습니다. 고르기만 하면 됩니다.</p>'}
  </div>`).join("") : '<p class="nofield">위에서 명함에 넣을 내용을 골라 주세요.</p>';
  updateCount(pk);
}

function countEmpty(pk){
  let n = 0;
  allItems().filter(it => pk.sel.includes(it.id)).forEach(it =>
    it.fields.forEach(f => { if(!(((pk.vals[it.id] || {})[f.k]) || "").trim()) n++; }));
  return n;
}
function updateCount(pk){
  const empty = countEmpty(pk);
  const el = document.getElementById("cCount");
  if(el) el.textContent = `${pk.sel.length}개 선택` + (empty ? ` · 빈 칸 ${empty}개` : " · 모두 채움");
}

rContent.addEventListener("click", e => {
  const p = practice(); if(p.builder !== "card") return;
  const pk = pick(p);
  const b = e.target.closest(".dopt");
  if(b){
    const set = new Set(pk.sel);
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    pk.sel = allItems().map(it => it.id).filter(x => set.has(x));   /* 화면 순서대로 정렬 */
    save();
    b.setAttribute("aria-pressed", set.has(b.dataset.id));
    renderInfo(pk); renderO(pk);   /* 고른 내용이 바뀌면 O의 영역 배치와 표현 방식도 바뀐다 */
    return;
  }
  const act = e.target.dataset.act;
  if(act === "base"){
    pk.sel = allItems().filter(it => it.base).map(it => it.id);
    save(); renderR(pk); renderO(pk);
    toast("기본 항목만 남겼습니다. 입력한 내용은 지워지지 않습니다");
  }
  if(act === "r"){
    if(!pk.sel.length){ toast("먼저 넣을 내용을 하나 이상 고르세요"); return; }
    const empty = countEmpty(pk);
    putInto({r: buildCardR(pk.sel, pk.vals)}, empty ? `R에 넣었습니다. 빈 칸 ${empty}개는 [ ] 표시로 남았습니다` : "내 정보를 R에 넣었습니다");
  }
});

rContent.addEventListener("input", e => {
  const el = e.target;
  if(!el.dataset || !el.dataset.id) return;
  const pk = pick(practice());
  (pk.vals[el.dataset.id] = pk.vals[el.dataset.id] || {})[el.dataset.k] = el.value;
  save(); updateCount(pk);
});

/* ---------- O: 화면 구성과 디자인 고르기 ---------- */
function renderO(pk){
  const s = {frame: CARD_O[0].options[(pk.o.frame || [0])[0]].v};
  const chosen = cardChosen(pk.sel);
  const has = ids => chosen.some(it => ids.includes(it.id));
  const visible = g => (!g.when || g.when(s)) && (!g.need || has(g.need));
  const secs = [...new Set(CARD_O.map(g => g.sec))];

  /* 영역별 내용 배치: R에서 고른 내용마다 어느 영역에 둘지 고른다 */
  const placed = chosen.filter(it => !CARD_NO_AREA.includes(it.id));
  const areaHTML = `<div class="dgroup areas">
    <h5>영역별 내용 배치</h5>
    <p class="gnote2">R에서 고른 내용을 어느 영역에 둘지 고르세요. 이름은 항상 첫 화면 제목입니다.</p>
    ${placed.length ? `<div class="area-list">${placed.map(it => {
      const cur = pk.areas[it.id] || CARD_AREA_DEFAULT[it.id] || "body";
      return `<div class="area-row" data-id="${it.id}"><span class="area-name">${esc(it.label)}</span>
        <span class="area-opts">${CARD_AREAS.map(a => `<button type="button" class="area-btn" aria-pressed="${a.v === cur}" data-a="${a.v}">${esc(a.label(s))}</button>`).join("")}</span></div>`;
    }).join("")}</div>` : '<p class="nofield">R에서 내용을 먼저 고르면 여기에 나타납니다.</p>'}
  </div>`;

  const inner = secs.map(sec => {
    const groups = CARD_O.filter(g => g.sec === sec && visible(g));
    if(!groups.length) return "";
    return `<div class="osec"><h4>${esc(sec)}</h4>${groups.map(g => choiceHTML(g, pk.o[g.id] || [])).join("")}${sec === "화면 틀" ? areaHTML : ""}</div>`;
  }).join("");

  oDesign.innerHTML = panel("o-pick", "화면 구성·디자인 고르기",
    "화면 틀, 영역별 내용, 표현 방식, 꾸밈을 고르면 O 문장이 만들어집니다. 모든 항목에 기본 선택이 있으니 바꾸고 싶은 것만 고르세요.",
    inner, `<span class="dcount">정보 표현 방식은 R에서 고른 내용에 맞춰 나타납니다</span>
      <button type="button" class="btn sm" data-act="o">O에 넣기</button>`);
}

oDesign.addEventListener("click", e => {
  const p = practice(); if(p.builder !== "card") return;
  const pk = pick(p);
  const b = e.target.closest(".dopt");
  if(b){
    toggleChoice(pk.o, CARD_O.find(g => g.id === b.closest(".dgroup").dataset.g), +b.dataset.i);
    save(); keepScroll(() => renderO(pk)); return;
  }
  const a = e.target.closest(".area-btn");
  if(a){
    pk.areas[a.closest(".area-row").dataset.id] = a.dataset.a;
    save(); keepScroll(() => renderO(pk)); return;
  }
  if(e.target.dataset.act === "o") putInto({o: cardO(pk)}, "화면 구성과 디자인을 O에 넣었습니다");
});

const cardO = pk => buildCardO(pk.o, cardChosen(pk.sel), pk.areas, myName(pk));

/* 다시 그릴 때 화면이 위아래로 튀지 않게 한다 */
function keepScroll(fn){
  const y = window.scrollY; fn(); window.scrollTo(0, y);
}

/* 고른 결과를 입력창에 넣는다 (기존 내용이 있으면 '되돌리기' 제공) */
function putInto(part, msg){
  const data = Object.assign(current(), part);
  replaceWith(data, msg);
}

/* ---------- 한 번에 채우기 ---------- */
buildAllBtn.addEventListener("click", () => {
  const p = practice(); if(p.builder !== "card") return;
  const pk = pick(p);
  if(!pk.sel.length){ toast("R에서 넣을 내용을 먼저 고르세요"); return; }
  const empty = countEmpty(pk);
  putInto({p1: buildCardP(pk.p), r: buildCardR(pk.sel, pk.vals), o: cardO(pk)},
    empty ? `P·R·O를 채웠습니다. R의 빈 칸 ${empty}개를 확인하세요` : "P·R·O를 모두 채웠습니다");
});

function renderCard(p){
  const on = p.builder === "card";
  buildAllBtn.hidden = !on;
  if(!on){ pPick.innerHTML = rContent.innerHTML = oDesign.innerHTML = ""; return; }
  const pk = pick(p);
  renderP(pk); renderR(pk); renderO(pk);
}

/* ---------- 테마 색만 고르기 (themePick 탭: O 입력창 아래) ---------- */
const THEME_GROUP = CARD_O.find(g => g.id === "theme");
const THEME_RE = /- 분위기는 '[^']+'로 한다\.[\s\S]*?로 설정한다\./;
function renderTheme(p){
  if(!p.themePick) return;
  const pk = state.picks[p.id] = state.picks[p.id] || {};
  if(!pk.theme) pk.theme = (THEME_GROUP.def || [0]).slice();
  oDesign.innerHTML = panel("o-pick", "테마 색 고르기",
    "화면 구성은 위 O 입력창에 직접 쓰고, 테마 색만 여기서 고르세요. <b>O에 넣기</b>를 누르면 O 끝에 테마 설정 문장이 들어갑니다. 이미 넣은 테마가 있으면 새로 고른 것으로 바뀝니다.",
    choiceHTML(Object.assign({}, THEME_GROUP, {title: "분위기"}), pk.theme),
    `<span class="dcount"></span><button type="button" class="btn sm" data-act="theme">O에 넣기</button>`);
}
oDesign.addEventListener("click", e => {
  const p = practice(); if(!p.themePick) return;
  const pk = state.picks[p.id];
  const b = e.target.closest(".dopt");
  if(b){ pk.theme = [+b.dataset.i]; save(); keepScroll(() => renderTheme(p)); return; }
  if(e.target.dataset.act === "theme"){
    const line = "- " + THEME_GROUP.options[pk.theme[0]].t;
    const o = current().o.replace(/\s+$/, "");
    const next = THEME_RE.test(o) ? o.replace(THEME_RE, line) : (o ? o + "\n" : "") + line;
    putInto({o: next}, THEME_RE.test(o) ? "O의 테마를 새로 고른 것으로 바꿨습니다" : "테마 설정을 O에 넣었습니다");
  }
});

/* 코드를 받은 다음에 할 일 + 이 탭의 후속 질문 예시 */
function renderAfter(p){
  const list = (p.followups || []).concat(COMMON_FU);
  afterEl.innerHTML = `
    <h3>코드를 받은 다음에는</h3>
    <ol class="steps">${(p.after || DEFAULT_AFTER).map(t => `<li>${esc(t)}</li>`).join("")}</ol>
    ${list.length ? `<h4>${p.id === "free" ? "후속 질문 틀" : esc(p.name) + " 후속 질문 예시"}</h4>
    <p class="fu-hint">질문은 코드를 읽은 뒤에 떠오른 것을 쓰는 것이 가장 좋습니다. 무엇을 물어야 할지 막막할 때 참고하세요.</p>
    ${followupHTML(list)}` : ""}`;
  bindFollowups(afterEl, list);
}

function update(){
  const data = current();
  builtBody.innerHTML = sectionsHTML(data) || '<div class="empty">왼쪽 입력창에 내용을 쓰면 여기에 프롬프트가 완성됩니다.</div>';
  let n = 0;
  EL.forEach((e, i) => { const on = !!data[e.k].trim(); if(on) n++; dots.children[i].classList.toggle("on", on); });
  progressText.textContent = `6개 중 ${n}개 작성`;
}

function fill(data){
  EL.forEach(e => { tas[e.k].value = (data && data[e.k]) || ""; autosize(tas[e.k]); });
  update();
}

function setDraft(data){
  if(hasText(data)) state.drafts[state.tab] = data; else delete state.drafts[state.tab];
  save();
}

function selectTab(id, focus){
  state.tab = id; save();
  renderTabs(); renderTask(); fill(state.drafts[id] || practice().defaults);
  if(focus) document.getElementById("tab-" + id).focus();
}

tabsEl.addEventListener("click", e => {
  const b = e.target.closest(".tab");
  if(b && b.dataset.id !== state.tab) selectTab(b.dataset.id);
});
tabsEl.addEventListener("keydown", e => {
  if(e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const i = PRACTICE.findIndex(p => p.id === state.tab);
  const next = (i + (e.key === "ArrowRight" ? 1 : -1) + PRACTICE.length) % PRACTICE.length;
  selectTab(PRACTICE[next].id, true);
  e.preventDefault();
});

Object.values(tas).forEach(ta => ta.addEventListener("input", () => {
  autosize(ta);
  const had = hasText(state.drafts[state.tab]);
  setDraft(current()); update();
  if(had !== hasText(state.drafts[state.tab])) renderTabs();
}));

/* 확인창(confirm) 대신 '되돌리기'를 제공한다. 일부 환경에서는 확인창이 막혀 버튼이 작동하지 않기 때문이다. */
function replaceWith(newData, msg){
  const before = current();
  fill(newData); setDraft(current()); renderTabs();
  if(hasText(before)){
    const tabAtTime = state.tab;
    toast(msg, { label:"되돌리기", run: () => {
      if(state.tab !== tabAtTime) selectTab(tabAtTime);
      fill(before); setDraft(current()); renderTabs(); toast("되돌렸습니다");
    }});
  }else{
    toast(msg);
  }
}

loadBtn.addEventListener("click", () => {
  const p = practice();
  if(p.example) replaceWith(p.example, `${p.name} 예시를 넣었습니다. 자유롭게 고쳐 보세요`);
});
document.getElementById("clearAll").addEventListener("click", () => {
  if(!hasText(current())){ toast("지울 내용이 없습니다"); return; }
  const d = practice().defaults;
  replaceWith(d || {}, d ? "모두 지웠습니다. M·P·T 기본값은 다시 넣었습니다" : "모두 지웠습니다");
});
document.getElementById("copyBuilt").addEventListener("click", () => copy(toText(current())));

selectTab(state.tab);

/* ---------- 좁은 화면: 사이드바 메뉴 ---------- */
const navEl = document.querySelector(".nav");
const menuBtn = document.getElementById("menuBtn");
const navBackdrop = document.getElementById("navBackdrop");
function setMenu(open){
  navEl.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
  menuBtn.setAttribute("aria-expanded", open);
  menuBtn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  if(open) navEl.querySelector("#navMenu a").focus();
}
menuBtn.addEventListener("click", () => setMenu(!navEl.classList.contains("open")));
navBackdrop.addEventListener("click", () => setMenu(false));
document.querySelectorAll("#navMenu a").forEach(a => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", e => {
  if(e.key === "Escape" && navEl.classList.contains("open")){ setMenu(false); menuBtn.focus(); }
});
/* 화면이 다시 넓어지면 열린 메뉴를 닫는다 */
matchMedia("(min-width: 961px)").addEventListener("change", m => { if(m.matches) setMenu(false); });

/* ---------- 메뉴 강조 ---------- */
const links = [...document.querySelectorAll(".nav a.link")];
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if(en.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
  });
}, { rootMargin: "-40% 0px -55% 0px" });
links.forEach(a => { const s = document.querySelector(a.getAttribute("href")); if(s) io.observe(s); });
