import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const STATUS_ORDER = ["active", "focus", "idle", "offline"];
const STATUS_LABEL = {
  active: "활동중",
  focus: "집중",
  idle: "대기",
  offline: "오프라인"
};

const CLIENT_KEY = "agentoffice_client_v1";
const NICKNAME_KEY = "agentoffice_nickname_v2";
const AVATAR_KEY = "agentoffice_avatar_v1";
const ROOM_PARAM = "room";
const SB_URL_KEY = "agentoffice_sb_url_v1";
const SB_ANON_KEY = "agentoffice_sb_anon_v1";
const HEARTBEAT_MS = 12000;
const BUBBLE_TTL_MS = 18000;

const PM_SEAT_ID = "PM_FIXED";
const DESK_SEAT_IDS = ["U1", "U2", "U3", "U4", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"];
const MEETING_ROOM_IDS = ["A", "B"];
const MEETING_ROOM_CAPACITY = 10;
const MEETING_SEAT_IDS_BY_ROOM = Object.fromEntries(
  MEETING_ROOM_IDS.map((roomId) => [
    roomId,
    Array.from({ length: MEETING_ROOM_CAPACITY }, (_, index) => `R${roomId}${index + 1}`)
  ])
);
const MEETING_SEAT_IDS = MEETING_ROOM_IDS.flatMap((roomId) => MEETING_SEAT_IDS_BY_ROOM[roomId]);
const SEAT_IDS = [...DESK_SEAT_IDS, ...MEETING_SEAT_IDS];
const MAX_CONCURRENT_USERS = 14;
const AVAILABLE_SEATS = [...DESK_SEAT_IDS, ...MEETING_SEAT_IDS];
const MAX_RECENT_MESSAGES = 5;
const MAX_MESSAGES = 120;

const AVATARS = [
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969749.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969755.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969774.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969777.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969789.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969801.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969802.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969809.svg",
  "assets/avatars/vecteezy_illustration-of-characters-in-super-mario-in-vector-cartoon_24804505.svg",
  "assets/avatars/vecteezy_illustration-of-characters-in-super-mario-in-vector-cartoon_24804535.svg",
  "assets/avatars/vecteezy_illustration-of-characters-in-super-mario-in-vector-cartoon_24804574.svg",
  "assets/avatars/vecteezy_star-bonus-game-super-mario-video-game-90s_23079358.svg"
];

const PM_AGENT = {
  id: "pm-fixed",
  clientId: "pm-fixed",
  name: "김피엠",
  role: "PM",
  status: "active",
  avatar: AVATARS[0],
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
const fixedPmSeat = document.querySelector("#fixedPmSeat");

const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const quickMessageForm = document.querySelector("#quickMessageForm");
const quickMessageInput = document.querySelector("#quickMessageInput");
const messageRecent = document.querySelector("#messageRecent");
const messageHistory = document.querySelector("#messageHistory");
const messageHistorySummary = document.querySelector("#messageHistorySummary");
const messageHistoryList = document.querySelector("#messageHistoryList");
const MAX_MESSAGE_LENGTH = Math.max(
  1,
  Number(messageInput?.maxLength || quickMessageInput?.maxLength || 220)
);

const meetingRoomCountNodes = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-room-count]")).map((node) => [node.dataset.roomCount, node])
);
const meetingRoomAvatarNodes = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-room-avatars]")).map((node) => [node.dataset.roomAvatars, node])
);
const meetingRoomEnterButtons = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-room-enter]")).map((node) => [node.dataset.roomEnter, node])
);

const appState = {
  roomId: "",
  clientId: "",
  selectedAgentId: PM_AGENT.id,
  participants: [],
  localJoined: false,
  localPresence: null,
  channel: null,
  subscribed: false,
  updateMyStatus: () => {},
  messages: [],
  seenMessageIds: new Set(),
  bubbles: new Map()
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

function resolveSupabaseConfig() {
  const params = new URLSearchParams(window.location.search);
  const queryUrl = params.get("sbUrl") || "";
  const queryKey = params.get("sbKey") || "";

  if (queryUrl && queryKey) {
    localStorage.setItem(SB_URL_KEY, queryUrl);
    localStorage.setItem(SB_ANON_KEY, queryKey);
  }

  const globalConfig = window.SUPABASE_CONFIG || {};
  const url = (globalConfig.url || localStorage.getItem(SB_URL_KEY) || "").trim();
  const anonKey = (globalConfig.anonKey || localStorage.getItem(SB_ANON_KEY) || "").trim();
  return { url, anonKey };
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

function pickRandomAvatar() {
  if (!AVATARS.length) return "";
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

function resolveLocalAvatar() {
  const storageKey = `${AVATAR_KEY}:${appState.roomId}:${appState.clientId}`;
  const stored = localStorage.getItem(storageKey) || "";
  if (stored && AVATARS.includes(stored)) {
    return stored;
  }

  const next = pickRandomAvatar();
  localStorage.setItem(storageKey, next);
  return next;
}

function getMeetingRoomIdFromSeatId(seatId) {
  if (typeof seatId !== "string") return "";
  if (seatId.startsWith("RA")) return "A";
  if (seatId.startsWith("RB")) return "B";
  return "";
}

function getDisplayRole(seatId) {
  const roomId = getMeetingRoomIdFromSeatId(seatId);
  return roomId ? `회의실 ${roomId}` : "데스크";
}

function sortBySeat(a, b) {
  const aIndex = SEAT_IDS.indexOf(a.seatId);
  const bIndex = SEAT_IDS.indexOf(b.seatId);
  const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
  const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
  return safeA - safeB;
}

function getLocalParticipant() {
  return appState.participants.find((participant) => participant.isLocal);
}

function getTakenSeatsByOthers() {
  return new Set(
    appState.participants
      .filter((participant) => !participant.isLocal)
      .map((participant) => participant.seatId)
      .filter((seatId) => AVAILABLE_SEATS.includes(seatId))
  );
}

function pickSeatForLocal(currentSeatId) {
  const takenByOthers = getTakenSeatsByOthers();
  if (currentSeatId && AVAILABLE_SEATS.includes(currentSeatId) && !takenByOthers.has(currentSeatId)) {
    return currentSeatId;
  }
  return AVAILABLE_SEATS.find((seatId) => !takenByOthers.has(seatId)) || null;
}

function pickMeetingSeat(roomId, currentSeatId = "") {
  const roomSeats = MEETING_SEAT_IDS_BY_ROOM[roomId] || [];
  const takenByOthers = getTakenSeatsByOthers();
  if (currentSeatId && roomSeats.includes(currentSeatId) && !takenByOthers.has(currentSeatId)) {
    return currentSeatId;
  }
  return roomSeats.find((seatId) => !takenByOthers.has(seatId)) || null;
}

function getBubbleText(clientId) {
  if (!clientId) return "";
  const bubble = appState.bubbles.get(clientId);
  if (!bubble) return "";
  if (bubble.until < Date.now()) {
    appState.bubbles.delete(clientId);
    return "";
  }
  return bubble.text;
}

function setBubble(clientId, text) {
  if (!clientId || !text) return;
  appState.bubbles.set(clientId, {
    text: String(text).trim().slice(0, MAX_MESSAGE_LENGTH),
    until: Date.now() + BUBBLE_TTL_MS
  });
}

function cleanupBubbles() {
  const now = Date.now();
  let changed = false;
  appState.bubbles.forEach((value, key) => {
    if (value.until < now) {
      appState.bubbles.delete(key);
      changed = true;
    }
  });
  if (changed) {
    rerender(cycleMyStatus);
  }
}

async function moveLocalToSeat(targetSeatId) {
  if (!appState.localJoined) return;
  if (!AVAILABLE_SEATS.includes(targetSeatId)) return;

  const me = getLocalParticipant();
  if (!me || me.seatId === targetSeatId) return;

  if (getTakenSeatsByOthers().has(targetSeatId)) {
    alert("이미 사용 중인 자리입니다.");
    return;
  }

  appState.selectedAgentId = appState.clientId;
  localStorage.setItem(`${NICKNAME_KEY}:seat:${appState.roomId}`, targetSeatId);
  await publishPresence({ seatId: targetSeatId, status: "focus" });
}

async function moveLocalToMeetingRoom(roomId) {
  if (!appState.localJoined || !MEETING_ROOM_IDS.includes(roomId)) return;
  const me = getLocalParticipant();
  const nextSeat = pickMeetingSeat(roomId, me ? me.seatId : "");
  if (!nextSeat) {
    alert(`회의실 ${roomId}는 최대 ${MEETING_ROOM_CAPACITY}명까지 입장 가능합니다.`);
    return;
  }
  await moveLocalToSeat(nextSeat);
}

function updateSyncLabel(text) {
  syncInfo.textContent = text;
}

function updateMessageInputState() {
  const enabled = appState.localJoined;
  if (messageForm && messageInput) {
    const submitBtn = messageForm.querySelector("button");
    messageInput.disabled = !enabled;
    submitBtn.disabled = !enabled;
    messageInput.placeholder = enabled ? "메시지 입력 (Enter 전송)" : "입장 후 메시지를 입력할 수 있습니다.";
  }

  if (quickMessageForm && quickMessageInput) {
    const quickSubmitBtn = quickMessageForm.querySelector("button");
    quickMessageInput.disabled = !enabled;
    quickSubmitBtn.disabled = !enabled;
    quickMessageInput.placeholder = enabled
      ? "메시지 빠른 입력 (Enter 전송)"
      : "입장 후 메시지를 입력할 수 있습니다.";
  }
}

async function submitMessageFromInput(inputEl) {
  if (!inputEl) return;
  const text = inputEl.value;
  inputEl.value = "";
  await sendMessage(text);
}

function createDeskAgentNode(agent, facing = "down") {
  const node = deskTemplate.content.firstElementChild.cloneNode(true);
  const image = node.querySelector(".avatar-img");
  const tag = node.querySelector(".name-tag");

  node.dataset.agentId = agent.id;
  node.classList.add(`status-${agent.status}`);
  if (facing === "up") {
    node.classList.add("is-facing-up");
  } else {
    node.classList.add("is-facing-down");
  }
  if (appState.selectedAgentId === agent.id) {
    node.classList.add("is-selected");
  }

  const bubbleText = getBubbleText(agent.clientId);
  if (bubbleText) {
    const bubble = document.createElement("div");
    bubble.className = "speech-bubble";
    bubble.textContent = bubbleText;
    node.prepend(bubble);
  }

  image.src = agent.avatar;
  image.alt = `${agent.name} 아바타`;
  tag.textContent = agent.name;
  tag.addEventListener("click", () => {
    appState.selectedAgentId = agent.id;
    rerender();
  });

  return node;
}

function renderFixedPm() {
  if (!fixedPmSeat) return;
  fixedPmSeat.textContent = "";
  fixedPmSeat.appendChild(createDeskAgentNode(PM_AGENT, "down"));
}

function renderEmptyDesk(slot, seatId) {
  if (seatId === "U1") return;

  const emptyNode = document.createElement("article");
  emptyNode.className = "desk-agent is-empty";

  const desk = document.createElement("div");
  desk.className = "desk";

  const label = document.createElement("span");
  label.className = "empty-tag";
  label.textContent = "빈 자리";

  emptyNode.appendChild(desk);
  emptyNode.appendChild(label);

  if (appState.localJoined) {
    const moveButton = document.createElement("button");
    moveButton.type = "button";
    moveButton.className = "move-seat-btn";
    moveButton.textContent = "여기로 이동";
    moveButton.addEventListener("click", () => moveLocalToSeat(seatId));
    emptyNode.appendChild(moveButton);
  }

  slot.appendChild(emptyNode);
}

function renderOffice(seatAgents) {
  deskSlots.forEach((slot) => {
    slot.textContent = "";
    const seatId = slot.dataset.seatId;
    const facing = slot.dataset.facing || "down";
    const agent = seatAgents.find((item) => item.seatId === seatId);
    if (!agent) {
      renderEmptyDesk(slot, seatId);
      return;
    }
    slot.appendChild(createDeskAgentNode(agent, facing));
  });
}

function renderMeetingRooms(seatAgents) {
  const me = getLocalParticipant();
  const myRoomId = me ? getMeetingRoomIdFromSeatId(me.seatId) : "";

  MEETING_ROOM_IDS.forEach((roomId) => {
    const roomSeats = MEETING_SEAT_IDS_BY_ROOM[roomId];
    const members = seatAgents
      .filter((agent) => roomSeats.includes(agent.seatId))
      .sort(sortBySeat);

    const countNode = meetingRoomCountNodes[roomId];
    if (countNode) {
      countNode.textContent = `${members.length}/${MEETING_ROOM_CAPACITY}`;
    }

    const avatarsNode = meetingRoomAvatarNodes[roomId];
    if (avatarsNode) {
      avatarsNode.textContent = "";
      if (members.length === 0) {
        const empty = document.createElement("p");
        empty.className = "meeting-empty";
        empty.textContent = "참여자 없음";
        avatarsNode.appendChild(empty);
      } else {
        members.forEach((agent) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = `meeting-agent status-${agent.status}`;
          if (appState.selectedAgentId === agent.id) {
            chip.classList.add("is-selected");
          }

          const bubbleText = getBubbleText(agent.clientId);
          if (bubbleText) {
            const bubble = document.createElement("span");
            bubble.className = "meeting-bubble";
            bubble.textContent = bubbleText;
            chip.appendChild(bubble);
          }

          const image = document.createElement("img");
          image.className = "meeting-agent-avatar";
          image.src = agent.avatar;
          image.alt = `${agent.name} 아바타`;

          const name = document.createElement("span");
          name.className = "meeting-agent-name";
          name.textContent = agent.name;

          chip.appendChild(image);
          chip.appendChild(name);
          chip.addEventListener("click", () => {
            appState.selectedAgentId = agent.id;
            rerender();
          });

          avatarsNode.appendChild(chip);
        });
      }
    }

    const enterButton = meetingRoomEnterButtons[roomId];
    if (enterButton) {
      const isSameRoom = myRoomId === roomId;
      const isFull = members.length >= MEETING_ROOM_CAPACITY;
      enterButton.textContent = isSameRoom ? `회의실 ${roomId} 사용 중` : `회의실 ${roomId} 입장`;
      enterButton.disabled = !appState.localJoined || (!isSameRoom && isFull);
    }
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

function createMessageItem(message) {
  const item = document.createElement("li");
  item.className = "message-item";

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const meta = document.createElement("span");
  meta.className = "message-meta";
  meta.textContent = `${time} · ${message.nickname}`;

  const body = document.createElement("p");
  body.className = "message-text";
  body.textContent = message.text;

  item.appendChild(meta);
  item.appendChild(body);
  return item;
}

function renderMessages() {
  if (!messageRecent || !messageHistory || !messageHistorySummary || !messageHistoryList) return;

  const recent = appState.messages.slice(-MAX_RECENT_MESSAGES);
  const older = appState.messages.slice(0, -MAX_RECENT_MESSAGES);

  messageRecent.textContent = "";
  recent.forEach((message) => {
    messageRecent.appendChild(createMessageItem(message));
  });

  messageHistoryList.textContent = "";
  older.forEach((message) => {
    messageHistoryList.appendChild(createMessageItem(message));
  });

  if (older.length === 0) {
    messageHistory.open = false;
    messageHistory.hidden = true;
  } else {
    messageHistory.hidden = false;
    messageHistorySummary.textContent = `이전 메시지 ${older.length}개`;
  }
}

function resolveSpeakerClientId(message) {
  if (message.clientId) return message.clientId;
  const matched = appState.participants.filter((p) => p.name === message.nickname);
  if (matched.length === 1) return matched[0].clientId;
  if (appState.localJoined) {
    const me = getLocalParticipant();
    if (me && me.name === message.nickname) return me.clientId;
  }
  return "";
}

function appendMessage(message) {
  if (!message || !message.id || appState.seenMessageIds.has(message.id)) return;
  appState.seenMessageIds.add(message.id);
  appState.messages.push(message);

  if (appState.messages.length > MAX_MESSAGES) {
    const removed = appState.messages.splice(0, appState.messages.length - MAX_MESSAGES);
    removed.forEach((item) => appState.seenMessageIds.delete(item.id));
  }

  const clientId = resolveSpeakerClientId(message);
  if (clientId) {
    setBubble(clientId, message.text);
  }
  rerender(cycleMyStatus);
}

function normalizeMessagePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const id = String(payload.id || "").trim();
  const clientId = String(payload.clientId || "").trim();
  const nickname = String(payload.nickname || "").trim().slice(0, 12);
  const text = String(payload.text || "").trim().slice(0, MAX_MESSAGE_LENGTH);
  const createdAt = Number(payload.createdAt || Date.now());
  if (!id || !nickname || !text) return null;
  return { id, clientId, nickname, text, createdAt };
}

async function sendMessage(rawText) {
  if (!appState.localJoined || !appState.channel || !appState.subscribed) return;
  const me = getLocalParticipant();
  if (!me) return;

  const text = String(rawText || "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return;

  const payload = {
    id: `m-${appState.clientId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId: appState.clientId,
    nickname: me.name,
    text,
    createdAt: Date.now()
  };

  const result = await appState.channel.send({
    type: "broadcast",
    event: "message",
    payload
  });

  if (result !== "ok") {
    alert("메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

function rerender(updateMyStatus = appState.updateMyStatus) {
  const seatAgents = [...appState.participants].sort(sortBySeat);
  const crewAgents = [PM_AGENT, ...seatAgents];
  renderFixedPm();
  renderOffice(seatAgents);
  renderMeetingRooms(seatAgents);
  renderCrew(crewAgents, updateMyStatus);
  renderMessages();
  updateMessageInputState();
}

function parsePresenceState(channel) {
  const state = channel.presenceState();
  const latestByClient = new Map();
  const bestBySeat = new Map();

  Object.values(state).forEach((items) => {
    const list = Array.isArray(items) ? items : [];
    list.forEach((item) => {
      if (!item || !item.clientId || !item.nickname || !item.seatId) return;
      if (!SEAT_IDS.includes(item.seatId)) return;
      const prev = latestByClient.get(item.clientId);
      if (!prev || (item.updatedAt || 0) >= (prev.updatedAt || 0)) {
        latestByClient.set(item.clientId, item);
      }
    });
  });

  Array.from(latestByClient.values()).forEach((item) => {
    const prev = bestBySeat.get(item.seatId);
    if (!prev || `${item.updatedAt || 0}-${item.clientId}` > `${prev.updatedAt || 0}-${prev.clientId}`) {
      bestBySeat.set(item.seatId, item);
    }
  });

  return Array.from(bestBySeat.values()).map((item) => ({
    id: item.clientId,
    clientId: item.clientId,
    name: item.nickname,
    role: getDisplayRole(item.seatId),
    status: STATUS_ORDER.includes(item.status) ? item.status : "active",
    avatar: item.avatar || avatarForName(item.nickname),
    seatId: item.seatId,
    isLocal: item.clientId === appState.clientId,
    isPm: false,
    updatedAt: item.updatedAt || 0
  }));
}

async function publishPresence(patch = {}) {
  appState.localPresence = {
    ...(appState.localPresence || {}),
    ...patch,
    clientId: appState.clientId,
    updatedAt: Date.now()
  };

  if (!appState.subscribed || !appState.channel) return;
  const result = await appState.channel.track(appState.localPresence);
  if (result !== "ok") {
    updateSyncLabel("동기화 지연");
  }
}

function refreshParticipants() {
  if (!appState.channel) return;
  appState.participants = parsePresenceState(appState.channel).sort(sortBySeat);

  const me = getLocalParticipant();
  if (appState.localJoined && me) {
    const nextSeat = pickSeatForLocal(me.seatId);
    if (!nextSeat) {
      appState.channel.untrack();
      appState.localJoined = false;
      alert("빈 자리가 없습니다. 잠시 후 다시 시도해주세요.");
      nicknameModal.classList.add("is-open");
    } else if (nextSeat !== me.seatId) {
      publishPresence({ seatId: nextSeat });
      localStorage.setItem(`${NICKNAME_KEY}:seat:${appState.roomId}`, nextSeat);
    }
  }

  rerender(cycleMyStatus);
}

function tryJoinWithNickname(rawName) {
  const nickname = (rawName || "").trim().slice(0, 12);
  if (!nickname) return false;

  refreshParticipants();
  if (appState.participants.length >= MAX_CONCURRENT_USERS) {
    alert(`현재 동시 접속 최대 ${MAX_CONCURRENT_USERS}명입니다. 잠시 후 재시도해주세요.`);
    return false;
  }

  const preferredSeat = localStorage.getItem(`${NICKNAME_KEY}:seat:${appState.roomId}`) || "";
  const seatId = pickSeatForLocal(preferredSeat);
  if (!seatId) {
    alert(`현재 동시 접속 최대 ${MAX_CONCURRENT_USERS}명입니다. 잠시 후 재시도해주세요.`);
    return false;
  }

  appState.localJoined = true;
  appState.selectedAgentId = appState.clientId;
  localStorage.setItem(NICKNAME_KEY, nickname);
  localStorage.setItem(`${NICKNAME_KEY}:seat:${appState.roomId}`, seatId);

  publishPresence({
    nickname,
    seatId,
    status: "focus",
    avatar: resolveLocalAvatar()
  });

  nicknameModal.classList.remove("is-open");
  updateMessageInputState();
  return true;
}

function cycleMyStatus() {
  const me = getLocalParticipant();
  if (!me) return;
  const current = STATUS_ORDER.indexOf(me.status);
  const next = STATUS_ORDER[(current + 1) % STATUS_ORDER.length];
  publishPresence({ status: next });
}

function initNicknameFlow() {
  nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    tryJoinWithNickname(nicknameInput.value);
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
    rerender(cycleMyStatus);
    nicknameModal.classList.add("is-open");
    nicknameInput.focus();
  }
}

function bindCommonActions() {
  appState.updateMyStatus = cycleMyStatus;

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
      window.prompt("링크를 복사하세요", link);
    }
  });

  shuffleStatusBtn.addEventListener("click", cycleMyStatus);

  Object.entries(meetingRoomEnterButtons).forEach(([roomId, button]) => {
    button.addEventListener("click", () => moveLocalToMeetingRoom(roomId));
  });

  if (messageForm && messageInput) {
    messageForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitMessageFromInput(messageInput);
    });
  }

  if (quickMessageForm && quickMessageInput) {
    quickMessageForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitMessageFromInput(quickMessageInput);
    });
  }
}

function initSupabaseRealtime() {
  appState.clientId = ensureClientId();
  appState.roomId = resolveRoomId();
  roomCode.textContent = `룸 ${appState.roomId.toUpperCase()}`;

  const config = resolveSupabaseConfig();
  if (!config.url || !config.anonKey) {
    updateSyncLabel("Supabase 설정 필요");
    syncInfo.title = "supabase-config.js 또는 ?sbUrl=&sbKey= 로 설정하세요.";
    rerender();
    nicknameModal.classList.add("is-open");
    return;
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  });

  const channel = supabase.channel(`room:${appState.roomId}`, {
    config: {
      presence: { key: appState.clientId },
      broadcast: { self: true, ack: true }
    }
  });
  appState.channel = channel;

  channel
    .on("presence", { event: "sync" }, () => {
      refreshParticipants();
      updateSyncLabel(`연결됨 / 접속 ${appState.participants.length}/${MAX_CONCURRENT_USERS}명 / ${new Date().toLocaleTimeString()}`);
    })
    .on("presence", { event: "join" }, refreshParticipants)
    .on("presence", { event: "leave" }, refreshParticipants)
    .on("broadcast", { event: "message" }, ({ payload }) => {
      const message = normalizeMessagePayload(payload);
      if (message) {
        appendMessage(message);
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        appState.subscribed = true;
        updateSyncLabel("연결됨");
        if (appState.localJoined && appState.localPresence) {
          await publishPresence({});
        }
      } else if (status === "CHANNEL_ERROR") {
        appState.subscribed = false;
        updateSyncLabel("채널 오류");
      } else if (status === "TIMED_OUT") {
        appState.subscribed = false;
        updateSyncLabel("연결 시간초과");
      } else if (status === "CLOSED") {
        appState.subscribed = false;
        updateSyncLabel("연결 종료");
      }
    });

  bindCommonActions();
  initNicknameFlow();
  updateMessageInputState();

  const heartbeat = setInterval(() => {
    if (appState.localJoined) {
      publishPresence({});
    }
  }, HEARTBEAT_MS);

  const bubbleCleaner = setInterval(cleanupBubbles, 1200);

  window.addEventListener("beforeunload", async () => {
    clearInterval(heartbeat);
    clearInterval(bubbleCleaner);
    if (appState.channel) {
      try { await appState.channel.untrack(); } catch (_error) {}
      supabase.removeChannel(appState.channel);
    }
  });
}

initSupabaseRealtime();
