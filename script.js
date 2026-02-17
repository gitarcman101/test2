import * as Y from "https://cdn.jsdelivr.net/npm/yjs@13.6.18/+esm";
import { WebsocketProvider } from "https://cdn.jsdelivr.net/npm/y-websocket@1.5.0/+esm";
import { WebrtcProvider } from "https://cdn.jsdelivr.net/npm/y-webrtc@10.3.0/+esm";

const STATUS_ORDER = ["active", "focus", "idle", "offline"];
const STATUS_LABEL = {
  active: "활동중",
  focus: "집중",
  idle: "대기",
  offline: "오프라인"
};

const CLIENT_KEY = "agentoffice_client_v1";
const NICKNAME_KEY = "agentoffice_nickname_v2";
const ROOM_PARAM = "room";
const PRESENCE_TTL_MS = 35000;
const HEARTBEAT_MS = 10000;

const PM_SEAT_ID = "U2";
const SEAT_IDS = ["U1", "U2", "U3", "U4", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "R1", "R2"];
const AVAILABLE_SEATS = SEAT_IDS.filter((seatId) => seatId !== PM_SEAT_ID);

const AVATARS = [
  "assets/avatars/avatar-ops.svg",
  "assets/avatars/avatar-be.svg",
  "assets/avatars/avatar-data.svg",
  "assets/avatars/avatar-design.svg",
  "assets/avatars/avatar-plan.svg",
  "assets/avatars/avatar-qa.svg",
  "assets/avatars/avatar-pm.svg"
];

const PM_AGENT = {
  id: "pm-fixed",
  clientId: "pm-fixed",
  name: "김피엠",
  role: "PM",
  status: "active",
  avatar: "assets/avatars/avatar-pm.svg",
  seatId: PM_SEAT_ID,
  isLocal: false,
  isPm: true,
  updatedAt: 0
};

const deskSlots = document.querySelectorAll(".desk-slot");
const crewGrid = document.querySelector("#crewGrid");
const deskTemplate = document.querySelector("#deskAvatarTemplate");
const cardTemplate = document.querySelector("#crewCardTemplate");
const copyLinkBtn = document.querySelector("#copyLinkBtn");
const shuffleStatusBtn = document.querySelector("#shuffleStatusBtn");
const nicknameModal = document.querySelector("#nicknameModal");
const nicknameForm = document.querySelector("#nicknameForm");
const nicknameInput = document.querySelector("#nicknameInput");
const roomCode = document.querySelector("#roomCode");
const syncInfo = document.querySelector("#syncInfo");

const appState = {
  roomId: "",
  clientId: "",
  selectedAgentId: PM_AGENT.id,
  participants: [],
  localJoined: false,
  updateMyStatus: () => {},
  wsConnected: false,
  rtcConnected: false
};

function ensureClientId() {
  let clientId = localStorage.getItem(CLIENT_KEY);
  if (!clientId) {
    clientId = `c-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_KEY, clientId);
  }
  return clientId;
}

function resolveRoomId() {
  const params = new URLSearchParams(window.location.search);
  const room = (params.get(ROOM_PARAM) || "demo-01").trim();
  const roomId = room.slice(0, 40) || "demo-01";
  params.set(ROOM_PARAM, roomId);
  history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  return roomId;
}

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function avatarForName(name) {
  return AVATARS[hashText(name) % AVATARS.length];
}

function getDisplayRole(seatId) {
  return seatId.startsWith("R") ? "회의실" : "팀원";
}

function sortBySeat(a, b) {
  return SEAT_IDS.indexOf(a.seatId) - SEAT_IDS.indexOf(b.seatId);
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

function renderOffice(agents) {
  deskSlots.forEach((slot) => {
    slot.textContent = "";
    const seatId = slot.dataset.seatId;
    const agent = agents.find((item) => item.seatId === seatId);

    if (!agent) {
      renderEmptyDesk(slot);
      return;
    }

    const node = deskTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector(".avatar-img");
    const tag = node.querySelector(".name-tag");

    node.dataset.agentId = agent.id;
    node.classList.add(`status-${agent.status}`);
    if (appState.selectedAgentId === agent.id) {
      node.classList.add("is-selected");
    }

    image.src = agent.avatar;
    image.alt = `${agent.name} 아바타`;
    tag.textContent = agent.name;
    tag.addEventListener("click", () => {
      appState.selectedAgentId = agent.id;
      rerender();
    });

    slot.appendChild(node);
  });
}

function renderCrew(agents, updateMyStatus) {
  crewGrid.textContent = "";

  agents.forEach((agent) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const selectBtn = card.querySelector(".crew-select");
    const image = card.querySelector(".crew-avatar-img");
    const role = card.querySelector(".crew-role");
    const name = card.querySelector(".crew-name");
    const statusBtn = card.querySelector(".status-pill");

    card.dataset.agentId = agent.id;
    if (appState.selectedAgentId === agent.id) {
      card.classList.add("is-selected");
    }

    image.src = agent.avatar;
    image.alt = `${agent.name} 아바타`;
    role.textContent = agent.role;
    name.textContent = agent.name;

    statusBtn.classList.add(`status-${agent.status}`);
    statusBtn.textContent = STATUS_LABEL[agent.status];

    if (!agent.isLocal || agent.isPm) {
      statusBtn.disabled = true;
      statusBtn.title = "내 상태만 변경할 수 있습니다.";
    } else {
      statusBtn.addEventListener("click", () => updateMyStatus());
    }

    selectBtn.addEventListener("click", () => {
      appState.selectedAgentId = agent.id;
      rerender();
    });

    crewGrid.appendChild(card);
  });
}

function rerender(updateMyStatus = appState.updateMyStatus) {
  const agents = [PM_AGENT, ...appState.participants].sort(sortBySeat);
  renderOffice(agents);
  renderCrew(agents, updateMyStatus);
}

function getLocalParticipant() {
  return appState.participants.find((participant) => participant.isLocal);
}

function pickSeatForLocal(currentSeatId) {
  const takenByOthers = new Set(
    appState.participants
      .filter((participant) => !participant.isLocal)
      .map((participant) => participant.seatId)
      .filter((seatId) => seatId && seatId !== PM_SEAT_ID)
  );

  if (currentSeatId && !takenByOthers.has(currentSeatId) && currentSeatId !== PM_SEAT_ID) {
    return currentSeatId;
  }

  return AVAILABLE_SEATS.find((seatId) => !takenByOthers.has(seatId)) || null;
}

function updateSyncLabel() {
  const anyConnected = appState.wsConnected || appState.rtcConnected;
  const activeCount = appState.participants.length + 1; // + PM
  const mode = anyConnected ? "연결됨" : "재연결중";
  syncInfo.textContent = `${mode} / 접속 ${activeCount}명 / ${new Date().toLocaleTimeString()}`;
}

function initRealtime() {
  appState.clientId = ensureClientId();
  appState.roomId = resolveRoomId();
  roomCode.textContent = `룸 ${appState.roomId.toUpperCase()}`;

  const doc = new Y.Doc();
  const wsProvider = new WebsocketProvider("wss://demos.yjs.dev", `agentoffice-${appState.roomId}`, doc);
  const rtcProvider = new WebrtcProvider(`agentoffice-${appState.roomId}`, doc, {
    signaling: [
      "wss://signaling.yjs.dev",
      "wss://y-webrtc-signaling-eu.herokuapp.com",
      "wss://y-webrtc-signaling-us.herokuapp.com"
    ],
    maxConns: 20,
    filterBcConns: false
  });

  const participantsMap = doc.getMap("participants");

  wsProvider.on("status", (event) => {
    appState.wsConnected = event.status === "connected";
    updateSyncLabel();
  });

  rtcProvider.on("status", (event) => {
    appState.rtcConnected = Boolean(event.connected);
    updateSyncLabel();
  });

  function setMyRecord(patch = {}) {
    const prev = participantsMap.get(appState.clientId) || {};
    participantsMap.set(appState.clientId, {
      ...prev,
      ...patch,
      clientId: appState.clientId,
      updatedAt: Date.now()
    });
  }

  function hydrateParticipants() {
    const now = Date.now();
    const next = [];
    const staleKeys = [];

    participantsMap.forEach((value, key) => {
      if (!value || typeof value !== "object" || !value.nickname || !value.seatId) {
        return;
      }

      const age = now - (value.updatedAt || 0);
      if (key !== appState.clientId && age > PRESENCE_TTL_MS) {
        staleKeys.push(key);
        return;
      }

      next.push({
        id: value.clientId,
        clientId: value.clientId,
        name: value.nickname,
        role: getDisplayRole(value.seatId),
        status: STATUS_ORDER.includes(value.status) ? value.status : "active",
        avatar: value.avatar || avatarForName(value.nickname),
        seatId: value.seatId,
        isLocal: value.clientId === appState.clientId,
        isPm: false,
        updatedAt: value.updatedAt || 0
      });
    });

    staleKeys.forEach((key) => participantsMap.delete(key));
    appState.participants = next.sort(sortBySeat);

    const me = getLocalParticipant();
    if (appState.localJoined && me) {
      const nextSeat = pickSeatForLocal(me.seatId);
      if (!nextSeat) {
        participantsMap.delete(appState.clientId);
        appState.localJoined = false;
        alert("빈 자리가 없습니다. 잠시 후 다시 시도해주세요.");
        nicknameModal.classList.add("is-open");
      } else if (nextSeat !== me.seatId) {
        setMyRecord({ seatId: nextSeat });
        localStorage.setItem(`${NICKNAME_KEY}:seat:${appState.roomId}`, nextSeat);
      }
    }

    updateSyncLabel();
    rerender(cycleMyStatus);
  }

  function tryJoinWithNickname(rawName) {
    const nickname = (rawName || "").trim().slice(0, 12);
    if (!nickname) {
      return false;
    }

    hydrateParticipants();
    const preferredSeat = localStorage.getItem(`${NICKNAME_KEY}:seat:${appState.roomId}`) || "";
    const seatId = pickSeatForLocal(preferredSeat);
    if (!seatId) {
      alert("현재 14석이 모두 사용 중입니다.");
      return false;
    }

    localStorage.setItem(NICKNAME_KEY, nickname);
    localStorage.setItem(`${NICKNAME_KEY}:seat:${appState.roomId}`, seatId);

    appState.localJoined = true;
    setMyRecord({
      nickname,
      seatId,
      status: "focus",
      avatar: avatarForName(nickname)
    });
    appState.selectedAgentId = appState.clientId;
    nicknameModal.classList.remove("is-open");
    return true;
  }

  function cycleMyStatus() {
    const me = getLocalParticipant();
    if (!me) {
      return;
    }
    const current = STATUS_ORDER.indexOf(me.status);
    const next = STATUS_ORDER[(current + 1) % STATUS_ORDER.length];
    setMyRecord({ status: next });
  }

  appState.updateMyStatus = cycleMyStatus;

  participantsMap.observe(hydrateParticipants);

  nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    tryJoinWithNickname(nicknameInput.value);
  });

  shuffleStatusBtn.addEventListener("click", cycleMyStatus);
  copyLinkBtn.addEventListener("click", async () => {
    const url = new URL(window.location.href);
    url.searchParams.set(ROOM_PARAM, appState.roomId);
    const link = url.toString();
    try {
      await navigator.clipboard.writeText(link);
      const original = copyLinkBtn.textContent;
      copyLinkBtn.textContent = "복사됨";
      setTimeout(() => { copyLinkBtn.textContent = original; }, 900);
    } catch (_error) {
      window.prompt("이 링크를 복사하세요:", link);
    }
  });

  const savedNickname = localStorage.getItem(NICKNAME_KEY);
  if (savedNickname) {
    nicknameInput.value = savedNickname;
    const joined = tryJoinWithNickname(savedNickname);
    if (!joined) {
      nicknameModal.classList.add("is-open");
      nicknameInput.focus();
    }
  } else {
    appState.participants = [];
    rerender(cycleMyStatus);
    updateSyncLabel();
    nicknameModal.classList.add("is-open");
    nicknameInput.focus();
  }

  const heartbeat = setInterval(() => {
    if (!appState.localJoined) {
      return;
    }
    setMyRecord({});
  }, HEARTBEAT_MS);

  window.addEventListener("beforeunload", () => {
    clearInterval(heartbeat);
    participantsMap.delete(appState.clientId);
    wsProvider.destroy();
    rtcProvider.destroy();
    doc.destroy();
  });
}

initRealtime();
