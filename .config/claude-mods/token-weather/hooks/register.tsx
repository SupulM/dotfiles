import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Forecast } from '../types'

const forecast = atom({ plugin: 'token-weather', key: 'forecast' } as const, null)

const isWorking = atom({ plugin: 'token-weather', key: 'isWorking' } as const, false)

// The last turn and the one before it: enough for the delta.
const KEPT = 2

// Cells to leave for the footer's left side, its indent and a gap, measured
// from "⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt · ← 1 agent".
const LEFT_IDLE = 56
const LEFT_WORKING = 80

// Red means compaction is near.
const SIGNALS = [
  { from: 90, color: 'red' },
  { from: 50, color: 'yellow' },
]

export const signalFor = (percent: number): string =>
  SIGNALS.find(signal => percent >= signal.from)?.color ?? 'green'

/** 134400 -> "134.4k", 200000 -> "200k", 1000000 -> "1M" */
export const formatTokens = (n: number): string => {
  const scaled = (value: number, unit: string) =>
    `${value.toFixed(1).replace(/\.0$/, '')}${unit}`

  if (n >= 999_950) return scaled(n / 1_000_000, 'M')
  if (n >= 1_000) return scaled(n / 1_000, 'k')

  return String(Math.round(n))
}

function record(
  $: EngineInterface,
  tokens: number | undefined,
  window: number,
  usd: number | undefined,
  isNewTurn: boolean,
): Promise<unknown> {
  return update($, forecast, (old: Forecast | null): Forecast | null => {
    const samples = old?.samples ?? []
    const isSample = tokens !== undefined && (isNewTurn || samples.length === 0)

    return {
      samples: isSample ? [...samples, tokens].slice(-KEPT) : samples,
      window,
      // A forecast stored by an earlier version of this mod has neither.
      estimate: old?.estimate ?? null,
      baseline: old?.baseline ?? null,
      usd: usd ?? old?.usd ?? null,
    }
  })
}

// Before the first response the engine has no token count, so estimate what
// the system prompt, tools and memory files already take. Counted locally: no
// request is sent.
async function estimate($: EngineInterface): Promise<void> {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })
    const total = context.breakdown?.totalTokens

    if (total === undefined) return

    const messages = await $.session.messages()
    const isFresh = Array.isArray(messages) && messages.length === 0

    await update($, forecast, (old: Forecast | null): Forecast | null =>
      old === null
        ? null
        : { ...old, estimate: total, baseline: isFresh ? total : old.baseline },
    )
  } catch {
    // No estimate: the footer shows an empty gauge instead.
  }
}

export const register: Register = on => {
  // Show something at once: the current usage when loaded mid-session, an
  // estimate of the starting load otherwise.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { context, cost } = await $.session.usage()
    await record($, context.tokens, context.window, cost?.usd, false)

    if (context.tokens === undefined) await estimate($)

    return result
  })

  // Raised after every main-thread turn, and when the cost grows.
  on('session.measure', async ($, e, next) => {
    await record(
      $,
      e.context.tokens,
      e.context.window,
      e.cost?.usd,
      e.changed.includes('context'),
    )

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // No `session.start` follows a /clear, so fall back to the starting load
    // measured when the session was new.
    if (e.reason === 'clear') {
      await update($, forecast, (old: Forecast | null): Forecast | null =>
        old === null
          ? null
          : { ...old, samples: [], estimate: old.baseline ?? null, usd: null },
      )
    }

    return next(e)
  })

  // Whether a main-thread turn is running: the footer's left side is longer then.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, isWorking, () => true)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await update($, isWorking, () => false)

    return next(e)
  })

  // The right-hand slot of the footer line under the prompt.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const now = await read($, forecast)

    if (now === null) return next(e)

    const { samples, window, usd } = now
    // No turn has reported yet: draw the estimate, or an empty gauge without one.
    const isMeasured = samples.length > 0
    const guess = now.estimate ?? null
    const tokens = isMeasured ? (samples[samples.length - 1] ?? 0) : (guess ?? 0)
    const dot = isMeasured ? '●' : '○'
    const about = !isMeasured && guess !== null ? '~' : ''
    const percent = Math.min(100, Math.round((tokens / window) * 100))
    const signal = signalFor(percent)
    const before = samples[samples.length - 2]

    const modes = e.props.modes.join(' & ')
    // The dot and the space after it lead the percent.
    const share = `${dot} ${about}${percent}%`
    const amount = ` · ${about}${formatTokens(tokens)} / ${formatTokens(window)}`
    const delta =
      before === undefined
        ? ''
        : `${tokens < before ? '▼ −' : '▲ +'}${formatTokens(Math.abs(tokens - before))}`
    const cost = usd === null ? '' : `$${usd.toFixed(2)}`

    // What each level of detail shows, narrowest first. As the row narrows the
    // parts go in this order: the delta, the token amounts, the dot and
    // percent, the cost, and last the mode labels.
    const levels = [
      [modes, cost],
      [modes, share, cost],
      [modes, share + amount, cost],
      [modes, share + amount, delta, cost],
    ]

    // Cells a level takes: its parts, with two spaces between each.
    const width = (parts: string[]) => {
      const shown = parts.filter(part => part !== '')

      return (
        shown.reduce((cells, part) => cells + part.length, 0) +
        2 * Math.max(0, shown.length - 1)
      )
    }

    // The footer's left side shares this row: the permission mode and an agent
    // count when idle, plus "esc to interrupt" while a turn runs. A forecast
    // wider than what is left would wrap onto a second row, so shed detail.
    const columns = e.viewport?.columns ?? 140
    const room = columns - ((await read($, isWorking)) ? LEFT_WORKING : LEFT_IDLE)
    const detail = levels.findLastIndex(level => width(level) <= room)

    // Nothing of ours fits beside the mode labels: the engine draws those.
    if (detail < 0 || (detail === 0 && cost === '')) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    const hasModes = modes !== ''
    const hasShare = detail >= 1
    const hasDelta = detail >= 3 && delta !== ''
    const gap = (isFollowing: boolean) => (isFollowing ? '  ' : '')

    return (
      <Box>
        {hasModes && <Text dimColor>{modes}</Text>}
        {hasShare && (
          <Text>
            {gap(hasModes)}
            <Text color={signal}>{dot}</Text>
            {` ${about}${percent}%`}
            {detail >= 2 && amount}
          </Text>
        )}
        {hasDelta && (
          <Text dimColor>
            {'  '}
            {delta}
          </Text>
        )}
        {cost !== '' && (
          <Text dimColor>
            {gap(hasModes || hasShare)}
            {cost}
          </Text>
        )}
      </Box>
    )
  })
}
