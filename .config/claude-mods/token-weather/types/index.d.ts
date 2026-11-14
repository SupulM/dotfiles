export type Forecast = {
  /** Context tokens after each turn, oldest first; the last two, for the delta. */
  samples: number[]
  /** The model's context window, in tokens. */
  window: number
  /** Session cost in US dollars; null where the host keeps no ledger. */
  usd: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'token-weather': { forecast: Forecast | null; isWorking: boolean }
  }
}
