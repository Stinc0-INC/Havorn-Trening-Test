const STORAGE_KEY = "havorn-training-roster-v1";
const ATTENDANCE_KEY = "havorn-training-attendance-v1";
const TRAINING_KEEPERS_KEY = "havorn-training-keepers-v1";
const TEAM_COLORS = [
  { name: "Blå", className: "color-blue" },
  { name: "Grønn", className: "color-green" },
  { name: "Gul", className: "color-yellow" },
  { name: "Oransje", className: "color-orange" }
];
const TEST_USERNAME = "admin";
const TEST_PASSWORD = "Havørn";

const PLAYER_NAMES = [
  "Håkon R", "Luca", "Kasper E. Lima Myhre", "Matheo", "Henry", "Leif", "Ilja",
  "Sebastian Y", "Lars", "Theodor", "Eskil", "Ulrik", "Sander", "Aslak", "Lucas",
  "Gabriel", "Aksel", "Jakob", "Elias", "Jonas", "Patrick", "Tobias", "Mio", "Trym",
  "Simon", "Heine", "William", "Felix", "Noah", "Emil", "Nils", "Nojus", "Herman",
  "Mark", "Johannes", "Hud", "Sebastian F", "Wilhelm", "Magnus", "Håkon N", "Isaac", "Martin"
];
const DEFAULT_KEEPER_NAMES = new Set(["Felix", "Heine", "Noah", "Jonas"]);
const defaultRoster = () => PLAYER_NAMES.map((name, i) => ({ id: `p${i + 1}`, name, isGoalkeeper: DEFAULT_KEEPER_NAMES.has(name) }));
function loadRoster() {
  const stored = load(STORAGE_KEY, null);
  const isOldTestList = Array.isArray(stored) && stored.length === 42 && stored.every((p, i) => p.name === `Spiller ${i + 1}`);
  if (!stored || isOldTestList) return defaultRoster();
  return stored.map(player => ({
    ...player,
    isGoalkeeper: typeof player.isGoalkeeper === "boolean" ? player.isGoalkeeper : DEFAULT_KEEPER_NAMES.has(player.name)
  }));
}
let roster = loadRoster();
let attendance = new Set(load(ATTENDANCE_KEY, []));
let trainingKeepers = new Set(load(TRAINING_KEEPERS_KEY, []));
let guests = [];
let middleAssignments = new Map();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const normalize = (value) => String(value || "").trim().toLocaleLowerCase("nb-NO").replace(/\s+/g, " ");

function showAuthenticatedState() {
  const authenticated = sessionStorage.getItem("havorn-test-login") === "true";
  $("#login-screen").hidden = authenticated;
  $("#app-shell").hidden = !authenticated;
  if (authenticated) renderAttendance();
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify([...attendance].filter(id => roster.some(p => p.id === id))));
  localStorage.setItem(TRAINING_KEEPERS_KEY, JSON.stringify([...trainingKeepers].filter(id => attendance.has(id))));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
function rosterNameMatches(playerName, spondName) {
  const rosterName = normalize(playerName);
  const incomingName = normalize(spondName);
  const rosterParts = rosterName.split(" ");
  const incomingParts = incomingName.split(" ");
  if (rosterName === incomingName || incomingName.startsWith(`${rosterName} `) || rosterName.startsWith(`${incomingName} `)) return true;
  if (rosterParts.length === 1) return incomingParts.includes(rosterParts[0]);
  if (rosterParts.length === 2 && rosterParts[1].replace(".", "").length === 1) {
    const initial = rosterParts[1].replace(".", "");
    return incomingParts[0] === rosterParts[0] && incomingParts.slice(1).some(part => part.startsWith(initial));
  }
  return false;
}
function allPlayers() { return [...roster, ...guests]; }
function selectedPlayers() { return allPlayers().filter(p => attendance.has(p.id)); }

function showView(name) {
  $$(".view").forEach(v => v.classList.remove("active"));
  $(`#${name}-view`).classList.add("active");
  if (name === "admin") renderAdmin();
  if (name === "groups") prepareGroups();
  scrollTo({ top: 0, behavior: "smooth" });
}

function renderAttendance() {
  const list = $("#attendance-list");
  list.innerHTML = allPlayers().map((p, index) => {
    const selected = attendance.has(p.id);
    const keeper = trainingKeepers.has(p.id);
    const rank = roster.findIndex(item => item.id === p.id) + 1;
    const playerNote = rank ? (p.isGoalkeeper ? "Fast keeper" : "") : "Gjestespiller";
    return `<div class="player-check ${selected ? "selected" : ""}"><label class="attendance-choice"><input type="checkbox" data-attendance-id="${p.id}" ${selected ? "checked" : ""}><span class="rank">${rank || "G"}</span><span><strong>${escapeHtml(p.name)}</strong>${playerNote ? `<small>${playerNote}</small>` : ""}</span></label><label class="keeper-choice ${keeper ? "active" : ""}"><input type="checkbox" data-training-keeper="${p.id}" ${keeper ? "checked" : ""} ${selected ? "" : "disabled"}>Keeper</label></div>`;
  }).join("");
  $("#attendance-count").textContent = `${selectedPlayers().length} kommer · ${trainingKeepers.size} keepere`;
  $$('[data-attendance-id]').forEach(input => input.addEventListener("change", () => {
    const player = allPlayers().find(p => p.id === input.dataset.attendanceId);
    if (input.checked) {
      attendance.add(player.id);
      if (player.isGoalkeeper) trainingKeepers.add(player.id);
    } else {
      attendance.delete(player.id);
      trainingKeepers.delete(player.id);
    }
    save(); renderAttendance();
  }));
  $$('[data-training-keeper]').forEach(input => input.addEventListener("change", () => {
    input.checked ? trainingKeepers.add(input.dataset.trainingKeeper) : trainingKeepers.delete(input.dataset.trainingKeeper);
    save(); renderAttendance();
  }));
}

function prepareGroups() {
  const players = selectedPlayers();
  const fieldCount = players.filter(player => !trainingKeepers.has(player.id)).length;
  const keeperCount = players.length - fieldCount;
  $("#group-player-count").textContent = `${fieldCount}+${keeperCount} K`;
  $("#group-count").value = 4;
  renderGroups();
}
function splitBalancedTeams(players) {
  const teams = [[], []];
  players.forEach((player, index) => teams[Math.floor(index / 2) % 2 === 0 ? index % 2 : 1 - (index % 2)].push(player));
  return teams;
}
function splitIntoBalancedTeams(players, teamCount) {
  const teams = Array.from({ length: teamCount }, () => []);
  players.forEach((player, index) => {
    const row = Math.floor(index / teamCount);
    const column = index % teamCount;
    const teamIndex = row % 2 === 0 ? column : teamCount - 1 - column;
    teams[teamIndex].push(player);
  });
  return teams;
}
function renderGroups() {
  const players = selectedPlayers();
  const keepers = players.filter(player => trainingKeepers.has(player.id));
  const fieldPlayers = players.filter(player => !trainingKeepers.has(player.id));
  const requested = Number($("#group-count").value) || 1;
  const count = Math.max(1, Math.min(requested, Math.max(fieldPlayers.length, 1)));
  const base = Math.floor(fieldPlayers.length / count);
  const extra = fieldPlayers.length % count;
  const groups = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < extra ? 1 : 0);
    groups.push(fieldPlayers.slice(cursor, cursor + size)); cursor += size;
  }
  $("#per-group").textContent = fieldPlayers.length ? `${base}–${Math.ceil(fieldPlayers.length / count)}` : "0";
  $("#groups-grid").innerHTML = groups.map((group, index) => {
    const color = TEAM_COLORS[index % TEAM_COLORS.length];
    return `<details class="group-card" open><summary class="group-title ${color.className}"><strong>${color.name}</strong><span>${group.length} spillere <i>⌄</i></span></summary><ol>${group.map(p => `<li><span class="rank">${roster.findIndex(x => x.id === p.id) + 1 || "G"}</span>${escapeHtml(p.name)}</li>`).join("")}</ol></details>`;
  }).join("");
  renderMatches(groups, keepers);
  renderMixedTeams(fieldPlayers, keepers);
}
function renderMatches(groups, selectedKeepers) {
  const fieldPlayers = groups.flat();
  const matchKeepers = [selectedKeepers.slice(0, 2), selectedKeepers.slice(2, 4)];
  const basePerTeam = Math.floor(fieldPlayers.length / 4);
  const matchCoreSize = basePerTeam * 2;
  const middleStart = matchCoreSize;
  const middleEnd = fieldPlayers.length - matchCoreSize;
  const middlePlayers = fieldPlayers.slice(middleStart, middleEnd);
  const validMiddleIds = new Set(middlePlayers.map(player => player.id));
  middleAssignments = new Map([...middleAssignments].filter(([id]) => validMiddleIds.has(id)));
  const assignedUp = middlePlayers.filter(player => middleAssignments.get(player.id) === 0);
  const assignedDown = middlePlayers.filter(player => middleAssignments.get(player.id) === 1);
  const fieldPools = [
    [...fieldPlayers.slice(0, middleStart), ...assignedUp],
    [...assignedDown, ...fieldPlayers.slice(middleEnd)]
  ];
  const middlePanel = $("#middle-players");
  middlePanel.hidden = middlePlayers.length === 0;
  middlePanel.innerHTML = middlePlayers.length ? `<div class="middle-head"><strong>Mellomgruppe</strong><span>Velg kamp for ${middlePlayers.length} spiller${middlePlayers.length === 1 ? "" : "e"}</span></div>${middlePlayers.map(player => {
    const assignment = middleAssignments.get(player.id);
    return `<div class="middle-row"><span><i class="rank">${roster.findIndex(item => item.id === player.id) + 1 || "G"}</i><strong>${escapeHtml(player.name)}</strong></span><div><button class="${assignment === 0 ? "active" : ""}" data-middle-player="${player.id}" data-middle-match="0">Kamp 1</button><button class="${assignment === 1 ? "active" : ""}" data-middle-player="${player.id}" data-middle-match="1">Kamp 2</button></div></div>`;
  }).join("")}` : "";
  const matches = fieldPools.map((pool, matchIndex) => {
    const teams = splitBalancedTeams(pool);
    if (matchKeepers[matchIndex][0]) teams[0].unshift(matchKeepers[matchIndex][0]);
    if (matchKeepers[matchIndex][1]) teams[1].unshift(matchKeepers[matchIndex][1]);
    return {
      first: matchIndex * 2,
      second: matchIndex * 2 + 1,
      keepers: { a: matchKeepers[matchIndex][0]?.id || "", b: matchKeepers[matchIndex][1]?.id || "" },
      teams
    };
  });
  const playerLine = (player, keeperId) => `<span class="${player.id === keeperId ? "keeper-player" : ""}">${player.id === keeperId ? "KEEPER · " : ""}${escapeHtml(player.name)}</span>`;
  $("#matches-grid").innerHTML = matches.map((match, matchIndex) => {
    const firstColor = TEAM_COLORS[match.first % TEAM_COLORS.length];
    const secondColor = TEAM_COLORS[(match.second ?? match.first) % TEAM_COLORS.length];
    return `<article class="match-card"><div class="match-title"><strong>Kamp ${matchIndex + 1}</strong></div><div class="team-split"><div class="team ${firstColor.className}-team"><b>${firstColor.name.toUpperCase()} · ${match.teams[0].length}</b>${match.teams[0].map(p => playerLine(p, match.keepers.a)).join("")}</div><div class="team ${secondColor.className}-team"><b>${secondColor.name.toUpperCase()} · ${match.teams[1].length}</b>${match.teams[1].map(p => playerLine(p, match.keepers.b)).join("")}</div></div></article>`;
  }).join("");
  $$('[data-middle-player]').forEach(button => button.addEventListener("click", () => {
    const playerId = button.dataset.middlePlayer;
    const matchIndex = Number(button.dataset.middleMatch);
    middleAssignments.get(playerId) === matchIndex ? middleAssignments.delete(playerId) : middleAssignments.set(playerId, matchIndex);
    renderMatches(groups, selectedKeepers);
  }));
}
function renderMixedTeams(fieldPlayers, keepers) {
  const teamCount = Math.min(4, Math.max(fieldPlayers.length + keepers.length, 1));
  const teams = splitIntoBalancedTeams(fieldPlayers, teamCount);
  keepers.forEach((keeper, index) => teams[index % teamCount].unshift(keeper));
  $("#mixed-teams-grid").innerHTML = teams.map((team, index) => {
    const color = TEAM_COLORS[index % TEAM_COLORS.length];
    return `<article class="mixed-team"><div class="mixed-team-title ${color.className}"><strong>${color.name}</strong><span>${team.length} spillere</span></div><ol>${team.map(p => `<li class="${trainingKeepers.has(p.id) ? "mixed-keeper" : ""}"><span class="rank">${trainingKeepers.has(p.id) ? "K" : roster.findIndex(x => x.id === p.id) + 1 || "G"}</span>${trainingKeepers.has(p.id) ? "KEEPER · " : ""}${escapeHtml(p.name)}</li>`).join("")}</ol></article>`;
  }).join("");
}

function renderAdmin() {
  $("#admin-list").innerHTML = roster.map((p, index) => `<div class="admin-row"><span class="rank">${index + 1}</span><input value="${escapeHtml(p.name)}" data-name-id="${p.id}" aria-label="Navn, rangering ${index + 1}"><label class="fixed-keeper"><input type="checkbox" data-fixed-keeper="${p.id}" ${p.isGoalkeeper ? "checked" : ""}>Fast keeper</label><span class="row-actions"><button data-up="${p.id}" aria-label="Flytt opp">↑</button><button data-down="${p.id}" aria-label="Flytt ned">↓</button><button data-delete="${p.id}" aria-label="Fjern">×</button></span></div>`).join("");
  $$('[data-name-id]').forEach(input => input.addEventListener("change", () => { const p = roster.find(x => x.id === input.dataset.nameId); p.name = input.value.trim() || p.name; save(); renderAttendance(); }));
  $$('[data-up]').forEach(b => b.addEventListener("click", () => movePlayer(b.dataset.up, -1)));
  $$('[data-down]').forEach(b => b.addEventListener("click", () => movePlayer(b.dataset.down, 1)));
  $$('[data-delete]').forEach(b => b.addEventListener("click", () => { if (confirm("Fjerne spilleren fra listen?")) { roster = roster.filter(p => p.id !== b.dataset.delete); attendance.delete(b.dataset.delete); trainingKeepers.delete(b.dataset.delete); save(); renderAdmin(); renderAttendance(); } }));
  $$('[data-fixed-keeper]').forEach(input => input.addEventListener("change", () => {
    const player = roster.find(p => p.id === input.dataset.fixedKeeper);
    player.isGoalkeeper = input.checked;
    if (attendance.has(player.id)) input.checked ? trainingKeepers.add(player.id) : trainingKeepers.delete(player.id);
    save(); renderAttendance();
  }));
}
function movePlayer(id, direction) {
  const index = roster.findIndex(p => p.id === id), target = index + direction;
  if (target < 0 || target >= roster.length) return;
  [roster[index], roster[target]] = [roster[target], roster[index]]; save(); renderAdmin(); renderAttendance();
}

async function importSpond(file) {
  if (!file) return;
  const message = $("#import-message");
  try {
    if (!window.XLSX) throw new Error("Excel-leseren kunne ikke lastes. Sjekk nettilkoblingen, eller bruk CSV.");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
    if (!rows.length) throw new Error("Filen ser ut til å være tom.");
    let section = "";
    const incoming = [];
    rows.forEach(row => {
      const value = String(row[0] || "").trim();
      const normalized = normalize(value);
      if (/^(deltar|deltatt)\b/.test(normalized)) { section = "deltar"; return; }
      if (/^(ikke svart|kommer ikke|sent oppmøte|gyldig fravær|ikke deltatt)\b/.test(normalized)) { section = "other"; return; }
      if (normalized === "navn") return;
      if (section === "deltar" && value) incoming.push(value);
    });
    if (!incoming.length) throw new Error("Fant ingen spillere under «Deltar» eller «Deltatt» i kolonne A.");
    const matched = [], unknown = [], ambiguous = [];
    incoming.forEach(name => {
      const candidates = roster.filter(player => rosterNameMatches(player.name, name));
      if (candidates.length === 1) matched.push(candidates[0].id);
      else if (candidates.length > 1) ambiguous.push(name);
      else unknown.push(name);
    });
    attendance = new Set(matched);
    trainingKeepers = new Set(roster.filter(player => player.isGoalkeeper && attendance.has(player.id)).map(player => player.id));
    save(); renderAttendance();
    message.className = "message"; message.hidden = false;
    message.textContent = `${matched.length} av ${incoming.length} deltakere ble funnet.${unknown.length ? ` Ikke gjenkjent: ${unknown.join(", ")}.` : ""}${ambiguous.length ? ` Må kontrolleres manuelt: ${ambiguous.join(", ")}.` : ""}`;
  } catch (error) { message.className = "message error"; message.hidden = false; message.textContent = error.message; }
}

$$('[data-view]').forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
$("#select-all").addEventListener("click", () => { roster.forEach(p => { attendance.add(p.id); if (p.isGoalkeeper) trainingKeepers.add(p.id); }); save(); renderAttendance(); });
$("#clear-all").addEventListener("click", () => { attendance.clear(); trainingKeepers.clear(); save(); renderAttendance(); });
$("#to-groups").addEventListener("click", () => selectedPlayers().length ? showView("groups") : alert("Velg minst én spiller først."));
$("#group-count").addEventListener("input", renderGroups);
$("#spond-file").addEventListener("change", event => importSpond(event.target.files[0]));
$("#reset-roster").addEventListener("click", () => { if (confirm("Tilbakestille navn, keepervalg og rangering til den opprinnelige listen med 42 spillere?")) { roster = defaultRoster(); attendance.clear(); trainingKeepers.clear(); save(); renderAdmin(); renderAttendance(); } });
$("#add-player").addEventListener("click", () => { $("#dialog-title").textContent = "Legg til spiller"; $("#name-input").value = ""; $("#name-dialog").showModal(); });
$("#add-guest").addEventListener("click", () => { $("#dialog-title").textContent = "Legg til gjest for i dag"; $("#name-input").value = ""; $("#name-dialog").dataset.guest = "true"; $("#name-dialog").showModal(); });
$("#cancel-dialog").addEventListener("click", () => { delete $("#name-dialog").dataset.guest; $("#name-dialog").close(); });
$("#name-form").addEventListener("submit", event => { event.preventDefault(); const name = $("#name-input").value.trim(); if (!name) return; const id = `p-${Date.now()}`; if ($("#name-dialog").dataset.guest) { guests.push({ id, name }); attendance.add(id); } else { roster.push({ id, name }); save(); renderAdmin(); } delete $("#name-dialog").dataset.guest; $("#name-dialog").close(); renderAttendance(); });

$("#login-form").addEventListener("submit", event => {
  event.preventDefault();
  const username = normalize($("#login-username").value);
  const password = $("#login-password").value;
  if (username === TEST_USERNAME && password === TEST_PASSWORD) {
    sessionStorage.setItem("havorn-test-login", "true");
    $("#login-error").hidden = true;
    showAuthenticatedState();
  } else {
    $("#login-error").hidden = false;
  }
});
$("#logout").addEventListener("click", () => {
  sessionStorage.removeItem("havorn-test-login");
  $("#login-password").value = "";
  showAuthenticatedState();
});

showAuthenticatedState();
