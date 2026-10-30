/**
 * The session. `defineRuntime` returns the functions every participant uses;
 * they are not top-level exports, so they are created once here and re-exported.
 */
import { defineRuntime } from "@mozaik-ai/core";

import type { EurekaState } from "./state.js";

export const session = defineRuntime<EurekaState>();

export const {
  initializeRuntime,
  resolveRuntime,
  resolveParticipant,
  join,
  leave,
  sendMessage,
  sendEvent,
  runLoop,
} = session;
