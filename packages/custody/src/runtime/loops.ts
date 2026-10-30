/**
 * Mozaik mints the real loop id inside `runLoop`. The bus carries it on the
 * core's `interception.started` event, which is dispatched synchronously just
 * before the handler is awaited, so the handler can adopt the id it belongs to.
 */
let current: string | undefined;

export const noteLoop = (id: string): void => {
  current = id;
};

export const currentLoop = (): string | undefined => current;
