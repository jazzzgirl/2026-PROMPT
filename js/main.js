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
let state = { tab: PRACTICE[0].id, drafts: {} };
try{
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if(saved && saved.drafts) state = { tab: saved.tab || state.tab, drafts: saved.drafts };
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

form.innerHTML = EL.map(e =>
  `<div class="field" data-k="${e.k}">
     <label for="f-${e.k}"><span class="plabel">${esc(e.label)}</span><span class="hint">${e.q}</span></label>
     <textarea id="f-${e.k}" rows="3" placeholder="${esc(e.ph)}"></textarea>
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
  loadBtn.hidden = !p.example;
  loadBtn.textContent = p.example ? `${p.name} 예시 넣기` : "";
}

/* 코드를 받은 다음에 할 일 + 이 탭의 후속 질문 예시 */
function renderAfter(p){
  const list = (p.followups || []).concat(COMMON_FU);
  afterEl.innerHTML = `
    <h3>코드를 받은 다음에는</h3>
    <ol class="steps">
      <li>O에 적은 실행 화면 예시를 그대로 입력해 결과가 같은지 직접 확인합니다.</li>
      <li>AI가 제안한 테스트 표의 값을 차례로 넣어 결과를 비교하고, 기대 결과 중 하나 이상은 계산기로 직접 확인합니다.</li>
      <li>주석과 실행 순서 요약을 읽으며 이해가 안 되는 줄에 표시합니다.</li>
      <li>표시한 줄이나 결과가 다른 부분을 그대로 인용해서 AI에게 후속 질문을 합니다.</li>
    </ol>
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
  renderTabs(); renderTask(); fill(state.drafts[id]);
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
  replaceWith({}, "모두 지웠습니다");
});
document.getElementById("copyBuilt").addEventListener("click", () => copy(toText(current())));

selectTab(state.tab);

/* ---------- 메뉴 강조 ---------- */
const links = [...document.querySelectorAll(".nav a.link")];
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if(en.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
  });
}, { rootMargin: "-40% 0px -55% 0px" });
links.forEach(a => { const s = document.querySelector(a.getAttribute("href")); if(s) io.observe(s); });
