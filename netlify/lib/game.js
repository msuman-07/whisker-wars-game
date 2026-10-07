import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const questionBank = [
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "How many sides does a hexagon have?", options: ["Five", "Six", "Seven", "Eight"], answer: 1 },
  { q: "Which gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
  { q: "What is the capital city of Japan?", options: ["Seoul", "Tokyo", "Kyoto", "Osaka"], answer: 1 },
  { q: "Which animal is the largest mammal?", options: ["African elephant", "Blue whale", "Giraffe", "Orca"], answer: 1 },
  { q: "What is the chemical symbol for gold?", options: ["Ag", "Gd", "Au", "Go"], answer: 2 },
  { q: "How many bones are in the adult human body?", options: ["186", "206", "226", "246"], answer: 1 },
  { q: "Which continent contains the Sahara Desert?", options: ["Asia", "South America", "Africa", "Australia"], answer: 2 },
  { q: "What is the closest star to Earth?", options: ["Sirius", "The Sun", "Proxima Centauri", "Vega"], answer: 1 },
  { q: "Which instrument has keys, pedals, and strings?", options: ["Harp", "Piano", "Violin", "Flute"], answer: 1 },
  { q: "What is the fastest land animal?", options: ["Lion", "Pronghorn", "Cheetah", "Horse"], answer: 2 },
  { q: "Which language is primarily spoken in Brazil?", options: ["Spanish", "Portuguese", "French", "Italian"], answer: 1 },
  { q: "What is the freezing point of water in Celsius?", options: ["0°", "10°", "32°", "-10°"], answer: 0 },
  { q: "Which bird is famous for its ability to mimic speech?", options: ["Eagle", "Parrot", "Penguin", "Owl"], answer: 1 },
  { q: "What is the largest planet in our solar system?", options: ["Saturn", "Neptune", "Earth", "Jupiter"], answer: 3 },
  { q: "How many colors are in a traditional rainbow?", options: ["Five", "Six", "Seven", "Eight"], answer: 2 },
  { q: "Which metal is liquid at room temperature?", options: ["Iron", "Mercury", "Aluminum", "Copper"], answer: 1 },
  { q: "What is the name of the process plants use to make food?", options: ["Respiration", "Fermentation", "Photosynthesis", "Digestion"], answer: 2 },
  { q: "Which country gifted the Statue of Liberty to the US?", options: ["France", "Italy", "Canada", "Spain"], answer: 0 },
  { q: "What is the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Which is the longest river in South America?", options: ["Nile", "Amazon", "Paraná", "Orinoco"], answer: 1 },
  { q: "What do bees collect from flowers to make honey?", options: ["Pollen", "Nectar", "Sap", "Dew"], answer: 1 },
  { q: "Which planet has prominent rings?", options: ["Mars", "Venus", "Saturn", "Mercury"], answer: 2 },
  { q: "How many minutes are in two hours?", options: ["100", "120", "150", "180"], answer: 1 },
  { q: "What is the largest organ of the human body?", options: ["Liver", "Brain", "Skin", "Lung"], answer: 2 },
  { q: "Which shape has exactly three sides?", options: ["Square", "Triangle", "Pentagon", "Trapezoid"], answer: 1 },
  { q: "What is the currency of the United Kingdom?", options: ["Euro", "Pound sterling", "Franc", "Dollar"], answer: 1 },
  { q: "Which season comes after spring in the Northern Hemisphere?", options: ["Autumn", "Winter", "Summer", "Monsoon"], answer: 2 },
  { q: "How many players are on the field for one soccer team?", options: ["9", "10", "11", "12"], answer: 2 },
];

const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const hash = value => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("hex");
const code = () => Array.from(randomBytes(5), b => codeChars[b % codeChars.length]).join("");
const cleanName = value => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 18) : "";
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const reject = (status, message) => { const error = new Error(message); error.status = status; throw error; };

export function publicState(room) {
  const state = structuredClone(room);
  delete state.sessions;
  const q = questionBank[state.questionIndex % questionBank.length];
  state.question = { q: q.q, options: q.options };
  delete state.questionIndex;
  state.round = state.status === "lobby" ? 0 : Math.min(3, Math.ceil(state.turnNumber / state.players.length));
  return state;
}

function authenticated(room, body, request) {
  const playerId = body.playerId;
  const presented = request.headers.get("x-player-token") || body.token || "";
  const stored = room.sessions[playerId];
  if (!stored || !room.players.some(player => player.id === playerId)) return false;
  const a = Buffer.from(stored), b = Buffer.from(hash(presented));
  return a.length === b.length && timingSafeEqual(a, b);
}

function mutate(room, body, request) {
  if (!authenticated(room, body, request)) reject(401, "Reconnect to this room to continue.");
  const playerId = body.playerId;
  if (body.action === "resume") return { state: publicState(room) };
  if (body.action === "start") {
    if (playerId !== room.hostId) reject(403, "Only the host can start the game.");
    if (room.status !== "lobby" || room.players.length < 2) reject(409, "At least two players are needed.");
    room.status = "playing"; room.turn = 0; room.turnNumber = 1;
    room.questionIndex = Math.floor(Math.random() * questionBank.length); room.lastResult = null;
    return { state: publicState(room) };
  }
  if (body.action !== "answer") reject(400, "Unknown action.");
  if (room.status !== "playing") reject(409, "The game is not in progress.");
  if (room.players[room.turn]?.id !== playerId) reject(403, "It is not your turn.");
  const territory = room.territories.find(item => item.id === body.territoryId);
  if (!territory) reject(400, "Select a territory on the map.");
  if (territory.owner === playerId) reject(409, "Choose a neutral or rival territory.");
  const answerIndex = Number(body.answerIndex);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) reject(400, "Choose an answer first.");
  const q = questionBank[room.questionIndex % questionBank.length];
  const correct = answerIndex === q.answer, previousOwner = territory.owner;
  if (correct) territory.owner = playerId;
  room.lastResult = { playerId, correct, territoryId: territory.id, previousOwner };
  room.players.forEach(player => { player.score = room.territories.filter(item => item.owner === player.id).length; });
  room.turnNumber++;
  if (room.turnNumber > room.players.length * 3 || room.territories.every(item => item.owner)) {
    room.status = "finished";
    room.winnerId = [...room.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))[0].id;
  } else {
    room.turn = (room.turn + 1) % room.players.length;
    room.questionIndex = (room.questionIndex + 1) % questionBank.length;
  }
  return { state: publicState(room) };
}

export function createGameHandler(getStore) {
  return async function handler(request) {
    const store = getStore({ name: "claim-game-rooms", consistency: "strong" });
    try {
      const url = new URL(request.url);
      if (request.method === "GET") {
        const roomCode = (url.searchParams.get("code") || "").toUpperCase();
        if (!/^[A-Z0-9]{5}$/.test(roomCode)) return json(400, { error: "Room codes have five characters." });
        const entry = await store.getWithMetadata(roomCode, { consistency: "strong", type: "json" });
        return entry?.data ? json(200, publicState(entry.data)) : json(404, { error: "Room not found." });
      }
      if (request.method !== "POST") return json(405, { error: "Method not allowed." });
      const body = await request.json();
      if (body.action === "create") {
        const name = cleanName(body.name);
        if (!name) return json(400, { error: "Choose a display name." });
        for (let attempt = 0; attempt < 12; attempt++) {
          const roomCode = code(), playerId = randomUUID(), playerToken = token();
          const room = { status: "lobby", hostId: playerId, players: [{ id: playerId, name, score: 0 }], territories: Array.from({ length: 24 }, (_, id) => ({ id, owner: null })), turn: 0, turnNumber: 0, questionIndex: 0, lastResult: null, winnerId: null, sessions: { [playerId]: hash(playerToken) } };
          const written = await store.setJSON(roomCode, room, { onlyIfNew: true });
          if (written.modified) return json(201, { code: roomCode, playerId, token: playerToken, state: publicState(room) });
        }
        return json(503, { error: "Could not create a room. Please try again." });
      }
      const roomCode = String(body.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(roomCode)) return json(400, { error: "Room codes have five characters." });
      if (body.action === "join") {
        const name = cleanName(body.name);
        if (!name) return json(400, { error: "Choose a display name." });
        for (let attempt = 0; attempt < 8; attempt++) {
          const entry = await store.getWithMetadata(roomCode, { consistency: "strong", type: "json" });
          if (!entry?.data) return json(404, { error: "Room not found." });
          const room = entry.data;
          if (room.status !== "lobby") return json(409, { error: "This game has already started." });
          if (room.players.length >= 8) return json(409, { error: "This room is full." });
          if (room.players.some(player => player.name.toLowerCase() === name.toLowerCase())) return json(409, { error: "That display name is already in this room." });
          const playerId = randomUUID(), playerToken = token();
          room.players.push({ id: playerId, name, score: 0 }); room.sessions[playerId] = hash(playerToken);
          const written = await store.setJSON(roomCode, room, { onlyIfMatch: entry.etag });
          if (written.modified) return json(201, { code: roomCode, playerId, token: playerToken, state: publicState(room) });
        }
        return json(409, { error: "The room changed while joining. Please try again." });
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        const entry = await store.getWithMetadata(roomCode, { consistency: "strong", type: "json" });
        if (!entry?.data) return json(404, { error: "Room not found." });
        const room = entry.data;
        if (body.action === "resume") return authenticated(room, body, request) ? json(200, { state: publicState(room) }) : json(401, { error: "Reconnect to this room to continue." });
        const output = mutate(room, body, request);
        const written = await store.setJSON(roomCode, room, { onlyIfMatch: entry.etag });
        if (written.modified) return json(200, output);
      }
      return json(409, { error: "The room changed while submitting. Please try again." });
    } catch (error) {
      return json(error.status || 400, { error: error.status ? error.message : "The game request could not be completed." });
    }
  };
}
