const STATUS_ORDER = ["active", "focus", "idle", "offline"];
const STATUS_LABEL = {
  active: "활동중",
  focus: "집중",
  idle: "대기",
  offline: "오프라인"
};

const NICKNAME_KEY = "agentoffice_nickname_v1";

const deskSlots = document.querySelectorAll(".desk-slot");
const crewGrid = document.querySelector("#crewGrid");
const deskTemplate = document.querySelector("#deskAvatarTemplate");
const cardTemplate = document.querySelector("#crewCardTemplate");
const copyLinkBtn = document.querySelector("#copyLinkBtn");
const shuffleStatusBtn = document.querySelector("#shuffleStatusBtn");
const nicknameModal = document.querySelector("#nicknameModal");
const nicknameForm = document.querySelector("#nicknameForm");
const nicknameInput = document.querySelector("#nicknameInput");

const appState = {
  selectedAgentId: "pm-02",
  nickname: "",
  agents: []
};

function buildAgents(nickname) {
  return [
    { id: "pm-02", name: "김피엠", role: "PM", status: "active", avatar: "assets/avatars/avatar-pm.svg" },
    { id: "be-03", name: nickname, role: "팀원", status: "focus", avatar: "assets/avatars/avatar-ops.svg" }
  ];
}

function renderEmptyDesk(slot) {
  const emptyNode = document.createElement("article");
  emptyNode.className = "desk-agent is-empty";

  const desk = document.createElement("div");
  desk.className = "desk";

  const label = document.createElement("span");
  label.className = "empty-tag";
  label.textContent = "빈 자리";

  emptyNode.appendChild(desk);
  emptyNode.appendChild(label);
  slot.appendChild(emptyNode);
}

function renderOffice() {
  deskSlots.forEach((slot) => {
    slot.textContent = "";
    const agent = appState.agents.find((item) => item.id === slot.dataset.agentId);

    if (!agent) {
      renderEmptyDesk(slot);
      return;
    }

    const node = deskTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector(".avatar-img");
    const tag = node.querySelector(".name-tag");

    node.dataset.agentId = agent.id;
    node.classList.add(`status-${agent.status}`);
    if (appState.selectedAgentId === agent.id) node.classList.add("is-selected");

    image.src = agent.avatar;
    image.alt = `${agent.name} 아바타`;
    tag.textContent = agent.name;
    tag.addEventListener("click", () => selectAgent(agent.id));

    slot.appendChild(node);
  });
}

function renderCrew() {
  crewGrid.textContent = "";

  appState.agents.forEach((agent) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const selectBtn = card.querySelector(".crew-select");
    const image = card.querySelector(".crew-avatar-img");
    const role = card.querySelector(".crew-role");
    const name = card.querySelector(".crew-name");
    const statusBtn = card.querySelector(".status-pill");

    card.dataset.agentId = agent.id;
    if (appState.selectedAgentId === agent.id) card.classList.add("is-selected");

    image.src = agent.avatar;
    image.alt = `${agent.name} 아바타`;
    role.textContent = agent.role;
    name.textContent = agent.name;

    statusBtn.classList.add(`status-${agent.status}`);
    statusBtn.textContent = STATUS_LABEL[agent.status];

    selectBtn.addEventListener("click", () => selectAgent(agent.id));
    statusBtn.addEventListener("click", () => cycleStatus(agent.id));

    crewGrid.appendChild(card);
  });
}

function rerender() {
  renderOffice();
  renderCrew();
}

function selectAgent(agentId) {
  if (!appState.agents.some((agent) => agent.id === agentId)) return;
  appState.selectedAgentId = agentId;
  rerender();
}

function cycleStatus(agentId) {
  const target = appState.agents.find((agent) => agent.id === agentId);
  if (!target) return;

  const current = STATUS_ORDER.indexOf(target.status);
  target.status = STATUS_ORDER[(current + 1) % STATUS_ORDER.length];
  rerender();
}

function shuffleStatuses() {
  appState.agents.forEach((agent) => {
    agent.status = STATUS_ORDER[Math.floor(Math.random() * STATUS_ORDER.length)];
  });
  rerender();
}

async function copyShareLink() {
  const link = window.location.href;
  try {
    await navigator.clipboard.writeText(link);
    const original = copyLinkBtn.textContent;
    copyLinkBtn.textContent = "복사됨";
    setTimeout(() => { copyLinkBtn.textContent = original; }, 900);
  } catch (_error) {
    window.prompt("이 링크를 복사하세요:", link);
  }
}

function startWithNickname(rawNickname) {
  const nickname = (rawNickname || "").trim().slice(0, 12);
  if (!nickname) return;

  appState.nickname = nickname;
  appState.agents = buildAgents(nickname);
  appState.selectedAgentId = "be-03";
  localStorage.setItem(NICKNAME_KEY, nickname);

  nicknameModal.classList.remove("is-open");
  rerender();
}

function init() {
  const saved = localStorage.getItem(NICKNAME_KEY);
  if (saved) {
    startWithNickname(saved);
    return;
  }

  appState.agents = [{ id: "pm-02", name: "김피엠", role: "PM", status: "active", avatar: "assets/avatars/avatar-pm.svg" }];
  appState.selectedAgentId = "pm-02";
  rerender();

  nicknameModal.classList.add("is-open");
  nicknameInput.focus();
}

nicknameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startWithNickname(nicknameInput.value);
});

copyLinkBtn.addEventListener("click", copyShareLink);
shuffleStatusBtn.addEventListener("click", shuffleStatuses);

init();
