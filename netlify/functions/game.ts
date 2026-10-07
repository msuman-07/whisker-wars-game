import { getStore } from "@netlify/blobs";
import { createGameHandler } from "../lib/game.js";

export default createGameHandler(getStore);
