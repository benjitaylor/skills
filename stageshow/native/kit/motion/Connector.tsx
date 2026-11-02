import { useId, useState, type ReactNode } from 'react'
import { Animated } from 'react-native'
import Svg, { Path, Circle, Defs, Mask } from 'react-native-svg'
import { corners, along, elbow, type Route } from '../connector-geometry'
import type { Point } from '../geometry'
import { useTween, useNumber, curves } from '../animate'
import { useLook } from '../look'
import { SceneView, Label, useScene, type NativeProps } from '../native'

export interface ConnectorProps extends NativeProps {
  from: Point
  to: Point
  route?: Route
  show: boolean
  radius?: number
  dots?: 'end' | 'both' | 'none'
  arrow?: boolean
  label?: ReactNode
  labelAt?: number
  dashed?: boolean
}
const pop = [0.22, 1, 0.36, 1] as const
export function Connector({
  from,
  to,
  route = 'h',
  show,
  radius = 8,
  dots,
  arrow,
  label,
  labelAt = 0.5,
  dashed,
  style,
  ...rest
}: ConnectorProps) {
  const { tokens } = useLook(),
    scene = useScene(),
    id = useId().replace(/:/g, ''),
    [labelSize, setLabelSize] = useState({ width: 0, height: 0 })
  // Draws on over a second. Hidden, the line fades intact, then resets undrawn out of sight (Connector.css)
  const draw = useNumber(useTween(show ? 1 : 0, show ? 1000 : 0, { delay: show ? 0 : 250, ease: [0.65, 0, 0.35, 1] }))
  const line = useNumber(useTween(show ? 1 : 0, 250, { ease: curves.ease }))
  const tip =
    arrow && route === 'curve'
      ? { x: to.x - Math.sign(to.x - from.x) * Math.min(8, Math.abs(to.x - from.x) / 3), y: to.y }
      : to
  const path = elbow(from, tip, route, radius) + (tip !== to ? `L${to.x} ${to.y}` : '')
  const points = tip === to ? corners(from, to, route) : [...corners(from, tip, route), to]
  const length =
    points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0) || 1
  const last = points[points.length - 1],
    previous =
      points
        .slice(0, -1)
        .reverse()
        .find((p) => Math.hypot(last.x - p.x, last.y - p.y) > 0.001) ?? last
  const distance = Math.hypot(last.x - previous.x, last.y - previous.y),
    ux = (last.x - previous.x) / (distance || 1),
    uy = (last.y - previous.y) / (distance || 1)
  const head = `M${last.x - ux * 6 - uy * 4} ${last.y - uy * 6 + ux * 4}L${last.x} ${last.y}L${last.x - ux * 6 + uy * 4} ${last.y - uy * 6 - ux * 4}`
  const ends = dots ?? (arrow ? 'none' : 'end'),
    at = along(points, labelAt),
    arrived = show && draw >= 0.999
  // The end dot, arrow and label arrive as the line reaches them; a start dot pops as it begins
  const arrival = useTween(arrived ? 1 : 0, 200, { ease: curves.ease })
  const shown = useNumber(arrival),
    grown = useNumber(useTween(arrived ? 1 : 0.4, 300, { ease: pop }))
  const started = useNumber(useTween(show ? 1 : 0, 200, { ease: curves.ease })),
    startGrown = useNumber(useTween(show ? 1 : 0.4, 300, { ease: pop }))
  const dashes = Math.max(1, Math.round((length + 4) / 8)),
    dash = length / (dashes * 2 - 1)
  const step = typeof label === 'number'
  return (
    <SceneView
      {...rest}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: scene?.width ?? Math.max(from.x, to.x) + 20,
          height: scene?.height ?? Math.max(from.y, to.y) + 20,
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Mask id={id} maskUnits="userSpaceOnUse">
            <Path
              d={path}
              fill="none"
              stroke="#fff"
              strokeWidth={8}
              strokeDasharray={[length, length]}
              strokeDashoffset={length * (1 - draw)}
            />
          </Mask>
        </Defs>
        <Path
          d={path}
          fill="none"
          stroke={tokens.accent}
          strokeWidth={1.5}
          opacity={line}
          mask={`url(#${id})`}
          strokeDasharray={dashed ? [dash, dash] : undefined}
        />
        {arrow && distance > 0.001 && (
          <Path
            d={head}
            fill="none"
            stroke={tokens.accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={shown}
          />
        )}
        {ends === 'both' && (
          <Circle
            cx={from.x}
            cy={from.y}
            r={3 * startGrown}
            fill={tokens.accent}
            stroke="#fff"
            strokeWidth={2 * startGrown}
            opacity={started}
          />
        )}
        {ends !== 'none' && (
          <Circle
            cx={to.x}
            cy={to.y}
            r={3 * grown}
            fill={tokens.accent}
            stroke="#fff"
            strokeWidth={2 * grown}
            opacity={shown}
          />
        )}
      </Svg>
      {label !== undefined && (
        <Animated.View
          onLayout={(event) => setLabelSize(event.nativeEvent.layout)}
          style={[
            {
              position: 'absolute',
              left: at.x - labelSize.width / 2,
              top: at.y - labelSize.height / 2,
              opacity: arrival,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
              backgroundColor: tokens.raised,
              boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadow.card}`,
            },
            // A step number is a small circle on the line
            step && {
              width: 18,
              height: 18,
              padding: 0,
              paddingHorizontal: 0,
              paddingVertical: 0,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Label
            lines={1}
            style={{
              fontSize: 10.5,
              fontWeight: '500',
              lineHeight: 14,
              color: tokens.text,
              fontVariant: step ? ['tabular-nums'] : undefined,
            }}
          >
            {label}
          </Label>
        </Animated.View>
      )}
    </SceneView>
  )
}
