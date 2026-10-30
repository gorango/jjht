/**
 * The Mozaik adapter for the airlock.
 *
 * Verified against the workspace's `@mozaik-ai/core` (v4.1.0):
 *   - `runLoop(agentId, message, input, interceptionHandler?)`
 *   - `InterceptionHandler.handle(transition)` is async and may await, so it can
 *     hold a pending tool call while peer intents arrive.
 *   - the `function_call` transition carries `input.call`, and
 *     `FunctionCallItem.rehydrate` lets us substitute the arguments.
 *
 * Scaffold status: this adapter is typed and compiles, but is not wired into a
 * live run yet. `reconcile` is the tested core; see docs/03-airlock.md for the
 * wiring plan and the open question about denial semantics.
 */
import {
  FunctionCallItem,
  type ExecutableTransition,
  type InterceptionHandler,
} from "@mozaik-ai/core";

export interface PendingCall {
  callId: string;
  name: string;
  args: string;
}

export type ReviewResult =
  | { kind: "allow" }
  | { kind: "rewrite"; args: string }
  | { kind: "deny"; reason: string };

export interface AirlockHandlerOptions {
  /** The tool agents use to propose actions. */
  toolName?: string;
  /** Called with the pending call; may await peer intents. */
  review: (call: PendingCall, transition: ExecutableTransition) => Promise<ReviewResult> | ReviewResult;
}

export const createAirlockHandler = (options: AirlockHandlerOptions): InterceptionHandler => {
  const toolName = options.toolName ?? "act";

  return {
    isSatisfiedBy(transition) {
      return transition.nextStateId === "function_call" && transition.input.call.name === toolName;
    },

    async handle(transition) {
      if (transition.nextStateId !== "function_call") return transition;

      const call = transition.input.call;
      const verdict = await options.review(
        { callId: call.callId, name: call.name, args: call.args },
        transition,
      );

      if (verdict.kind === "allow") return transition;

      if (verdict.kind === "rewrite") {
        return {
          ...transition,
          input: {
            ...transition.input,
            call: FunctionCallItem.rehydrate({
              callId: call.callId,
              name: call.name,
              args: verdict.args,
            }),
          },
        };
      }

      // Denial is expressed as a call to a no-op tool rather than a thrown error,
      // so the loop stays alive and the refusal is recorded as a normal event.
      return {
        ...transition,
        input: {
          ...transition.input,
          call: FunctionCallItem.rehydrate({
            callId: call.callId,
            name: "refuse_action",
            args: JSON.stringify({ reason: verdict.reason }),
          }),
        },
      };
    },
  };
};
