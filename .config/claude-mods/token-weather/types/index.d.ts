export type Forecast = {
  /** Context tokens after each turn, oldest first; the last two, for the delta. */
  samples: number[]
  /** The model's context window, in tokens. */
  window: number
  /**
   * Estimated context tokens, shown until the first turn reports a real
   * figure; null when the engine gave no estimate.
   */
  estimate: number | null
  /**
   * The estimate of a session with no messages yet: what `/clear` returns
   * to. Null when the mod first loaded into a conversation under way.
   */
  baseline: number | null
  /** Session cost in US dollars; null where the host keeps no ledger. */
  usd: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'token-weather': { forecast: Forecast | null; isWorking: boolean }
  }
}
