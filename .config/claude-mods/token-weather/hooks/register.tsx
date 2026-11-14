import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Forecast } from '../types'

const forecast = atom({ plugin: 'token-weather', key: 'forecast' } as const, null)

const isWorking = atom({ plugin: 'token-weather', key: 'isWorking' } as const, false)

const TURNS = 12

// Cells to leave for the footer's left side, its indent and a gap, measured
// from "⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt · ← 1 agent".
const LEFT_IDLE = 56
const LEFT_WORKING = 80
const BARS = '▁▂▃▄▅▆▇█'

const CLEAR = { from: 0, icon: '☀', word: 'Clear', color: 'yellow' }

const SKIES = [
  { from: 90, icon: '↯', word: 'Compact soon', color: 'red' },
  { from: 75, icon: '☇', word: 'Storm', color: 'magenta' },
  { from: 50, icon: '☂', word: 'Showers', color: 'blue' },
  { from: 25, icon: '☁', word: 'Cloudy', color: 'cyan' },
]

export const skyFor = (percent: number) =>
  SKIES.find(sky => percent >= sky.from) ?? CLEAR

/** 134400 -> "134.4k", 200000 -> "200k", 1000000 -> "1M" */
export const formatTokens = (n: number): string => {
  const scaled = (value: number, unit: string) =>
    `${value.toFixed(1).replace(/\.0$/, '')}${unit}`

  if (n >= 999_950) return scaled(n / 1_000_000, 'M')
  if (n >= 1_000) return scaled(n / 1_000, 'k')

  return String(Math.round(n))
}

/** One bar per turn: how full the window was after it. */
export const chart = (samples: number[], window: number): string =>
  samples
    .slice(-TURNS)
    .map(tokens => {
      const fill = Math.min(1, Math.max(0, tokens / window))

      return BARS[Math.min(BARS.length - 1, Math.floor(fill * BARS.length))]
    })
    .join('')

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

    if (!isSample && old === null) return null

    return {
      samples: isSample ? [...samples, tokens].slice(-(TURNS + 1)) : samples,
      window,
      usd: usd ?? old?.usd ?? null,
    }
  })
}

export const register: Register = on => {
  // Loaded mid-session: show the current sky without waiting for a turn.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { context, cost } = await $.session.usage()
    await record($, context.tokens, context.window, cost?.usd, false)

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
    if (e.reason === 'clear') await update($, forecast, () => null)

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

    if (now === null || now.samples.length === 0) {
      return next(e)
    }

    const { samples, window, usd } = now
    const tokens = samples[samples.length - 1] ?? 0
    const percent = Math.min(100, Math.round((tokens / window) * 100))
    const sky = skyFor(percent)
    const before = samples[samples.length - 2]

    const modes = e.props.modes.join(' & ')
    const word = ` ${sky.word}`
    const share = `${percent}%`
    const amount = ` · ${formatTokens(tokens)} / ${formatTokens(window)}`
    const bars = chart(samples, window)
    const delta =
      before === undefined
        ? ''
        : `${tokens < before ? '▼ −' : '▲ +'}${formatTokens(Math.abs(tokens - before))} last turn`
    const cost = usd === null ? '' : `$${usd.toFixed(2)}`

    // Cells each part takes, with the two spaces that lead it.
    const lead = (text: string) => (text === '' ? 0 : text.length + 2)
    const base = 1 + lead(share) + lead(cost) + lead(modes)
    const sizes = [
      base,
      base + word.length,
      base + word.length + amount.length,
      base + word.length + amount.length + lead(bars),
      base + word.length + amount.length + lead(bars) + lead(delta),
    ]

    // The footer's left side shares this row: the permission mode and an agent
    // count when idle, plus "esc to interrupt" while a turn runs. A forecast
    // wider than what is left would wrap onto a second row, so shed detail.
    const columns = e.viewport?.columns ?? 140
    const room = columns - ((await read($, isWorking)) ? LEFT_WORKING : LEFT_IDLE)
    const detail = sizes.findLastIndex(size => size <= room)

    if (detail < 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        {modes !== '' && <Text dimColor>{modes}{'  '}</Text>}
        <Text color={sky.color} bold>
          {sky.icon}
          {detail >= 1 && word}
        </Text>
        <Text>
          {'  '}
          {share}
          {detail >= 2 && amount}
        </Text>
        {detail >= 3 && (
          <Text color={sky.color}>
            {'  '}
            {bars}
          </Text>
        )}
        {detail >= 4 && delta !== '' && (
          <Text dimColor>
            {'  '}
            {delta}
          </Text>
        )}
        {cost !== '' && (
          <Text color="green">
            {'  '}
            {cost}
          </Text>
        )}
      </Box>
    )
  })
}
