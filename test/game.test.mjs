import test from "node:test";
import assert from "node:assert/strict";
import { createGameHandler, questionBank } from "../netlify/lib/game.js";

function fakeBlobs() {
  const values = new Map(); let revision = 0;
  return {
    values,
    getStore(options) {
      assert.equal(options.consistency, "strong");
      return {
        async getWithMetadata(key, options) {
          assert.equal(options.consistency, "strong");
          const found = values.get(key);
          return found ? { data: structuredClone(found.data), etag: found.etag } : null;
        },
        async setJSON(key, value, options = {}) {
          assert.ok(options.onlyIfNew || options.onlyIfMatch, "every write is conditional");
          const found = values.get(key);
          if (options.onlyIfNew && found) return { modified: false };
          if (options.onlyIfMatch && found?.etag !== options.onlyIfMatch) return { modified: false };
          const etag = `"revision-${++revision}"`;
          values.set(key, { data: structuredClone(value), etag });
          return { modified: true, etag };
        },
      };
    },
  };
}

test("two players complete three synchronized rounds, score captures and show the winner", async () => {
  const blobs = fakeBlobs();
  const handler = createGameHandler(blobs.getStore);
  async function request(action, player = {}, extra = {}) {
    const response = await handler(new Request("https://example.test/.netlify/functions/game", {
      method: action === "state" ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-player-token": player.token || "" },
      ...(action === "state" ? {} : { body: JSON.stringify({ action, code: player.code, playerId: player.playerId, token: player.token, ...extra }) }),
    }));
    return { status: response.status, data: await response.json() };
  }
  const created = await request("create", {}, { name: "Ari" });
  assert.equal(created.status, 201);
  const p1 = { code: created.data.code, playerId: created.data.playerId, token: created.data.token };
  const joined = await request("join", { code: p1.code }, { name: "Bea" });
  assert.equal(joined.status, 201);
  const p2 = { code: p1.code, playerId: joined.data.playerId, token: joined.data.token };
  assert.deepEqual(joined.data.state.players.map(p => p.name), ["Ari", "Bea"]);
  const stateFor = async player => {
    const response = await handler(new Request(`https://example.test${"/.netlify/functions/game"}?code=${player.code}`));
    assert.equal(response.status, 200);
    return response.json();
  };
  assert.deepEqual(await stateFor(p1), await stateFor(p2));
  assert.equal((await request("start", p1)).status, 200);
  assert.equal((await request("answer", p2, { answerIndex: 0, territoryId: 0 })).status, 403);

  const turns = [
    [p1, 0], // first claim
    [p2, 0], // steal
    [p1, 0], // steal it back
    [p2, 1],
    [p1, 2],
    [p2, 3],
  ];
  for (let i = 0; i < turns.length; i++) {
    const [player, territoryId] = turns[i];
    const before = await stateFor(player);
    assert.equal(before.round, Math.ceil((i + 1) / 2));
    const question = questionBank.find(item => item.q === before.question.q);
    assert.ok(question);
    const submitted = await request("answer", player, { answerIndex: question.answer, territoryId });
    assert.equal(submitted.status, 200);
    const [view1, view2] = await Promise.all([stateFor(p1), stateFor(p2)]);
    assert.deepEqual(view1, view2, `state synchronized after turn ${i + 1}`);
    if (i < turns.length - 1) assert.equal(view1.status, "playing");
  }
  const final1 = await stateFor(p1), final2 = await stateFor(p2);
  assert.equal(final1.status, "finished");
  assert.equal(final1.round, 3);
  assert.deepEqual(final1, final2);
  assert.deepEqual(final1.players.map(p => [p.name, p.score]), [["Ari", 2], ["Bea", 2]]);
  assert.equal(final1.winnerId, p1.playerId); // alphabetical tie-break
  assert.equal(final1.territories[0].owner, p1.playerId); // successful opponent-territory steals
  assert.equal((await request("resume", p2)).data.state.winnerId, p1.playerId);
});
