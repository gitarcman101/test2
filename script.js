import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const STATUS_ORDER = ["active", "focus", "idle", "offline"];
const STATUS_LABEL = {
  active: "\ud65c\ub3d9\uc911",
  focus: "\uc9d1\uc911",
  idle: "\ub300\uae30",
  offline: "\uc624\ud504\ub77c\uc778"
};
const MOVE_KEYS = {
  ArrowUp: { x: 0, y: -1, dir: "up" },
  ArrowDown: { x: 0, y: 1, dir: "down" },
  ArrowLeft: { x: -1, y: 0, dir: "left" },
  ArrowRight: { x: 1, y: 0, dir: "right" },
  KeyW: { x: 0, y: -1, dir: "up" },
  KeyS: { x: 0, y: 1, dir: "down" },
  KeyA: { x: -1, y: 0, dir: "left" },
  KeyD: { x: 1, y: 0, dir: "right" }
};

const CLIENT_KEY = "funoffice_client_v1";
const NICKNAME_KEY = "funoffice_nickname_v2";
const AVATAR_KEY = "funoffice_avatar_v1";
const ROOM_PARAM = "room";

const HEARTBEAT_MS = 12000;
const BUBBLE_TTL_MS = 18000;
const PRESENCE_INTERVAL_MS = 140;
const MOVE_BROADCAST_INTERVAL_MS = 100;
const MAX_CONCURRENT_USERS = 14;
const MEETING_ROOM_CAPACITY = 10;
const MAX_RECENT_MESSAGES = 5;
const MAX_MESSAGES = 120;
const MOVE_SPEED = 190;
const MEETING_SCENE_SPEED = 220;

const AVATARS = [
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969749.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969755.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969774.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969777.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969789.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969801.svg",
  "assets/avatars/vecteezy_cute-illustration-designs-for-the-characters-in-the-super_27969802.svg",
  "assets/avatars/vecteezy_illustration-of-characters-in-super-mario-in-vector-cartoon_24804505.svg",
  "assets/avatars/vecteezy_illustration-of-characters-in-super-mario-in-vector-cartoon_24804535.svg",
  "assets/avatars/vecteezy_illustration-of-characters-in-super-mario-in-vector-cartoon_24804574.svg",
  "assets/avatars/vecteezy_star-bonus-game-super-mario-video-game-90s_23079358.svg"
];

const PM_AGENT = {
  id: "pm-fixed",
  clientId: "pm-fixed",
  name: "\ud301\uc2a4\ub9e8",
  role: "PM",
  status: "active",
  avatar: AVATARS[0] || "",
  x: 80,
  y: 120,
  dir: "down",
  isPm: true,
  isLocal: false,
  updatedAt: 0
};

const deskSlots = Array.from(document.querySelectorAll(".desk-slot"));
const fixedPmSeat = document.querySelector("#fixedPmSeat");
const floorGrid = document.querySelector(".floor-grid");
const worldLayer = document.querySelector("#worldLayer");
const officeMap = document.querySelector(".office-map");
const meetingScene = document.querySelector("#meetingScene");
const meetingSceneMap = document.querySelector("#meetingSceneMap");
const meetingSceneTable = document.querySelector(".meeting-scene-table");
const meetingSceneDoor = document.querySelector(".meeting-scene-door");
const meetingSceneLayer = document.querySelector("#meetingSceneLayer");
const meetingBackBtn = document.querySelector("#meetingBackBtn");
const crewGrid = document.querySelector("#crewGrid");
const cardTemplate = document.querySelector("#crewCardTemplate");
const copyLinkBtn = document.querySelector("#copyLinkBtn");
const shuffleStatusBtn = document.querySelector("#shuffleStatusBtn");
const nicknameModal = document.querySelector("#nicknameModal");
const nicknameForm = document.querySelector("#nicknameForm");
const nicknameInput = document.querySelector("#nicknameInput");
const roomCode = document.querySelector("#roomCode");
const syncInfo = document.querySelector("#syncInfo");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const quickMessageForm = document.querySelector("#quickMessageForm");
const quickMessageInput = document.querySelector("#quickMessageInput");
const messageRecent = document.querySelector("#messageRecent");
const messageHistory = document.querySelector("#messageHistory");
const messageHistorySummary = document.querySelector("#messageHistorySummary");
const messageHistoryList = document.querySelector("#messageHistoryList");
const meetingRooms = Array.from(document.querySelectorAll(".meeting-room[data-room-id]"));
const meetingRoomCountNodes = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-room-count]")).map((node) => [node.dataset.roomCount, node])
);
const meetingRoomAvatarNodes = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-room-avatars]")).map((node) => [node.dataset.roomAvatars, node])
);
const meetingRoomEnterButtons = Object.fromEntries(
  Array.from(document.querySelectorAll("[data-room-enter]")).map((node) => [node.dataset.roomEnter, node])
);
const MAX_MESSAGE_LENGTH = Math.max(
  1,
  Number(messageInput?.maxLength || quickMessageInput?.maxLength || 220)
);
const MEETING_SCENE_POSITIONS = [
  { x: 16, y: 28 }, { x: 30, y: 20 }, { x: 50, y: 16 }, { x: 70, y: 20 }, { x: 84, y: 28 },
  { x: 82, y: 58 }, { x: 68, y: 72 }, { x: 50, y: 78 }, { x: 32, y: 72 }, { x: 18, y: 58 }
];
const MEETING_SCENE_DOOR = { x: 2, y: 42, w: 12, h: 22 };

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
  bubbles: new Map(),
  colliders: [],
  spawnPoints: [],
  desks: [],
  roomZones: {},
  sceneMode: "office",
  meetingLocalPos: { x: 52, y: 86 },
  pressedKeys: new Set(),
  lastDirection: "down",
  lastWorldSize: { width: 960, height: 540 },
  moveRaf: 0,
  movePrevTs: 0,
  presenceFlushTimer: 0,
  presenceSending: false,
  lastPresenceSentAt: 0,
  lastMoveBroadcastAt: 0,
  lastFullAlertAt: 0
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
  const globalConfig = window.SUPABASE_CONFIG || {};
  const url = (globalConfig.url || "").trim();
  const anonKey = (globalConfig.anonKey || "").trim();
  return { url, anonKey };
}

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}
function avatarForName(name) {
  return AVATARS.length ? AVATARS[hashText(name) % AVATARS.length] : "";
}
function pickRandomAvatar() {
  return AVATARS.length ? AVATARS[Math.floor(Math.random() * AVATARS.length)] : "";
}
function resolveLocalAvatar() {
  const storageKey = `${AVATAR_KEY}:${appState.roomId}:${appState.clientId}`;
  const stored = localStorage.getItem(storageKey) || "";
  if (stored && AVATARS.includes(stored)) return stored;
  const next = pickRandomAvatar();
  localStorage.setItem(storageKey, next);
  return next;
}
function getLocalParticipant() {
  return appState.participants.find((p) => p.isLocal);
}
function getWorldSize() {
  const width = floorGrid?.clientWidth || 0;
  const height = floorGrid?.clientHeight || 0;
  if (width > 100 && height > 100) {
    appState.lastWorldSize = { width, height };
    return { width, height };
  }
  return appState.lastWorldSize;
}
function toWorldRect(element) {
  if (!element || !floorGrid) return null;
  const rootRect = floorGrid.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return { x: rect.left - rootRect.left, y: rect.top - rootRect.top, w: rect.width, h: rect.height };
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function getAvatarBox(x, y) {
  return { x: x - 18, y: y - 56, w: 36, h: 48 };
}
function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function detectRoomIdAt(x, y) {
  const entries = Object.entries(appState.roomZones);
  for (let i = 0; i < entries.length; i += 1) {
    const [roomId, r] = entries[i];
    if (x >= r.x + 8 && x <= r.x + r.w - 8 && y >= r.y + 8 && y <= r.y + r.h - 8) return roomId;
  }
  return "";
}
function getDisplayRole(x, y) {
  const roomId = detectRoomIdAt(x, y);
  return roomId ? `\ud68c\uc758\uc2e4 ${roomId}` : "\ub370\uc2a4\ud06c";
}
function meetingMemberCount(roomId, exceptClientId = "") {
  return appState.participants.filter((p) => p.clientId !== exceptClientId && detectRoomIdAt(p.x, p.y) === roomId).length;
}
function isRoomEntryAllowed(clientId, fromX, fromY, toX, toY) {
  const fromRoom = detectRoomIdAt(fromX, fromY);
  const toRoom = detectRoomIdAt(toX, toY);
  if (!toRoom || fromRoom === toRoom) return true;
  return meetingMemberCount(toRoom, clientId) < MEETING_ROOM_CAPACITY;
}

function collidesAt(x, y) {
  const bounds = getWorldSize();
  const box = getAvatarBox(x, y);
  if (box.x < 6 || box.y < 6 || box.x + box.w > bounds.width - 6 || box.y + box.h > bounds.height - 6) return true;
  for (let i = 0; i < appState.colliders.length; i += 1) {
    if (intersects(box, appState.colliders[i])) return true;
  }
  return false;
}

function findValidSpotAround(targetX, targetY) {
  const bounds = getWorldSize();
  const maxX = Math.max(20, bounds.width - 20);
  const maxY = Math.max(20, bounds.height - 20);
  const baseX = clamp(targetX, 20, maxX);
  const baseY = clamp(targetY, 20, maxY);
  if (!collidesAt(baseX, baseY)) return { x: baseX, y: baseY };
  const radii = [16, 24, 32, 40, 56, 72, 88, 104];
  for (let ri = 0; ri < radii.length; ri += 1) {
    const r = radii[ri];
    for (let angle = 0; angle < 360; angle += 18) {
      const rad = (angle * Math.PI) / 180;
      const x = clamp(baseX + Math.cos(rad) * r, 20, maxX);
      const y = clamp(baseY + Math.sin(rad) * r, 20, maxY);
      if (!collidesAt(x, y)) return { x, y };
    }
  }
  return { x: baseX, y: baseY };
}

function prepareStaticDesks() {
  [fixedPmSeat, ...deskSlots].filter(Boolean).forEach((slot) => {
    slot.textContent = "";
    const desk = document.createElement("div");
    desk.className = "desk static-desk";
    slot.appendChild(desk);
  });
}

function recalculateGeometry() {
  appState.colliders = [];
  appState.spawnPoints = [];
  appState.desks = [];
  appState.roomZones = {};

  const deskNodes = Array.from(document.querySelectorAll(".static-desk"));
  deskNodes.forEach((deskNode, index) => {
    const rect = toWorldRect(deskNode);
    if (!rect) return;
    appState.colliders.push({ x: rect.x - 2, y: rect.y - 2, w: rect.w + 4, h: rect.h + 6 });
    const spawn = { x: rect.x + rect.w / 2, y: rect.y + rect.h + 56 };
    appState.spawnPoints.push(spawn);
    appState.desks.push({
      node: deskNode,
      seatX: spawn.x,
      seatY: spawn.y
    });
    if (index === 0) {
      PM_AGENT.x = spawn.x;
      PM_AGENT.y = spawn.y;
    }
  });

  Array.from(document.querySelectorAll(".plant")).forEach((plantNode) => {
    const rect = toWorldRect(plantNode);
    if (!rect) return;
    appState.colliders.push({ x: rect.x - 2, y: rect.y - 2, w: rect.w + 4, h: rect.h + 4 });
  });

  meetingRooms.forEach((roomNode) => {
    const roomId = roomNode.dataset.roomId;
    const rect = toWorldRect(roomNode);
    if (!roomId || !rect) return;
    appState.roomZones[roomId] = rect;
    const wall = 8;
    appState.colliders.push(
      { x: rect.x, y: rect.y, w: rect.w, h: wall },
      { x: rect.x, y: rect.y + rect.h - wall, w: rect.w, h: wall },
      { x: rect.x + rect.w - wall, y: rect.y, w: wall, h: rect.h }
    );
    appState.spawnPoints.push({ x: rect.x + rect.w * 0.56, y: rect.y + rect.h * 0.66 });
  });

  appState.participants = appState.participants.map((p) => {
    const valid = findValidSpotAround(p.x, p.y);
    return { ...p, x: valid.x, y: valid.y, role: getDisplayRole(valid.x, valid.y) };
  });
}

function updateDeskMonitorFires() {
  if (!appState.desks.length) return;
  appState.desks.forEach((desk) => desk.node.classList.remove("is-hot"));
  const agents = [PM_AGENT, ...appState.participants];
  appState.desks.forEach((desk) => {
    const hot = agents.some((agent) => {
      const isWorking = agent.status === "active" || agent.status === "focus";
      if (!isWorking) return false;
      const dx = Math.abs(agent.x - desk.seatX);
      const dy = Math.abs(agent.y - desk.seatY);
      return dx <= 42 && dy <= 34;
    });
    if (hot) desk.node.classList.add("is-hot");
  });
}

function getBubbleLengthClass(text) {
  const len = String(text || "").trim().length;
  if (len >= 52) return "is-xlong";
  if (len >= 26) return "is-long";
  return "";
}

function isLocalInRoom(roomId) {
  const me = getLocalParticipant();
  if (!me) return false;
  return detectRoomIdAt(me.x, me.y) === roomId;
}

function isParticipantInMeetingA(agent) {
  if (!agent) return false;
  if (agent.isLocal && appState.sceneMode === "meetingA") return true;
  if (detectRoomIdAt(agent.x, agent.y) === "A") return true;
  return agent.role === "회의실 A";
}

function getOfficeExitPointFromMeetingA() {
  const zone = appState.roomZones["A"];
  if (!zone) return { x: 120, y: 220 };

  const bounds = getWorldSize();
  const maxX = Math.max(20, bounds.width - 20);
  const maxY = Math.max(20, bounds.height - 20);
  const exitY = clamp(zone.y + zone.h * 0.56, 20, maxY);
  const leftOffsets = [46, 58, 72, 88, 104];

  for (let i = 0; i < leftOffsets.length; i += 1) {
    const targetX = clamp(zone.x - leftOffsets[i], 20, maxX);
    const point = findValidSpotAround(targetX, exitY);
    if (detectRoomIdAt(point.x, point.y) !== "A") {
      return point;
    }
  }

  const fallback = {
    x: clamp(zone.x - 120, 20, maxX),
    y: exitY
  };
  if (!collidesAt(fallback.x, fallback.y) && detectRoomIdAt(fallback.x, fallback.y) !== "A") return fallback;
  return findValidSpotAround(fallback.x, fallback.y);
}

function isInsideMeetingDoor(pos) {
  return (
    pos.x >= MEETING_SCENE_DOOR.x &&
    pos.x <= MEETING_SCENE_DOOR.x + MEETING_SCENE_DOOR.w &&
    pos.y >= MEETING_SCENE_DOOR.y &&
    pos.y <= MEETING_SCENE_DOOR.y + MEETING_SCENE_DOOR.h
  );
}

function clampMeetingPos(pos) {
  return {
    x: clamp(pos.x, 6, 94),
    y: clamp(pos.y, 16, 90)
  };
}

function getMeetingSceneGeometry() {
  if (!meetingSceneMap || !meetingSceneTable || !meetingSceneDoor) return null;
  const mapRect = meetingSceneMap.getBoundingClientRect();
  if (!mapRect.width || !mapRect.height) return null;

  const tableRectRaw = meetingSceneTable.getBoundingClientRect();
  const doorRectRaw = meetingSceneDoor.getBoundingClientRect();

  const tableCenter = {
    x: ((tableRectRaw.left + tableRectRaw.width / 2 - mapRect.left) / mapRect.width) * 100,
    y: ((tableRectRaw.top + tableRectRaw.height / 2 - mapRect.top) / mapRect.height) * 100
  };
  const tableRadius = {
    x: (tableRectRaw.width / mapRect.width) * 50,
    y: (tableRectRaw.height / mapRect.height) * 50
  };
  const doorRect = {
    x: ((doorRectRaw.left - mapRect.left) / mapRect.width) * 100,
    y: ((doorRectRaw.top - mapRect.top) / mapRect.height) * 100,
    w: (doorRectRaw.width / mapRect.width) * 100,
    h: (doorRectRaw.height / mapRect.height) * 100
  };

  return { tableCenter, tableRadius, doorRect };
}

function renderMeetingScene() {
  if (!meetingSceneLayer) return;
  const localPos = clampMeetingPos(appState.meetingLocalPos || { x: 52, y: 86 });
  appState.meetingLocalPos = localPos;
  const members = appState.participants
    .filter((agent) => isParticipantInMeetingA(agent))
    .slice(0, MEETING_ROOM_CAPACITY)
    .sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return 0;
    });

  meetingSceneLayer.textContent = "";
  if (!members.length) {
    const empty = document.createElement("p");
    empty.className = "meeting-scene-empty";
    empty.textContent = "회의실 A에 참가자가 없습니다.";
    meetingSceneLayer.appendChild(empty);
    return;
  }

  let seatIndex = 0;
  members.forEach((agent) => {
    const pos = agent.isLocal
      ? localPos
      : MEETING_SCENE_POSITIONS[(seatIndex++) % MEETING_SCENE_POSITIONS.length];
    const node = document.createElement("article");
    node.className = `meeting-scene-agent status-${agent.status}`;
    if (appState.selectedAgentId === agent.id) node.classList.add("is-selected");
    if (agent.isLocal) node.classList.add("is-local");
    node.style.left = `${pos.x}%`;
    node.style.top = `${pos.y}%`;

    const bubbleText = getBubbleText(agent.clientId);
    if (bubbleText) {
      const bubble = document.createElement("div");
      bubble.className = "speech-bubble";
      const bubbleClass = getBubbleLengthClass(bubbleText);
      if (bubbleClass) bubble.classList.add(bubbleClass);
      bubble.textContent = bubbleText;
      node.appendChild(bubble);
    }

    const image = document.createElement("img");
    image.className = "avatar-img meeting-scene-avatar";
    image.src = agent.avatar;
    image.alt = `${agent.name} avatar`;
    node.appendChild(image);

    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.className = "name-tag meeting-scene-name";
    nameBtn.textContent = agent.name;
    nameBtn.addEventListener("click", () => {
      appState.selectedAgentId = agent.id;
      rerender(cycleMyStatus);
    });
    node.appendChild(nameBtn);

    meetingSceneLayer.appendChild(node);
  });
}
function updateSceneMode() {
  const me = getLocalParticipant();
  const isInMeetingA = Boolean(me && detectRoomIdAt(me.x, me.y) === "A");
  if (isInMeetingA) {
    appState.sceneMode = "meetingA";
  } else if (appState.sceneMode === "meetingA") {
    appState.sceneMode = "office";
  }

  const showMeetingScene = appState.sceneMode === "meetingA";
  if (officeMap) officeMap.hidden = showMeetingScene;
  if (meetingScene) meetingScene.hidden = !showMeetingScene;

  if (showMeetingScene) {
    renderMeetingScene();
  } else if (meetingSceneLayer) {
    meetingSceneLayer.textContent = "";
  }
}

function moveLocalOutFromMeetingA() {
  const me = getLocalParticipant();
  if (!me) return;
  appState.sceneMode = "office";
  if (officeMap) officeMap.hidden = false;
  if (meetingScene) meetingScene.hidden = true;
  recalculateGeometry();
  const target = getOfficeExitPointFromMeetingA();
  // Re-fetch local participant since recalculateGeometry creates new objects via .map()
  const meNow = getLocalParticipant();
  if (!meNow) return;
  meNow.x = target.x;
  meNow.y = target.y;
  meNow.updatedAt = Date.now();
  meNow.role = getDisplayRole(meNow.x, meNow.y);
  appState.meetingLocalPos = { x: 52, y: 86 };
  appState.pressedKeys.clear();
  queuePresencePatch({ x: meNow.x, y: meNow.y, role: meNow.role }, true);
  broadcastMove(meNow.x, meNow.y, meNow.dir || "down");
  rerender(cycleMyStatus);
}

function moveLocalInMeetingScene(dx, dy, dir) {
  const me = getLocalParticipant();
  if (!me || !meetingSceneMap) return;

  const w = meetingSceneMap.clientWidth || 1;
  const h = meetingSceneMap.clientHeight || 1;
  const cur = appState.meetingLocalPos || { x: 52, y: 86 };
  let next = {
    x: cur.x + (dx / w) * 100,
    y: cur.y + (dy / h) * 100
  };
  next = clampMeetingPos(next);
  const geo = getMeetingSceneGeometry();
  const doorRect = geo ? geo.doorRect : MEETING_SCENE_DOOR;
  const inDoor =
    next.x >= doorRect.x &&
    next.x <= doorRect.x + doorRect.w &&
    next.y >= doorRect.y &&
    next.y <= doorRect.y + doorRect.h;
  if (inDoor || isInsideMeetingDoor(next)) {
    moveLocalOutFromMeetingA();
    return;
  }

  if (geo) {
    const nx = (next.x - geo.tableCenter.x) / Math.max(1, geo.tableRadius.x * 0.92);
    const ny = (next.y - geo.tableCenter.y) / Math.max(1, geo.tableRadius.y * 0.9);
    const insideTable = nx * nx + ny * ny < 1;
    if (insideTable) return;
  }

  appState.meetingLocalPos = next;
  me.dir = dir;
  me.updatedAt = Date.now();
  me.role = "회의실 A";
  renderMeetingScene();
}
function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function pickSpawnPoint() {
  const candidates = appState.spawnPoints.length
    ? appState.spawnPoints
    : [{ x: 140, y: 220 }, { x: 260, y: 240 }, { x: 380, y: 260 }];
  const used = appState.participants.map((p) => ({ x: p.x, y: p.y }));
  const scored = candidates
    .map((c) => ({
      candidate: c,
      score: used.reduce((min, p) => Math.min(min, distanceSq(c, p)), Infinity)
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.candidate || candidates[0];
  return findValidSpotAround(best.x, best.y);
}

function updateSyncLabel(text) {
  if (syncInfo) syncInfo.textContent = text;
}

function updateMessageInputState() {
  const enabled = appState.localJoined;
  if (messageForm && messageInput) {
    const submitBtn = messageForm.querySelector("button");
    messageInput.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
  }
  if (quickMessageForm && quickMessageInput) {
    const submitBtn = quickMessageForm.querySelector("button");
    quickMessageInput.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
  }
}

function getBubbleText(clientId) {
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
  appState.bubbles.set(clientId, { text: String(text).slice(0, MAX_MESSAGE_LENGTH), until: Date.now() + BUBBLE_TTL_MS });
}

function cleanupBubbles() {
  const now = Date.now();
  let changed = false;
  appState.bubbles.forEach((v, k) => {
    if (v.until < now) {
      appState.bubbles.delete(k);
      changed = true;
    }
  });
  if (changed) rerender(cycleMyStatus);
}


const worldNodeCache = new Map();

function updateWorldAgentNode(node, agent) {
  const newClass = `world-agent status-${agent.status} dir-${agent.dir || "down"}${appState.selectedAgentId === agent.id ? " is-selected" : ""}${detectRoomIdAt(agent.x, agent.y) ? " is-in-room" : ""}`;
  if (node.className !== newClass) node.className = newClass;
  node.style.transform = `translate(${agent.x}px, ${agent.y}px) translate(-50%, -100%)`;

  const roomId = detectRoomIdAt(agent.x, agent.y);
  const bubbleText = getBubbleText(agent.clientId);
  let bubbleEl = node.querySelector(".speech-bubble");
  if (bubbleText) {
    if (!bubbleEl) {
      bubbleEl = document.createElement("div");
      bubbleEl.className = "speech-bubble";
      node.insertBefore(bubbleEl, node.firstChild);
    }
    let bubbleClass = "speech-bubble";
    if (roomId) bubbleClass += " room-left";
    const lenClass = getBubbleLengthClass(bubbleText);
    if (lenClass) bubbleClass += ` ${lenClass}`;
    if (bubbleEl.className !== bubbleClass) bubbleEl.className = bubbleClass;
    if (bubbleEl.textContent !== bubbleText) bubbleEl.textContent = bubbleText;
  } else if (bubbleEl) {
    bubbleEl.remove();
  }

  const nameBtn = node.querySelector(".world-name-tag");
  if (nameBtn && nameBtn.textContent !== agent.name) nameBtn.textContent = agent.name;

  const img = node.querySelector(".world-avatar-img");
  if (img && img.src !== agent.avatar) img.src = agent.avatar;
}

function createWorldAgentNodeCached(agent) {
  const node = document.createElement("article");
  node.style.position = "absolute";
  node.style.left = "0";
  node.style.top = "0";
  node.style.willChange = "transform";

  const image = document.createElement("img");
  image.className = "avatar-img world-avatar-img";
  image.src = agent.avatar;
  image.alt = `${agent.name} avatar`;
  node.appendChild(image);

  const nameBtn = document.createElement("button");
  nameBtn.type = "button";
  nameBtn.className = "name-tag world-name-tag";
  nameBtn.textContent = agent.name;
  nameBtn.addEventListener("click", () => {
    appState.selectedAgentId = agent.id;
    rerender(cycleMyStatus);
  });
  node.appendChild(nameBtn);

  updateWorldAgentNode(node, agent);
  return node;
}

function renderWorld() {
  if (!worldLayer) return;
  const agents = [PM_AGENT, ...appState.participants.slice().sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))];
  const activeIds = new Set();

  agents.forEach((agent) => {
    const key = agent.clientId || agent.id;
    activeIds.add(key);
    let node = worldNodeCache.get(key);
    if (!node) {
      node = createWorldAgentNodeCached(agent);
      worldNodeCache.set(key, node);
      worldLayer.appendChild(node);
    } else {
      updateWorldAgentNode(node, agent);
      if (!node.parentNode) worldLayer.appendChild(node);
    }
  });

  worldNodeCache.forEach((node, key) => {
    if (!activeIds.has(key)) {
      node.remove();
      worldNodeCache.delete(key);
    }
  });
}

function renderMeetingRooms() {
  Object.entries(meetingRoomCountNodes).forEach(([roomId, node]) => {
    const members = appState.participants.filter((p) => detectRoomIdAt(p.x, p.y) === roomId);
    node.textContent = `${members.length}/${MEETING_ROOM_CAPACITY}`;
    const avatarsNode = meetingRoomAvatarNodes[roomId];
    if (!avatarsNode) return;
    avatarsNode.textContent = "";
    if (members.length === 0) {
      const empty = document.createElement("p");
      empty.className = "meeting-empty";
      empty.textContent = "\ucc38\uc5ec\uc790 \uc5c6\uc74c";
      avatarsNode.appendChild(empty);
      return;
    }
    members.forEach((agent) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `meeting-agent status-${agent.status}`;
      if (appState.selectedAgentId === agent.id) chip.classList.add("is-selected");
      const img = document.createElement("img");
      img.className = "meeting-agent-avatar";
      img.src = agent.avatar;
      img.alt = "";
      const name = document.createElement("span");
      name.className = "meeting-agent-name";
      name.textContent = agent.name;
      chip.appendChild(img);
      chip.appendChild(name);
      chip.addEventListener("click", () => {
        appState.selectedAgentId = agent.id;
        rerender(cycleMyStatus);
      });
      avatarsNode.appendChild(chip);
    });
  });
  Object.entries(meetingRoomEnterButtons).forEach(([roomId, button]) => {
    button.disabled = !appState.localJoined;
    button.textContent = `\ud68c\uc758\uc2e4 ${roomId} \uc774\ub3d9`;
  });
}

function renderCrew(agents, updateMyStatus) {
  if (!crewGrid || !cardTemplate) return;
  crewGrid.textContent = "";
  agents.forEach((agent) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const selectBtn = card.querySelector(".crew-select");
    const image = card.querySelector(".crew-avatar-img");
    const role = card.querySelector(".crew-role");
    const name = card.querySelector(".crew-name");
    const statusBtn = card.querySelector(".status-pill");
    if (appState.selectedAgentId === agent.id) card.classList.add("is-selected");
    image.src = agent.avatar;
    image.alt = `${agent.name} avatar`;
    role.textContent = agent.role;
    name.textContent = agent.name;
    statusBtn.classList.add(`status-${agent.status}`);
    statusBtn.textContent = STATUS_LABEL[agent.status] || agent.status;
    if (!agent.isLocal || agent.isPm) {
      statusBtn.disabled = true;
    } else {
      statusBtn.addEventListener("click", () => updateMyStatus());
    }
    selectBtn.addEventListener("click", () => {
      appState.selectedAgentId = agent.id;
      rerender(cycleMyStatus);
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

let lastRenderedMessageCount = -1;

function renderMessages() {
  if (!messageRecent || !messageHistory || !messageHistorySummary || !messageHistoryList) return;
  if (appState.messages.length === lastRenderedMessageCount) return;
  lastRenderedMessageCount = appState.messages.length;

  const recent = appState.messages.slice(-MAX_RECENT_MESSAGES);
  const older = appState.messages.slice(0, -MAX_RECENT_MESSAGES);
  messageRecent.textContent = "";
  recent.forEach((m) => messageRecent.appendChild(createMessageItem(m)));
  messageHistoryList.textContent = "";
  older.forEach((m) => messageHistoryList.appendChild(createMessageItem(m)));
  if (!older.length) {
    messageHistory.open = false;
    messageHistory.hidden = true;
  } else {
    messageHistory.hidden = false;
    messageHistorySummary.textContent = `\uc774\uc804 \uba54\uc2dc\uc9c0 ${older.length}\uac1c`;
  }
}

function rerender(updateMyStatus = appState.updateMyStatus) {
  appState.participants = appState.participants.map((p) => ({ ...p, role: getDisplayRole(p.x, p.y) }));
  updateDeskMonitorFires();
  renderWorld();
  renderMeetingRooms();
  updateSceneMode();
  renderCrew([PM_AGENT, ...appState.participants], updateMyStatus);
  renderMessages();
  updateMessageInputState();
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

function normalizeMovePayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const clientId = String(payload.clientId || "").trim();
  const x = Number(payload.x);
  const y = Number(payload.y);
  const dir = String(payload.dir || "down");
  const updatedAt = Number(payload.updatedAt || Date.now());
  if (!clientId || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { clientId, x, y, dir, updatedAt };
}

function resolveSpeakerClientId(message) {
  if (message.clientId) return message.clientId;
  const matched = appState.participants.filter((p) => p.name === message.nickname);
  if (matched.length === 1) return matched[0].clientId;
  const me = getLocalParticipant();
  return me && me.name === message.nickname ? me.clientId : "";
}

function appendMessage(message) {
  if (!message || !message.id || appState.seenMessageIds.has(message.id)) return;
  appState.seenMessageIds.add(message.id);
  appState.messages.push(message);
  if (appState.messages.length > MAX_MESSAGES) {
    const removed = appState.messages.splice(0, appState.messages.length - MAX_MESSAGES);
    removed.forEach((m) => appState.seenMessageIds.delete(m.id));
  }
  const cid = resolveSpeakerClientId(message);
  if (cid) setBubble(cid, message.text);
  rerender(cycleMyStatus);
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
  const result = await appState.channel.send({ type: "broadcast", event: "message", payload });
  if (result !== "ok") alert("Message send failed. Try again.");
}

function parsePresenceState(channel) {
  const state = channel.presenceState();
  const latestByClient = new Map();
  Object.values(state).forEach((items) => {
    const list = Array.isArray(items) ? items : [];
    list.forEach((item) => {
      if (!item || !item.clientId || !item.nickname) return;
      const x = Number(item.x);
      const y = Number(item.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const prev = latestByClient.get(item.clientId);
      if (!prev || (item.updatedAt || 0) >= (prev.updatedAt || 0)) latestByClient.set(item.clientId, item);
    });
  });
  return Array.from(latestByClient.values()).map((item) => {
    const point = findValidSpotAround(Number(item.x), Number(item.y));
    return {
      id: item.clientId,
      clientId: item.clientId,
      name: item.nickname,
      role: getDisplayRole(point.x, point.y),
      status: STATUS_ORDER.includes(item.status) ? item.status : "active",
      avatar: item.avatar || avatarForName(item.nickname),
      x: point.x,
      y: point.y,
      dir: String(item.dir || "down"),
      isLocal: item.clientId === appState.clientId,
      isPm: false,
      updatedAt: item.updatedAt || 0
    };
  });
}

function refreshParticipants() {
  if (!appState.channel) return;
  const prevLocal = getLocalParticipant();
  const parsed = parsePresenceState(appState.channel);
  const byClient = new Map(parsed.map((p) => [p.clientId, p]));
  appState.participants.forEach((oldP) => {
    const nowP = byClient.get(oldP.clientId);
    if (nowP && (oldP.updatedAt || 0) > (nowP.updatedAt || 0)) byClient.set(oldP.clientId, oldP);
  });

  if (appState.localJoined && !byClient.has(appState.clientId)) {
    if (prevLocal) {
      byClient.set(appState.clientId, { ...prevLocal, isLocal: true, isPm: false });
    } else if (appState.localPresence) {
      const px = Number(appState.localPresence.x || 120);
      const py = Number(appState.localPresence.y || 200);
      const point = findValidSpotAround(px, py);
      byClient.set(appState.clientId, {
        id: appState.clientId,
        clientId: appState.clientId,
        name: String(appState.localPresence.nickname || "").trim() || "게스트",
        role: getDisplayRole(point.x, point.y),
        status: STATUS_ORDER.includes(appState.localPresence.status) ? appState.localPresence.status : "focus",
        avatar: appState.localPresence.avatar || resolveLocalAvatar(),
        x: point.x,
        y: point.y,
        dir: String(appState.localPresence.dir || "down"),
        isLocal: true,
        isPm: false,
        updatedAt: Date.now()
      });
    }
  }

  appState.participants = Array.from(byClient.values()).sort((a, b) => {
    if (a.isLocal) return -1;
    if (b.isLocal) return 1;
    return (a.updatedAt || 0) - (b.updatedAt || 0);
  });
  updateSyncLabel(`\uc5f0\uacb0\ub428 / \uc811\uc18d ${appState.participants.length}/${MAX_CONCURRENT_USERS}\uba85 / ${new Date().toLocaleTimeString()}`);
  rerender(cycleMyStatus);
}

function queuePresencePatch(patch = {}, force = false) {
  if (!appState.localPresence) return;
  appState.localPresence = { ...appState.localPresence, ...patch, clientId: appState.clientId, updatedAt: Date.now() };
  const elapsed = Date.now() - appState.lastPresenceSentAt;
  if (force || elapsed >= PRESENCE_INTERVAL_MS) {
    void flushPresence();
    return;
  }
  if (!appState.presenceFlushTimer) {
    appState.presenceFlushTimer = window.setTimeout(() => {
      appState.presenceFlushTimer = 0;
      void flushPresence();
    }, Math.max(16, PRESENCE_INTERVAL_MS - elapsed));
  }
}

async function flushPresence() {
  if (!appState.localJoined || !appState.channel || !appState.subscribed || !appState.localPresence) return;
  if (appState.presenceSending) return;
  appState.presenceSending = true;
  try {
    const result = await appState.channel.track(appState.localPresence);
    appState.lastPresenceSentAt = Date.now();
    if (result !== "ok") updateSyncLabel("sync delayed");
  } finally {
    appState.presenceSending = false;
  }
}

function upsertParticipantFromMove(payload) {
  const move = normalizeMovePayload(payload);
  if (!move) return;
  const participant = appState.participants.find((p) => p.clientId === move.clientId);
  if (!participant || participant.isLocal || (participant.updatedAt || 0) > move.updatedAt) return;
  const point = findValidSpotAround(move.x, move.y);
  participant.x = point.x;
  participant.y = point.y;
  participant.dir = move.dir || participant.dir || "down";
  participant.updatedAt = move.updatedAt;
  participant.role = getDisplayRole(point.x, point.y);
  rerender(cycleMyStatus);
}

function broadcastMove(x, y, dir) {
  if (!appState.localJoined || !appState.channel || !appState.subscribed) return;
  const now = Date.now();
  if (now - appState.lastMoveBroadcastAt < MOVE_BROADCAST_INTERVAL_MS) return;
  appState.lastMoveBroadcastAt = now;
  void appState.channel.send({
    type: "broadcast",
    event: "move",
    payload: { clientId: appState.clientId, x, y, dir, updatedAt: now }
  });
}

function tryJoinWithNickname(rawName) {
  const nickname = (rawName || "").trim().slice(0, 12);
  if (!nickname) return false;
  refreshParticipants();
  if (appState.participants.length >= MAX_CONCURRENT_USERS) {
    alert(`\ub3d9\uc2dc \uc811\uc18d \ucd5c\ub300 ${MAX_CONCURRENT_USERS}\uba85\uc785\ub2c8\ub2e4.`);
    return false;
  }
  const point = pickSpawnPoint();
  appState.localJoined = true;
  appState.selectedAgentId = appState.clientId;
  appState.lastDirection = "down";
  appState.sceneMode = "office";
  appState.meetingLocalPos = { x: 52, y: 86 };
  localStorage.setItem(NICKNAME_KEY, nickname);
  appState.localPresence = {
    clientId: appState.clientId,
    nickname,
    status: "focus",
    avatar: resolveLocalAvatar(),
    x: point.x,
    y: point.y,
    dir: "down",
    updatedAt: Date.now()
  };
  appState.participants = appState.participants.filter((p) => !p.isLocal);
  appState.participants.push({
    id: appState.clientId,
    clientId: appState.clientId,
    name: nickname,
    role: getDisplayRole(point.x, point.y),
    status: "focus",
    avatar: appState.localPresence.avatar,
    x: point.x,
    y: point.y,
    dir: "down",
    isLocal: true,
    isPm: false,
    updatedAt: appState.localPresence.updatedAt
  });
  nicknameModal.classList.remove("is-open");
  updateMessageInputState();
  queuePresencePatch({}, true);
  startMoveLoop();
  showJoystick();
  rerender(cycleMyStatus);
  return true;
}

function cycleMyStatus() {
  const me = getLocalParticipant();
  if (!me) return;
  const next = STATUS_ORDER[(STATUS_ORDER.indexOf(me.status) + 1) % STATUS_ORDER.length];
  me.status = next;
  me.updatedAt = Date.now();
  queuePresencePatch({ status: next }, true);
  rerender(cycleMyStatus);
}

function submitMessageFromInput(inputEl) {
  if (!inputEl) return;
  const text = inputEl.value;
  inputEl.value = "";
  void sendMessage(text);
}

function getMoveIntent() {
  let x = 0;
  let y = 0;
  let dir = appState.lastDirection;
  appState.pressedKeys.forEach((code) => {
    const key = MOVE_KEYS[code];
    if (!key) return;
    x += key.x;
    y += key.y;
    dir = key.dir;
  });
  // Merge joystick input
  const joy = getJoystickIntent();
  if (joy.moving) {
    x += joy.x;
    y += joy.y;
    dir = joy.dir;
  }
  if (x === 0 && y === 0) return { moving: false, x: 0, y: 0, dir };
  const mag = Math.hypot(x, y) || 1;
  return { moving: true, x: x / mag, y: y / mag, dir };
}

function moveLocalBy(dx, dy, dir) {
  const me = getLocalParticipant();
  if (!me) return;
  if (appState.sceneMode === "meetingA") return;
  let nextX = me.x;
  let nextY = me.y;
  if (dx !== 0) {
    const trialX = me.x + dx;
    if (!collidesAt(trialX, me.y)) nextX = trialX;
  }
  if (dy !== 0) {
    const trialY = me.y + dy;
    if (!collidesAt(nextX, trialY)) nextY = trialY;
  }
  if (!isRoomEntryAllowed(me.clientId, me.x, me.y, nextX, nextY)) {
    if (Date.now() - appState.lastFullAlertAt > 1200) {
      appState.lastFullAlertAt = Date.now();
      alert("\ud68c\uc758\uc2e4 \uc815\uc6d0\uc774 \uac00\ub4dd \ucc3c\uc2b5\ub2c8\ub2e4.");
    }
    return;
  }
  const moved = Math.abs(nextX - me.x) > 0.2 || Math.abs(nextY - me.y) > 0.2;
  const turned = dir !== me.dir;
  if (!moved && !turned) return;
  me.x = nextX;
  me.y = nextY;
  me.dir = dir;
  me.updatedAt = Date.now();
  me.role = getDisplayRole(nextX, nextY);
  appState.lastDirection = dir;
  if (detectRoomIdAt(me.x, me.y) === "A") {
    appState.sceneMode = "meetingA";
    appState.meetingLocalPos = { x: 52, y: 86 };
    me.role = "회의실 A";
  }
  queuePresencePatch({ x: me.x, y: me.y, dir: me.dir, role: me.role });
  if (moved) broadcastMove(me.x, me.y, me.dir);
  rerender(cycleMyStatus);
}

function moveToMeetingRoom(roomId) {
  const me = getLocalParticipant();
  const zone = appState.roomZones[roomId];
  if (!me || !zone) return;
  const count = meetingMemberCount(roomId, me.clientId);
  const alreadyIn = detectRoomIdAt(me.x, me.y) === roomId;
  if (!alreadyIn && count >= MEETING_ROOM_CAPACITY) {
    alert("\ud68c\uc758\uc2e4 \uc815\uc6d0\uc774 \uac00\ub4dd \ucc3c\uc2b5\ub2c8\ub2e4.");
    return;
  }
  const target = findValidSpotAround(zone.x + zone.w * 0.56, zone.y + zone.h * 0.68);
  me.x = target.x;
  me.y = target.y;
  me.updatedAt = Date.now();
  me.role = getDisplayRole(me.x, me.y);
  if (roomId === "A") {
    appState.sceneMode = "meetingA";
    appState.meetingLocalPos = { x: 52, y: 86 };
    me.role = "회의실 A";
  }
  queuePresencePatch({ x: me.x, y: me.y, role: me.role }, true);
  broadcastMove(me.x, me.y, me.dir || "down");
  rerender(cycleMyStatus);
}

function isTypingElement(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function startMoveLoop() {
  if (appState.moveRaf) return;
  appState.movePrevTs = 0;
  const tick = (ts) => {
    if (!appState.localJoined) {
      appState.moveRaf = 0;
      return;
    }
    const dt = appState.movePrevTs ? Math.min(0.05, (ts - appState.movePrevTs) / 1000) : 0;
    appState.movePrevTs = ts;
    const intent = getMoveIntent();
    if (intent.moving && dt > 0) {
      if (appState.sceneMode === "meetingA") {
        moveLocalInMeetingScene(intent.x * MEETING_SCENE_SPEED * dt, intent.y * MEETING_SCENE_SPEED * dt, intent.dir);
      } else {
        moveLocalBy(intent.x * MOVE_SPEED * dt, intent.y * MOVE_SPEED * dt, intent.dir);
      }
    }
    appState.moveRaf = requestAnimationFrame(tick);
  };
  appState.moveRaf = requestAnimationFrame(tick);
}

// --- Touch Joystick ---
const touchJoystick = document.querySelector("#touchJoystick");
const joystickBase = document.querySelector("#joystickBase");
const joystickKnob = document.querySelector("#joystickKnob");
const joystickState = { active: false, dx: 0, dy: 0, touchId: null };

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function showJoystick() {
  if (touchJoystick && isTouchDevice()) touchJoystick.hidden = false;
}

function initJoystick() {
  if (!joystickBase || !joystickKnob) return;
  const BASE_RADIUS = 50;
  const KNOB_RADIUS = 20;
  const MAX_OFFSET = BASE_RADIUS - KNOB_RADIUS;

  function updateKnob(clientX, clientY) {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > MAX_OFFSET) {
      dx = (dx / dist) * MAX_OFFSET;
      dy = (dy / dist) * MAX_OFFSET;
    }
    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const norm = Math.min(dist, MAX_OFFSET) / MAX_OFFSET;
    joystickState.dx = (dx / dist) * norm;
    joystickState.dy = (dy / dist) * norm;
  }

  joystickBase.addEventListener("touchstart", (e) => {
    if (joystickState.active) return;
    const t = e.changedTouches[0];
    joystickState.active = true;
    joystickState.touchId = t.identifier;
    updateKnob(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener("touchmove", (e) => {
    if (!joystickState.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickState.touchId) {
        updateKnob(t.clientX, t.clientY);
        e.preventDefault();
        return;
      }
    }
  }, { passive: false });

  function resetJoystick() {
    joystickState.active = false;
    joystickState.dx = 0;
    joystickState.dy = 0;
    joystickState.touchId = null;
    joystickKnob.style.transform = "translate(0px, 0px)";
  }

  window.addEventListener("touchend", (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickState.touchId) {
        resetJoystick();
        return;
      }
    }
  });
  window.addEventListener("touchcancel", resetJoystick);
}

function getJoystickIntent() {
  if (!joystickState.active) return { moving: false, x: 0, y: 0, dir: appState.lastDirection };
  const DEADZONE = 0.15;
  const dx = joystickState.dx;
  const dy = joystickState.dy;
  const mag = Math.hypot(dx, dy);
  if (mag < DEADZONE) return { moving: false, x: 0, y: 0, dir: appState.lastDirection };
  let dir;
  if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
  else dir = dy > 0 ? "down" : "up";
  return { moving: true, x: dx, y: dy, dir };
}

function bindKeyboardMovement() {
  window.addEventListener("keydown", (event) => {
    if (!MOVE_KEYS[event.code] || isTypingElement(event.target)) return;
    appState.pressedKeys.add(event.code);
    event.preventDefault();
  });
  window.addEventListener("keyup", (event) => {
    if (!MOVE_KEYS[event.code]) return;
    appState.pressedKeys.delete(event.code);
    event.preventDefault();
  });
  window.addEventListener("blur", () => appState.pressedKeys.clear());
}

function initNicknameFlow() {
  nicknameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    tryJoinWithNickname(nicknameInput.value);
  });
  const savedNickname = localStorage.getItem(NICKNAME_KEY);
  if (savedNickname) {
    nicknameInput.value = savedNickname;
    if (tryJoinWithNickname(savedNickname)) return;
  }
  rerender(cycleMyStatus);
  nicknameModal.classList.add("is-open");
  nicknameInput.focus();
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
      copyLinkBtn.textContent = "\ubcf5\uc0ac\ub428";
      setTimeout(() => { copyLinkBtn.textContent = original; }, 900);
    } catch (_error) {
      window.prompt("\ub9c1\ud06c \ubcf5\uc0ac", link);
    }
  });
  shuffleStatusBtn.addEventListener("click", cycleMyStatus);
  if (meetingBackBtn) {
    meetingBackBtn.addEventListener("click", moveLocalOutFromMeetingA);
  }
  Object.entries(meetingRoomEnterButtons).forEach(([roomId, button]) => {
    button.addEventListener("click", () => moveToMeetingRoom(roomId));
  });
  if (messageForm && messageInput) {
    messageForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitMessageFromInput(messageInput);
    });
  }
  if (quickMessageForm && quickMessageInput) {
    quickMessageForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitMessageFromInput(quickMessageInput);
    });
    quickMessageInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      quickMessageForm.requestSubmit();
    });
  }
}

function initSupabaseRealtime() {
  appState.clientId = ensureClientId();
  appState.roomId = resolveRoomId();
  roomCode.textContent = `\ub8f8 ${appState.roomId.toUpperCase()}`;
  prepareStaticDesks();
  recalculateGeometry();

  const config = resolveSupabaseConfig();
  if (!config.url || !config.anonKey) {
    updateSyncLabel("Supabase config required");
    rerender(cycleMyStatus);
    nicknameModal.classList.add("is-open");
    return;
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 14 } }
  });
  const channel = supabase.channel(`room:${appState.roomId}`, {
    config: { presence: { key: appState.clientId }, broadcast: { self: true, ack: true } }
  });
  appState.channel = channel;

  channel
    .on("presence", { event: "sync" }, refreshParticipants)
    .on("presence", { event: "join" }, refreshParticipants)
    .on("presence", { event: "leave" }, refreshParticipants)
    .on("broadcast", { event: "message" }, ({ payload }) => {
      const msg = normalizeMessagePayload(payload);
      if (msg) appendMessage(msg);
    })
    .on("broadcast", { event: "move" }, ({ payload }) => upsertParticipantFromMove(payload))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        appState.subscribed = true;
        updateSyncLabel("connected");
        if (appState.localJoined && appState.localPresence) queuePresencePatch({}, true);
      } else if (status === "CHANNEL_ERROR") {
        appState.subscribed = false;
        updateSyncLabel("channel error");
      } else if (status === "TIMED_OUT") {
        appState.subscribed = false;
        updateSyncLabel("timed out");
      } else if (status === "CLOSED") {
        appState.subscribed = false;
        updateSyncLabel("closed");
      }
    });

  bindCommonActions();
  bindKeyboardMovement();
  initJoystick();
  initNicknameFlow();
  updateMessageInputState();

  const heartbeat = setInterval(() => {
    if (appState.localJoined) queuePresencePatch({}, true);
  }, HEARTBEAT_MS);
  const bubbleCleaner = setInterval(cleanupBubbles, 1200);

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      recalculateGeometry();
      rerender(cycleMyStatus);
    }, 120);
  });

  window.addEventListener("beforeunload", async () => {
    clearInterval(heartbeat);
    clearInterval(bubbleCleaner);
    if (appState.moveRaf) cancelAnimationFrame(appState.moveRaf);
    if (appState.channel) {
      try { await appState.channel.untrack(); } catch (_error) {}
      supabase.removeChannel(appState.channel);
    }
  });
}

initSupabaseRealtime();


