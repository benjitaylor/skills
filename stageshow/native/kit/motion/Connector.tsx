import { useId, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import Svg, { Path, Circle, Defs, Mask } from 'react-native-svg'
import { corners, along, elbow, type Route } from '../connector-geometry'
import type { Point } from '../geometry'
import { useTween, useNumber } from '../animate'
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
  const draw = useNumber(useTween(show ? 1 : 0, 650)),
    alpha = useNumber(useTween(show ? 1 : 0, 180))
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
  const dashes = Math.max(1, Math.round((length + 4) / 8)),
    dash = length / (dashes * 2 - 1)
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
      <Svg width="100%" height="100%" opacity={alpha}>
        <Defs>
          <Mask id={id} maskUnits="userSpaceOnUse">
            <Path
              d={path}
              fill="none"
              stroke="#fff"
              strokeWidth={8}
              strokeDasharray={[length, length]}
              strokeDashoffset={show ? length * (1 - draw) : 0}
            />
          </Mask>
        </Defs>
        <Path
          d={path}
          fill="none"
          stroke={tokens.ink[4]}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          mask={`url(#${id})`}
          strokeDasharray={dashed ? [dash, dash] : undefined}
        />
        {arrow && distance > 0.001 && (
          <Path d={head} fill="none" stroke={tokens.ink[4]} strokeWidth={1.5} opacity={arrived ? 1 : 0} />
        )}
        {ends === 'both' && <Circle cx={from.x} cy={from.y} r={3} fill={tokens.ink[4]} />}
        {ends !== 'none' && <Circle cx={to.x} cy={to.y} r={3} fill={tokens.ink[4]} opacity={arrived ? 1 : 0} />}
      </Svg>
      {label !== undefined && (
        <View
          onLayout={(event) => setLabelSize(event.nativeEvent.layout)}
          style={{
            position: 'absolute',
            left: at.x - labelSize.width / 2,
            top: at.y - labelSize.height / 2,
            opacity: arrived ? 1 : 0,
            borderRadius: 99,
            paddingHorizontal: 6,
            paddingVertical: 3,
            backgroundColor: tokens.surface,
            borderWidth: 0.5,
            borderColor: tokens.border,
          }}
        >
          <Label style={{ fontSize: 10 }}>{label}</Label>
        </View>
      )}
    </SceneView>
  )
}
