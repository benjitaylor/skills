import { useContext, useEffect, useId, useRef, useState } from 'react'
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { SceneView, type NativeProps } from './native'
import { useLook } from './look'
import { curves, useNumber, useTween } from './animate'
import { MotionContext, useReducedMotion, useEntranceReduced } from './reduced-motion'
import { clock } from './clock'
import { bezier } from './ease'
import { CHANGE_MS, DRAW_EASE, DRAW_MS, chartPoints, resample, smooth, yAt } from './chart-geometry'
import type { Point } from './geometry'

export { chartPoints } from './chart-geometry'
export interface ChartProps extends NativeProps {
  data: number[]
  kind?: 'line' | 'bars'
  width: number
  height: number
  show?: boolean
  area?: boolean
  dot?: boolean
  max?: number
}
// chart.css: an overshoot for the dot's arrival, the kit's default curve for bars; the fades are CSS `ease`.
const POP = [0.34, 1.4, 0.64, 1] as const,
  GROW = [0.25, 0.8, 0.25, 1] as const
/** The drawing overflows the box (the end dot at an edge, values over `max`), as the web chart's overflow: visible. */
const BLEED = 6
function Bar({
  x,
  width,
  height,
  value,
  show,
  index,
  color,
}: {
  x: number
  width: number
  height: number
  value: number
  show: boolean
  index: number
  color: string
}) {
  // A bar mounts at its height, as a CSS transition never runs on first render; it grows when `show` flips or the data changes
  const h = useNumber(useTween(show ? value : 0, 700, { delay: index * 22, ease: GROW }))
  return <Rect x={x} y={height - h} width={width} height={h} rx={Math.min(2, width / 2)} fill={color} />
}
function at(points: Point[], t: number): Point {
  if (!points.length) return { x: 0, y: 0 }
  const i = t * (points.length - 1),
    a = points[Math.floor(i)],
    b = points[Math.ceil(i)]
  return { x: a.x + (b.x - a.x) * (i % 1), y: a.y + (b.y - a.y) * (i % 1) }
}
/** Keep the current geometry on interruption, including when the series changes length. */
function useCurve(next: Point[]) {
  const { speed } = useContext(MotionContext)
  const [points, setPoints] = useState(next),
    current = useRef(next),
    reduced = useReducedMotion()
  const key = JSON.stringify(next)
  useEffect(() => {
    const target = JSON.parse(key) as Point[]
    if (reduced || !current.current.length || !target.length) {
      current.current = target
      setPoints(target)
      return
    }
    const from = current.current,
      start = clock.now(),
      ease = bezier(DRAW_EASE)
    let frame = 0
    const step = (time: number) => {
      const t = Math.min(1, ((time - start) * speed) / CHANGE_MS),
        p = ease(t)
      current.current =
        t === 1
          ? target
          : Array.from({ length: 49 }, (_, i) => {
              const a = at(from, i / 48),
                b = at(target, i / 48)
              return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }
            })
      setPoints(current.current)
      if (t < 1) frame = clock.raf(step)
    }
    frame = clock.raf(step)
    return () => clock.cancelRaf(frame)
  }, [key, reduced, speed])
  return points
}
/**
 * The draw-in's wipe, 0 to 1, led by the dot. It runs each time `show` turns true (on mount too) and not again
 * while the chart stays shown; hiding leaves the line whole, so it fades out rather than un-drawing.
 */
function useDraw(show: boolean, drawable: boolean, width: number) {
  const { speed } = useContext(MotionContext)
  // An entrance: it draws through settling, as on web; only a still or the OS preference skips it
  const reduced = useEntranceReduced()
  const [wipe, setWipe] = useState(show && drawable && !reduced ? 0 : 1),
    shown = useRef(false)
  useEffect(() => {
    const was = shown.current
    shown.current = show && drawable
    if (!show || was || !drawable || reduced) {
      setWipe(1)
      return
    }
    const start = clock.now(),
      ease = bezier(DRAW_EASE)
    let frame = 0,
      drawing = true
    const step = (time: number) => {
      const t = Math.min(1, ((time - start) * speed) / DRAW_MS)
      setWipe(ease(t))
      if (t < 1) frame = clock.raf(step)
      else drawing = false
    }
    setWipe(0)
    frame = clock.raf(step)
    return () => {
      clock.cancelRaf(frame)
      // An interrupted draw can draw again; a completed one does not replay
      if (drawing) shown.current = false
      setWipe(1)
    }
  }, [show, drawable, reduced, speed, width])
  return wipe
}
export function Chart({
  data,
  kind = 'line',
  width,
  height,
  show = true,
  area = true,
  dot = true,
  max,
  style,
  ...rest
}: ChartProps) {
  const { tokens } = useLook(),
    id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const points = useCurve(resample(chartPoints({ data, width, height, dot, max })))
  const wipe = useDraw(show, kind === 'line' && data.length > 1, width)
  // Showing fades the drawing in fast and hiding fades it out a little slower; the dot fades and grows from 0.4
  // with a slight overshoot, and shrinks back as it goes
  const fade = useNumber(useTween(show ? 1 : 0, show ? 150 : 250, { ease: curves.ease }))
  const dotOpacity = useNumber(useTween(show ? 1 : 0, 200, { ease: curves.ease }))
  const dotScale = useNumber(useTween(show ? 1 : 0.4, show ? 300 : 200, { ease: show ? POP : curves.ease }))
  const first = points[0],
    last = points[points.length - 1]
  const x = first && last ? first.x + (last.x - first.x) * wipe : 0
  const path = smooth(points),
    y = points.length > 1 ? yAt(points, x) : (first?.y ?? 0)
  const gap = Math.max(2, Math.round(width / Math.max(1, data.length) / 4)),
    bw = (width - gap * (data.length - 1)) / Math.max(1, data.length)
  const top = max ?? Math.max(...data, 1)
  return (
    <SceneView {...rest} style={[{ width, height }, style]}>
      <Svg
        width={width + BLEED * 2}
        height={height + BLEED * 2}
        viewBox={`${-BLEED} ${-BLEED} ${width + BLEED * 2} ${height + BLEED * 2}`}
        style={{ position: 'absolute', left: -BLEED, top: -BLEED }}
      >
        <Defs>
          <LinearGradient id={`${id}fill`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tokens.accent} stopOpacity={0.18} />
            <Stop offset="1" stopColor={tokens.accent} stopOpacity={0} />
          </LinearGradient>
          <ClipPath id={`${id}wipe`}>
            {/* In the chart's own units, so while drawing its edge is exactly the dot's x */}
            <Rect x={-6} y={-6} width={wipe < 1 ? x + 6 : width + 12} height={height + 12} />
          </ClipPath>
        </Defs>
        {kind === 'bars'
          ? data.map((v, i) => (
              <Bar
                key={i}
                x={i * (bw + gap)}
                width={bw}
                height={height}
                value={Math.max(2, (v / top) * (height - 2))}
                show={show}
                index={i}
                color={tokens.accent}
              />
            ))
          : first &&
            last && (
              <>
                <G clipPath={`url(#${id}wipe)`} opacity={fade}>
                  {area && points.length > 1 && (
                    <Path d={`${path}L${last.x} ${height}L${first.x} ${height}Z`} fill={`url(#${id}fill)`} />
                  )}
                  <Path
                    d={path}
                    stroke={tokens.accent}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </G>
                {dot && (
                  <Circle
                    cx={x}
                    cy={y}
                    r={3.5 * dotScale}
                    fill={tokens.accent}
                    stroke={tokens.surface}
                    strokeWidth={2 * dotScale}
                    opacity={dotOpacity}
                  />
                )}
              </>
            )}
      </Svg>
    </SceneView>
  )
}
