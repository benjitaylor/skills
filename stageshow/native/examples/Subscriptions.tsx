import { RadialGradient } from '../kit/radial-gradient'
import { useId, useState } from 'react'
import { Animated, View } from 'react-native'
import Svg, { Defs, Rect, Stop } from 'react-native-svg'
import { Check as CheckIcon } from 'lucide-react-native'
import { Avatar, Bar, Chart, Collapse, Count, Fly, Roll, Spinner, Stage, States, Window, SceneView } from '../kit'
import { useTween } from '../kit/animate'
import { SCENES, START, POSTER, script, money, type S } from './subscriptions-model'
import { Copy, row, heroShadow, satelliteShadow, type ExampleProps } from './shared'
const line = 'rgba(0,0,0,.06)'
const old = [
  { name: 62, amount: 34 },
  { name: 78, amount: 40 },
  { name: 54, amount: 34 },
  { name: 70, amount: 40 },
]
function Tile({ sc }: { sc: number }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        backgroundColor: sc === 0 ? '#23304d' : '#e8833a',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Copy style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{SCENES[sc].tile}</Copy>
    </View>
  )
}
function Pill({ amount }: { amount: number }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: '#efeffb' }}>
      <Copy style={{ color: '#5b5bd6', fontSize: 11.5, lineHeight: 16.1, fontWeight: '600' }}>+${amount}</Copy>
    </View>
  )
}
function Checkout({ sc, s, compact }: { sc: number; s: S; compact: boolean }) {
  const scene = SCENES[sc],
    p = scene.pulses[s.k[sc]],
    active = s.scene === sc
  const opacity = useTween(active ? 1 : 0, active ? 600 : 220, { delay: active ? 280 : 0 })
  const x = useTween(active ? 0 : -14, active ? 900 : 400, { delay: active ? 280 : 0 })
  return (
    <SceneView
      hidden={!active}
      style={{
        position: 'absolute',
        left: compact ? 24 : 36,
        top: compact ? undefined : 148,
        bottom: compact ? 24 : undefined,
        width: compact ? 196 : 236,
        padding: compact ? 16 : 18,
        gap: compact ? 12 : 14,
        borderRadius: 12,
        backgroundColor: '#fff',
        boxShadow: satelliteShadow,
        opacity,
        transform: [{ translateX: x }],
      }}
    >
      <View style={[row, { gap: 8 }]}>
        <Tile sc={sc} />
        <View style={row}>
          <Copy style={{ fontSize: 12.5, lineHeight: 17.5, fontWeight: '600' }}>{scene.org + '\u00a0'}</Copy>
          <Roll variant="fade" style={{ fontSize: 12.5, lineHeight: 17.5, fontWeight: '600' }}>
            {p.plan}
          </Roll>
        </View>
      </View>
      <View style={[row, { alignItems: 'baseline', gap: 6 }]}>
        <Roll style={{ fontSize: 24, lineHeight: 33.6, fontWeight: '600', letterSpacing: -0.48 }}>{`$${p.price}`}</Roll>
        <Copy style={{ color: '#7a7a7d' }}>per month</Copy>
      </View>
      {!compact && (
        <View style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,.1)', borderRadius: 8 }}>
          <View style={[row, { height: 34, paddingHorizontal: 10 }]}>
            <Bar w={sc === 0 ? 96 : 82} h={5} tone={3} />
          </View>
          <View style={[row, { height: 34, paddingHorizontal: 10, gap: 8, borderTopWidth: 1, borderTopColor: line }]}>
            <Bar w={22} h={12} r={3} tone={2} />
            <Bar w={70} h={5} tone={3} />
          </View>
        </View>
      )}
      <SceneView
        target={`pay-${sc}`}
        style={{
          height: 36,
          borderRadius: 8,
          backgroundColor: ['paid', 'done'].includes(s.pay[sc]) ? '#1f9d55' : '#5b5bd6',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <States
          value={s.pay[sc]}
          states={{
            idle: <Copy style={{ color: '#fff', fontWeight: '600' }}>Subscribe</Copy>,
            busy: <Spinner size={14} color="#fff" />,
            paid: null,
            done: (
              <View style={[row, { gap: 6 }]}>
                <CheckIcon size={13} color="#fff" strokeWidth={2} />
                <Copy style={{ color: '#fff', fontWeight: '600' }}>Subscribed</Copy>
              </View>
            ),
          }}
        />
      </SceneView>
    </SceneView>
  )
}
function Subscriber({ sc, i, s }: { sc: number; i: number; s: S }) {
  const p = SCENES[sc].pulses[i],
    landed = s.landed[sc] > i
  const opacity = useTween(landed ? 1 : 0, landed ? 450 : 200, { delay: landed ? 50 : 0 })
  return (
    <Collapse open={s.open[sc] > i} reveal="clip">
      <SceneView
        target={`row-${sc}-${i}`}
        style={[row, { height: 42, paddingHorizontal: 4, gap: 10, borderBottomWidth: 1, borderBottomColor: line }]}
      >
        <Animated.View style={{ opacity }}>
          <Avatar
            name={p.name}
            size={22}
            style={{ backgroundColor: sc === 1 ? '#fde9da' : i === 1 ? '#dff1ea' : '#e7e4fb' }}
            textStyle={{
              color: sc === 1 ? '#b05a1c' : i === 1 ? '#23744f' : '#4b45b8',
              fontSize: 10.5,
              fontWeight: '600',
            }}
          />
        </Animated.View>
        <Animated.View style={{ flex: 1, opacity }}>
          <Copy style={{ fontWeight: '500' }}>{p.name}</Copy>
        </Animated.View>
        <Animated.View style={{ width: 44, opacity }}>
          <Copy style={{ color: '#7a7a7d' }}>{p.plan}</Copy>
        </Animated.View>
        <SceneView target={`pill-${sc}-${i}`} style={{ width: 52, alignItems: 'flex-end', opacity: landed ? 1 : 0 }}>
          <Pill amount={p.price} />
        </SceneView>
      </SceneView>
    </Collapse>
  )
}
function Dashboard({ sc, s, compact }: { sc: number; s: S; compact: boolean }) {
  const [amountWidth, setAmountWidth] = useState(0)
  const scene = SCENES[sc],
    active = s.scene === sc
  const opacity = useTween(active ? 1 : 0, 450, { delay: active ? 0 : 100 })
  const mrr = scene.mrr + scene.pulses.slice(0, s.landed[sc]).reduce((t, p) => t + p.price, 0)
  return (
    <SceneView hidden={!active} style={{ position: 'absolute', inset: 0, flexDirection: 'row', opacity }}>
      {!compact && (
        <View
          style={{
            width: 150,
            paddingVertical: 16,
            paddingHorizontal: 10,
            gap: 4,
            backgroundColor: '#f6f5f4',
            borderRightWidth: 1,
            borderRightColor: line,
          }}
        >
          <View style={[row, { gap: 8, height: 26, marginBottom: 10, paddingHorizontal: 6 }]}>
            <Tile sc={sc} />
            <Copy style={{ fontSize: 12.5, fontWeight: '600' }}>{scene.org}</Copy>
          </View>
          {[46, 58, 40, 52].map((w, i) => (
            <View
              key={i}
              style={[
                row,
                {
                  gap: 8,
                  height: 26,
                  paddingHorizontal: 6,
                  borderRadius: 6,
                  backgroundColor: i === 1 ? line : 'transparent',
                },
              ]}
            >
              <Bar w={10} h={10} r={3} tone={i === 1 ? 4 : 3} />
              <Bar w={w} h={5} tone={i === 1 ? 4 : 2} />
            </View>
          ))}
        </View>
      )}
      <View
        style={{
          flex: 1,
          // The original grid keeps its chart + tabular amount min-content width.
          minWidth: compact ? undefined : Math.max(410, amountWidth + 320),
          paddingVertical: compact ? 16 : 18,
          paddingLeft: compact ? 18 : 22,
          paddingRight: compact ? 42 : 58,
        }}
      >
        <View style={[row, { justifyContent: 'space-between', marginBottom: 14 }]}>
          <View style={[row, { gap: 8 }]}>
            {compact && <Tile sc={sc} />}
            <Copy style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', letterSpacing: -0.15 }}>Subscriptions</Copy>
          </View>
          <Bar w={56} h={22} r={6} tone={2} />
        </View>
        <View
          style={[
            row,
            {
              justifyContent: 'space-between',
              gap: 16,
              paddingVertical: 14,
              paddingHorizontal: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: line,
              borderRadius: 10,
            },
          ]}
        >
          <View style={{ gap: 2 }} onLayout={(event) => setAmountWidth(event.nativeEvent.layout.width)}>
            <Copy style={{ color: '#7a7a7d' }}>MRR</Copy>
            <Count
              value={mrr}
              duration={900}
              format={money}
              style={{ fontSize: 26, lineHeight: 36.4, fontWeight: '600', letterSpacing: -0.52 }}
            />
          </View>
          <Chart data={[...scene.history.slice(0, -1), mrr / 1000]} width={compact ? 110 : 190} height={52} />
        </View>
        <SceneView target={`list-${sc}`}>
          {scene.pulses
            .map((_, i) => i)
            .reverse()
            .map((i) => (
              <Subscriber key={i} sc={sc} i={i} s={s} />
            ))}
          {old.map((r, i) => (
            <View
              key={i}
              style={[
                row,
                { gap: 10, height: 42, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: line },
              ]}
            >
              <Bar w={22} h={22} r={11} tone={2} />
              <Bar w={r.name} h={5} tone={3} />
              <Bar w={r.amount} h={5} tone={2} style={{ marginLeft: 'auto' }} />
            </View>
          ))}
        </SceneView>
      </View>
    </SceneView>
  )
}
export default function Subscriptions({ poster, ...props }: ExampleProps) {
  const id = useId().replace(/[^a-z0-9]/gi, '')
  return (
    <Stage<S>
      width={720}
      height={440}
      compact={{ below: 600, width: 358, height: 460 }}
      initial={START}
      poster={POSTER}
      script={script}
      reducedMotion={poster}
      tokens={{ background: '#f5f6fa', accent: '#5b5bd6', accentSoft: 'rgba(91,91,214,.1)' }}
      style={{ borderRadius: 16 }}
      accessibilityLabel="A subscription carries its price into the billing dashboard"
      {...props}
    >
      {(s, _rect, layout) => {
        const compact = layout === 'compact'
        return (
          <>
            <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
              <Defs>
                <RadialGradient id={`${id}a`} cx="0%" cy="100%" rx="55%" ry="70%">
                  <Stop stopColor="#5b5bd6" stopOpacity={0.13} />
                  <Stop offset={0.7} stopColor="#5b5bd6" stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id={`${id}b`} cx="100%" cy="0%" rx="40%" ry="50%">
                  <Stop stopColor="#5b5bd6" stopOpacity={0.07} />
                  <Stop offset={0.7} stopColor="#5b5bd6" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${id}a)`} />
              <Rect width="100%" height="100%" fill={`url(#${id}b)`} />
            </Svg>
            <Window
              url="dashboard.tally.com/subscriptions"
              style={{
                position: 'absolute',
                top: compact ? 24 : 36,
                left: compact ? 48 : 196,
                width: compact ? 334 : 560,
                height: compact ? 460 : 440,
                borderRadius: 10,
                borderWidth: 0,
                boxShadow: heroShadow,
              }}
            >
              <Dashboard sc={0} s={s} compact={compact} />
              <Dashboard sc={1} s={s} compact={compact} />
            </Window>
            <Checkout sc={0} s={s} compact={compact} />
            <Checkout sc={1} s={s} compact={compact} />
            {s.fly && (
              <Fly from={s.fly.from} to={s.fly.to} go={s.fly.go} held duration={900}>
                <Pill amount={SCENES[s.fly.scene].pulses[s.fly.i].price} />
              </Fly>
            )}
          </>
        )
      }}
    </Stage>
  )
}
