import { useContext, useEffect, useId, useRef, useState } from 'react'
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { SceneView, type NativeProps } from './native'
import { useLook } from './look'
import { useNumber, useTween } from './animate'
import { MotionContext, useReducedMotion } from './reduced-motion'
import { clock } from './clock'
import { bezier } from './ease'
import { chartPoints, resample, smooth, yAt } from './chart-geometry'
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
  const h = useNumber(useTween(show ? value : 0, 650, { from: 0, delay: index * 22 }))
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
      ease = bezier('trip')
    let frame = 0
    const step = (time: number) => {
      const t = Math.min(1, ((time - start) * speed) / 650),
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
  const progress = useNumber(useTween(show ? 1 : 0, show ? 1200 : 180, { from: 0, ease: 'trip' }))
  const first = points[0],
    last = points[points.length - 1]
  const x = first && last ? first.x + (last.x - first.x) * progress : 0
  const path = smooth(points),
    y = points.length > 1 ? yAt(points, x) : (first?.y ?? 0)
  const gap = Math.max(2, Math.round(width / Math.max(1, data.length) / 4)),
    bw = (width - gap * (data.length - 1)) / Math.max(1, data.length)
  const top = max ?? Math.max(...data, 1)
  return (
    <SceneView {...rest} style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`${id}fill`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tokens.accent} stopOpacity={0.18} />
            <Stop offset="1" stopColor={tokens.accent} stopOpacity={0} />
          </LinearGradient>
          <ClipPath id={`${id}wipe`}>
            <Rect x={-6} y={-6} width={x + 12} height={height + 12} />
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
                <G clipPath={`url(#${id}wipe)`} opacity={progress ? 1 : 0}>
                  {area && points.length > 1 && (
                    <Path d={`${path}L${last.x} ${height}L${first.x} ${height}Z`} fill={`url(#${id}fill)`} />
                  )}
                  <Path d={path} stroke={tokens.accent} strokeWidth={1.5} strokeLinecap="round" fill="none" />
                </G>
                {dot && <Circle cx={x} cy={y} r={3.5} fill={tokens.accent} opacity={progress ? 1 : 0} />}
              </>
            )}
      </Svg>
    </SceneView>
  )
}
