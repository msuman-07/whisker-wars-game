const $ = id => document.getElementById(id);
const COLORS = ["#c5f36a", "#f4aa83", "#a994ed", "#6ebfd4", "#f0d36f", "#ed83a4", "#88c9a7", "#e5a7e8"];
let roomCode = null, playerId = null, playerToken = null, game = null, pollTimer = null, selectedTerritory = null, selectedAnswer = null, busy = false;
let saved = null;
try { saved = JSON.parse(localStorage.getItem("claim-netlify-session") || "null"); } catch {}
function showScreen(id) { document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === id)); }
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2700); }
function identity(name) { return escapeHtml(name.split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase()); }
function activePlayer() { return game?.players?.[game.turn]; }
function myTurn() { return game?.status === "playing" && activePlayer()?.id === playerId; }
function colorOf(id) { return COLORS[Math.max(0, game.players.findIndex(p => p.id === id)) % COLORS.length]; }
function saveCredential() { localStorage.setItem("claim-netlify-session", JSON.stringify({ code: roomCode, playerId, token: playerToken })); }
const API = "/.netlify/functions/game";
async function api(action, payload = {}) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "x-player-token": playerToken || "" }, body: JSON.stringify({ action, code: roomCode, playerId, token: playerToken, ...payload }) });
  const data = await res.json(); if (!res.ok) throw new Error(data.error || "That action could not be completed.");
  if (data.code) { roomCode = data.code; playerId = data.playerId; playerToken = data.token; saveCredential(); startPolling(); acceptState(data.state); }
  else if (data.state) acceptState(data.state);
  return data;
}
async function getState(code) { const res = await fetch(`${API}?code=${encodeURIComponent(code)}`, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not find that room."); return data; }
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!roomCode) return;
    try { acceptState(await getState(roomCode)); document.body.dataset.connection = "connected"; }
    catch { document.body.dataset.connection = "reconnecting"; }
  }, 1000);
}
function acceptState(state) {
  if (!state) return;
  if (game && game.question?.q !== state.question?.q) { selectedAnswer = null; selectedTerritory = null; }
  game = state;
  if (roomCode) { $("room-code-display").textContent = roomCode; $("invite-code").textContent = roomCode; $("game-room-label").textContent = `ROOM ${roomCode} · LIVE`; }
  if (selectedTerritory !== null && (!myTurn() || game.territories.find(t => t.id === selectedTerritory)?.owner === playerId)) selectedTerritory = null;
  render();
  if (game.status === "lobby") showScreen("room-screen");
  if (game.status === "playing" || game.status === "finished") showScreen("game-screen");
}
function render() {
  if (!game) return;
  renderPlayers(); renderMap(); renderScores();
  const host = game.hostId === playerId;
  $("start-btn").disabled = !host || game.players.length < 2 || game.status !== "lobby";
  $("start-btn").classList.toggle("hidden", !host);
  $("lobby-hint").textContent = !host ? "The host will start when everyone is ready." : game.players.length < 2 ? "Waiting for another player…" : "Everyone’s in. Ready when you are.";
  $("turn-number").textContent = String(game.round || 1).padStart(2, "0");
  $("turn-line").textContent = game.status === "finished" ? "The final territory has been claimed." : myTurn() ? "Your turn. Make it count." : `${activePlayer()?.name || "Someone"} is up next.`;
  $("question-text").textContent = game.question?.q || "The next question is on its way…";
  $("question-counter").textContent = String(game.turnNumber || 1).padStart(2, "0");
  const answers = $("answer-list"); answers.replaceChildren();
  game.question?.options?.forEach((answer, i) => { const btn = document.createElement("button"); btn.className = "answer-option" + (selectedAnswer === i ? " selected" : ""); btn.disabled = !myTurn() || busy; btn.innerHTML = `<span class="answer-letter">${String.fromCharCode(65 + i)}</span><span>${escapeHtml(answer)}</span>`; btn.onclick = () => { selectedAnswer = i; render(); }; answers.append(btn); });
  const target = game.territories.find(t => t.id === selectedTerritory);
  $("target-note").textContent = target ? `Target: Territory ${String(target.id + 1).padStart(2, "0")}` : "Choose a neutral or rival territory on the map.";
  $("submit-answer").disabled = !myTurn() || selectedAnswer === null || selectedTerritory === null || busy;
  $("submit-answer").innerHTML = busy ? "Submitting…" : "Lock in answer <span>↗</span>";
  $("action-error").textContent = game.status === "playing" && !myTurn() ? "It’s another player’s turn." : "";
  $("question-panel").classList.toggle("hidden", game.status === "finished"); $("result-panel").classList.toggle("hidden", game.status !== "finished");
  if (game.status === "finished") renderWinner();
  if (game.lastResult) { const who = game.players.find(p => p.id === game.lastResult.playerId)?.name || "A player"; $("activity").textContent = game.lastResult.correct ? `${who} got it right and claimed Territory ${String(game.lastResult.territoryId + 1).padStart(2, "0")}.` : `${who} missed that one. The map holds for now.`; }
}
function renderPlayers() {
  $("player-count").textContent = `${game.players.length}/8`; const list = $("player-list"); list.replaceChildren();
  game.players.forEach((p, i) => { const row = document.createElement("div"); row.className = "player-row"; row.innerHTML = `<span class="player-avatar" style="--player:${COLORS[i]}">${identity(p.name)}</span><span class="player-name">${escapeHtml(p.name)}${p.id === playerId ? " <i>YOU</i>" : ""}</span><span class="player-tag">${p.id === game.hostId ? "HOST" : `PLAYER 0${i + 1}`}</span>`; list.append(row); });
}
function renderMap() {
  const grid = $("territory-grid"); grid.replaceChildren(); const legend = $("map-legend"); legend.replaceChildren();
  game.players.forEach((p, i) => { const item = document.createElement("span"); item.innerHTML = `<i style="--player:${COLORS[i]}"></i>${escapeHtml(p.name)}`; legend.append(item); });
  game.territories.forEach((t, i) => { const oi = game.players.findIndex(p => p.id === t.owner), cell = document.createElement("button"); cell.className = "territory" + (oi >= 0 ? " owned" : " neutral") + (selectedTerritory === t.id ? " target" : ""); cell.style.setProperty("--player", oi >= 0 ? COLORS[oi] : "#344039"); cell.disabled = !myTurn() || t.owner === playerId || game.status !== "playing"; cell.setAttribute("aria-label", `Territory ${i + 1}${oi >= 0 ? `, owned by ${game.players[oi].name}` : ", neutral"}`); cell.innerHTML = `<span>${String(i + 1).padStart(2, "0")}</span><i>${oi >= 0 ? identity(game.players[oi].name) : "·"}</i>`; cell.onclick = () => { selectedTerritory = t.id; $("action-error").textContent = ""; render(); }; grid.append(cell); });
  $("map-progress").textContent = `${game.territories.filter(t => t.owner).length} CLAIMED`;
}
function renderScores() {
  const list = $("score-list"); list.replaceChildren();
  [...game.players].sort((a, b) => b.score - a.score || game.players.indexOf(a) - game.players.indexOf(b)).forEach((p, i) => { const row = document.createElement("div"); row.className = "score-row" + (p.id === activePlayer()?.id && game.status === "playing" ? " on-turn" : ""); row.innerHTML = `<span class="score-rank">${String(i + 1).padStart(2, "0")}</span><span class="score-dot" style="--player:${colorOf(p.id)}"></span><span class="score-name">${escapeHtml(p.name)}${p.id === playerId ? " <i>YOU</i>" : ""}</span><strong>${p.score}</strong>`; list.append(row); });
}
function renderWinner() {
  const winner = game.players.find(p => p.id === game.winnerId); $("winner-title").textContent = `${winner?.name || "A player"} takes the map.`; const scores = $("final-scores"); scores.replaceChildren();
  [...game.players].sort((a, b) => b.score - a.score).forEach(p => { const row = document.createElement("div"); row.innerHTML = `<span><i style="--player:${colorOf(p.id)}"></i>${escapeHtml(p.name)}${p.id === game.winnerId ? " · WINNER" : ""}</span><b>${p.score} <small>LANDS</small></b>`; scores.append(row); });
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
async function run(action, payload = {}) { busy = true; $("action-error").textContent = ""; render(); try { await api(action, payload); } catch (err) { $("action-error").textContent = err.message; toast(err.message); } finally { busy = false; render(); } }
$("create-btn").onclick = async () => { try { await api("create", { name: $("create-name").value.trim() }); } catch (err) { toast(err.message); } };
$("join-btn").onclick = async () => { try { roomCode = $("room-code").value.trim().toUpperCase(); if (!/^[A-Z0-9]{5}$/.test(roomCode)) throw new Error("Enter the five-character room code."); await api("join", { name: $("join-name").value.trim() }); } catch (err) { toast(err.message); } };
$("start-btn").onclick = () => run("start");
$("submit-answer").onclick = async () => { if (selectedAnswer === null || selectedTerritory === null) return; const answerIndex = selectedAnswer, territoryId = selectedTerritory; await run("answer", { answerIndex, territoryId }); selectedAnswer = null; selectedTerritory = null; render(); };
$("copy-code").onclick = () => navigator.clipboard.writeText(roomCode).then(() => toast("Room code copied."));
$("copy-link").onclick = () => navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${roomCode}`).then(() => toast("Invite link copied."));
$("leave-btn").onclick = () => { clearInterval(pollTimer); localStorage.removeItem("claim-netlify-session"); roomCode = playerId = playerToken = game = null; selectedAnswer = selectedTerritory = null; showScreen("home-screen"); };
$("new-room").onclick = () => { localStorage.removeItem("claim-netlify-session"); location.href = location.pathname; };
$("rules-open").onclick = () => $("rules-dialog").showModal(); $("rules-close").onclick = () => $("rules-dialog").close();
$("room-code").oninput = e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
async function restore() {
  const urlCode = new URLSearchParams(location.search).get("room"), session = saved?.code ? saved : null, code = (urlCode || session?.code || "").toUpperCase(); if (!code) return;
  try { const state = await getState(code); if (session?.code === code && state.players.some(p => p.id === session.playerId)) { roomCode = code; playerId = session.playerId; playerToken = session.token; const data = await api("resume"); startPolling(); acceptState(data.state); } else { $("room-code").value = code; $("join-name").focus(); } }
  catch (err) { if (session?.code === code) localStorage.removeItem("claim-netlify-session"); $("room-code").value = urlCode ? code : ""; if (urlCode) toast(err.message); }
}
restore();
