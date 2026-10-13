// The chat's messages a page replays when it opens later: on every reconnect, and in every tab that opens the chat.

import type { LoggedMessage } from '../protocol.js';

type Unnumbered<M> = M extends unknown ? Omit<M, 'seq'> : never;

export function eventLog() {
  let entries: LoggedMessage[] = [];
  // From the clock, so a cursor a page kept from before a restart is older than every entry since.
  let last = Date.now();
  return {
    append<M extends Unnumbered<LoggedMessage>>(
      message: M
    ): M & { seq: number } {
      const logged = { ...message, seq: (last += 1) };
      entries.push(logged as LoggedMessage);
      return logged;
    },
    /** The messages after `after`; all of them without one. */
    since: (after = 0): LoggedMessage[] => entries.filter((e) => e.seq > after),
    clear() {
      entries = [];
    }
  };
}
