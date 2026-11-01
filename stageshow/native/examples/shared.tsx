import { RadialGradient } from '../kit/radial-gradient'
import { useId, type ReactNode } from 'react'
import { Text as RNText, View, type StyleProp, type TextStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useLook } from '../kit'

export interface ExampleProps {
  poster?: boolean
  replay?: number
  visible?: boolean
  onMark?: (name: string) => void
  onError?: (error: unknown) => void
}
export const row = { flexDirection: 'row' as const, alignItems: 'center' as const }
export const heroShadow =
  '0 0 0 1px rgba(0,0,0,.06), 0 30px 60px -12px rgba(50,50,93,.25), 0 18px 36px -18px rgba(0,0,0,.3)'
export const satelliteShadow =
  '0 0 0 1px rgba(0,0,0,.04), 0 14px 32px -8px rgba(50,50,93,.24), 0 4px 10px -4px rgba(0,0,0,.1)'
export function Copy({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { tokens: t } = useLook()
  return (
    <RNText
      numberOfLines={1}
      style={[
        {
          fontFamily: t.fontFamily,
          fontSize: 12,
          lineHeight: 16.8,
          fontWeight: '400',
          color: t.text,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  )
}
/** The original CSS album sleeves expressed as SVG, not replacement imagery. */
export function Sleeve({
  art,
  size,
  cover = false,
  flat = false,
}: {
  art: number
  size: number
  cover?: boolean
  flat?: boolean
}) {
  const id = useId().replace(/[^a-z0-9]/gi, '')
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: flat ? 0 : cover ? 6 : size === 32 ? 6 : 4,
        overflow: 'hidden',
        boxShadow: cover ? 'inset 0 0 0 1px rgba(255,255,255,.08), 0 6px 14px -6px rgba(0,0,0,.6)' : undefined,
      }}
    >
      {cover ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[3, 1, 4, 5].map((a) => (
            <View key={a}>
              <Sleeve art={a} size={size / 2} flat />
            </View>
          ))}
        </View>
      ) : (
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`${id}1`} cx="30%" cy="30%" fx="30%" fy="30%" rx="99%" ry="99%">
              <Stop stopColor="#6a6a6e" />
              <Stop offset={0.7} stopColor="#2a2a2d" />
            </RadialGradient>
            <LinearGradient id={`${id}2`} x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop stopColor="#3c3c40" />
              <Stop offset={1} stopColor="#1f1f22" />
            </LinearGradient>
            <RadialGradient id={`${id}3`} cx="50%" cy="120%" fx="50%" fy="120%" rx="130%" ry="130%">
              <Stop stopColor="#d9d9dc" />
              <Stop offset={0.28} stopColor="#8a8a8e" />
              <Stop offset={0.7} stopColor="#2c2c30" />
            </RadialGradient>
            <LinearGradient id={`${id}4`} x1="0.8" y1="0" x2="0.2" y2="1">
              <Stop stopColor="#55555a" />
              <Stop offset={0.6} stopColor="#232326" />
            </LinearGradient>
            <RadialGradient id={`${id}5`} cx="75%" cy="25%" fx="75%" fy="25%" rx="106%" ry="106%">
              <Stop stopColor="#4a4a4e" />
              <Stop offset={0.65} stopColor="#1d1d20" />
            </RadialGradient>
          </Defs>
          <Rect width={size} height={size} fill={`url(#${id}${art})`} />
          <Rect
            x={0.5}
            y={0.5}
            width={size - 1}
            height={size - 1}
            rx={4}
            fill="none"
            stroke={flat ? 'none' : 'rgba(255,255,255,.06)'}
          />
        </Svg>
      )}
      {cover && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,.08)',
          }}
        />
      )}
    </View>
  )
}

export function FaceGradient({ size, index = 0 }: { size: number; index?: number }) {
  const id = useId().replace(/[^a-z0-9]/gi, '')
  const colors = [
    ['#f2f2f3', '#b9b9bd'],
    ['#8e8e93', '#5a5a5f'],
    ['#5e5e63', '#3a3a3e'],
    ['#3e3e42', '#2a2a2e'],
  ][index]
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id={id} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset={0} stopColor={colors[0]} />
          <Stop offset={1} stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  )
}
