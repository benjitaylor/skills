import { RadialGradient } from './radial-gradient'
import { createContext, useId, useEffect, useRef, useState, type ReactNode } from 'react'
import { Image, View, type ImageSourcePropType } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Path, Rect, Circle, G } from 'react-native-svg'
import { Label, SceneView, row, absolute, type NativeProps } from './native'
import { useLook } from './look'
import { Mask } from './mask'
import { superellipsePath } from './phone-geometry'
import { Signal, Wifi, Battery } from './phone-glyphs'
import { BlurTargetView } from 'expo-blur'
import { BlurBackground } from './glass'
import { Glass } from './glass'

export type PhoneFrame = 'pro' | 'photo' | 'bezel' | 'soft' | 'bare' | 'silver' | 'clay' | 'outline' | 'android'
const dimensions = {
  ios: { width: 402, height: 874, radius: 64 },
  soft: { width: 393, height: 829, radius: 42 },
  android: { width: 412, height: 915, radius: 38 },
}
const edges: Record<PhoneFrame, number> = {
  pro: 13,
  photo: 16,
  bezel: 12,
  soft: 12.5,
  bare: 0,
  silver: 13,
  clay: 16,
  outline: 8,
  android: 11,
}
const fShadow = (scale: number) =>
  `0 ${40 * scale}px ${80 * scale}px ${-16 * scale}px rgba(50,50,93,.25), 0 ${24 * scale}px ${48 * scale}px ${-24 * scale}px rgba(0,0,0,.3)`
export const PhoneContext = createContext<{ width: number; height: number; radius: number } | null>(null)
export interface PhoneProps extends NativeProps {
  width: number
  frame?: PhoneFrame
  time?: string
  island?: boolean
  status?: boolean
  dark?: boolean
  wallpaper?: string | ImageSourcePropType
  bezel?: ImageSourcePropType
}
export const WALLPAPER = 'stageshow:wallpaper'
export function Phone({
  width,
  frame: asked = 'pro',
  time = '9:41',
  island,
  status,
  dark,
  wallpaper,
  bezel,
  children,
  style,
  ...rest
}: PhoneProps) {
  const { fidelity, theme } = useLook(),
    [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [bezel])
  const wallpaperTarget = useRef<View>(null)
  const frame = asked === 'photo' && (!bezel || failed) ? 'pro' : asked
  const screen = dimensions[frame === 'android' ? 'android' : frame === 'soft' ? 'soft' : 'ios']
  const edge = edges[frame],
    scale = width / (screen.width + edge * 2),
    totalH = screen.height + edge * 2
  const chrome = ['pro', 'photo', 'bezel', 'silver', 'android'].includes(frame)
  const showStatus = status ?? chrome,
    showIsland = island ?? (chrome && frame !== 'photo'),
    color = dark ? '#fff' : '#111'
  const id = useId().replace(/:/g, '')
  const ios = frame !== 'soft' && frame !== 'android'
  const outline = superellipsePath(screen.width, screen.height, ios ? 71 : screen.radius, ios ? 2.31 : 2)
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${screen.width} ${screen.height}"><path d="${outline}" fill="black"/></svg>`
  const darkBand = theme === 'dark' || (theme === 'glass' && dark)
  const bandColors =
    frame === 'silver'
      ? ['#f4f4f6', '#c9cacf', '#eeeef1', '#b9babf', '#e6e6ea']
      : darkBand
        ? ['#5b5c61', '#2b2c2f', '#48494d', '#232427', '#404145']
        : ['#e3e3e6', '#9a9ba0', '#cfd0d4', '#85868b', '#c9cacd']
  const bands: [number, string][] =
    frame === 'pro'
      ? [
          [13, `url(#${id}band)`],
          [10, '#2c2c2d'],
          [9.25, '#0b0b0c'],
        ]
      : frame === 'silver'
        ? [
            [13, `url(#${id}band)`],
            [9, '#0b0b0c'],
          ]
        : frame === 'clay'
          ? [
              [16, `url(#${id}clay)`],
              [1, darkBand ? '#333338' : '#e0dfdc'],
            ]
          : frame === 'bare' || frame === 'outline'
            ? []
            : [[edge, frame === 'soft' ? '#fafafa' : '#111113']]
  return (
    <SceneView
      {...rest}
      // Rasterize at the phone's displayed bounds, after its internal scale. On
      // iOS this uses the device display scale and prevents a nested Stage scale
      // from reusing a low-resolution intermediate surface for text and SVG.
      shouldRasterizeIOS={rest.shouldRasterizeIOS ?? true}
      style={[
        {
          width,
          height: totalH * scale,
          borderRadius: (screen.radius + edge) * scale,
          boxShadow: frame === 'outline' || frame === 'bare' ? undefined : fShadow(scale),
        },
        style,
      ]}
    >
      <View
        style={{
          width: screen.width + edge * 2,
          height: totalH,
          transform: [{ scale }],
          transformOrigin: 'top left',
          padding: edge,
        }}
      >
        <Svg pointerEvents="none" style={absolute} width={screen.width + edge * 2} height={totalH}>
          <Defs>
            <LinearGradient id={`${id}band`} x1="0.2" y1="0" x2="0.8" y2="1">
              {bandColors.map((paint, i) => (
                <Stop key={i} offset={[0, 0.22, 0.48, 0.74, 1][i]} stopColor={paint} />
              ))}
            </LinearGradient>
            <LinearGradient id={`${id}clay`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={darkBand ? '#37373a' : '#f5f4f2'} />
              <Stop offset="1" stopColor={darkBand ? '#2a2a2e' : '#deddd9'} />
            </LinearGradient>
          </Defs>
          <G transform={`translate(${edge} ${edge})`}>
            {bands.map(([reach, paint]) => (
              <Path key={reach} d={outline} fill="none" stroke={paint} strokeWidth={reach * 2} />
            ))}
            {frame === 'outline' && (
              <Path
                d={superellipsePath(screen.width + 14, screen.height + 14, 78, 2.31)}
                transform="translate(-7 -7)"
                fill="none"
                stroke="#9a9a9d"
                strokeWidth={1 / scale}
              />
            )}
          </G>
        </Svg>
        <Mask xml={mask} style={{ width: screen.width, height: screen.height }}>
          <View style={{ width: screen.width, height: screen.height, backgroundColor: dark ? '#08090b' : '#fff' }}>
            <BlurTargetView ref={wallpaperTarget} style={absolute}>
              {wallpaper === WALLPAPER ? (
                <Svg style={absolute} width={screen.width} height={screen.height}>
                  <Defs>
                    <LinearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
                      <Stop offset="0" stopColor="#8ea9d6" />
                      <Stop offset={0.5} stopColor="#9aa1d4" />
                      <Stop offset="1" stopColor="#aca3cf" />
                    </LinearGradient>
                    <RadialGradient id={`${id}light`} cx="25%" cy="0%" rx="120%" ry="70%">
                      <Stop offset="0" stopColor="#fff" stopOpacity={0.3} />
                      <Stop offset={0.65} stopColor="#fff" stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill={`url(#${id})`} />
                  <Rect width="100%" height="100%" fill={`url(#${id}light)`} />
                </Svg>
              ) : typeof wallpaper === 'object' || typeof wallpaper === 'number' ? (
                <Image source={wallpaper} style={absolute} />
              ) : wallpaper ? (
                <View style={[absolute, { backgroundColor: wallpaper }]} />
              ) : null}
            </BlurTargetView>
            <BlurBackground.Provider value={wallpaperTarget}>
              <PhoneContext.Provider value={screen}>
                <View style={{ flex: 1, paddingTop: showStatus ? 62 : 44, paddingBottom: 0 }}>{children}</View>
              </PhoneContext.Provider>
            </BlurBackground.Provider>
            {showStatus && (
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 62 }}>
                <View style={{ position: 'absolute', left: 0, top: 21.5, width: 138.5, alignItems: 'center' }}>
                  {fidelity === 'minimal' ? (
                    <View style={{ width: 35, height: 7, borderRadius: 4, backgroundColor: color }} />
                  ) : (
                    <Label style={{ color, fontSize: 17, lineHeight: 22, fontWeight: '600' }}>{time}</Label>
                  )}
                </View>
                <View style={[row, { position: 'absolute', left: screen.width - 116.75, top: 25.33, gap: 8 }]}>
                  <Signal color={color} />
                  <Wifi color={color} />
                  <Battery color={color} />
                </View>
              </View>
            )}
            {showIsland && (
              <View
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  top: 14,
                  width: frame === 'android' ? 24 : 95,
                  height: frame === 'android' ? 24 : 37,
                  borderRadius: 20,
                  backgroundColor: '#000',
                }}
              />
            )}
            {chrome && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 8,
                  alignSelf: 'center',
                  width: 144,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: color,
                }}
              />
            )}
          </View>
        </Mask>
        {frame === 'photo' && bezel && (
          <Image source={bezel} onError={() => setFailed(true)} style={absolute} resizeMode="stretch" />
        )}
      </View>
    </SceneView>
  )
}
export interface LockScreenProps extends NativeProps {
  date?: string
  time?: string
  controls?: boolean
  stack?: 'bottom' | 'top'
  size?: 'full' | 'satellite'
  clock?: boolean
}
export function LockScreen({
  date = 'Tuesday, October 21',
  time = '9:41',
  controls = true,
  stack = 'bottom',
  size = 'full',
  clock = true,
  style,
  children,
  ...rest
}: LockScreenProps) {
  return (
    <SceneView {...rest} style={[{ flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 }, style]}>
      {clock && (
        <>
          <Label style={{ color: '#fff', textAlign: 'center', fontSize: 21, fontWeight: '500' }}>{date}</Label>
          <Label
            style={{
              color: '#fff',
              fontSize: 94,
              lineHeight: 112,
              letterSpacing: -5,
              textAlign: 'center',
              fontWeight: '600',
            }}
          >
            {time}
          </Label>
        </>
      )}
      <View style={{ gap: 8, marginTop: stack === 'bottom' && size !== 'satellite' ? 'auto' : 18 }}>{children}</View>
      {controls && size === 'full' && (
        <View style={[row, { justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 28 }]}>
          {['flash', 'camera'].map((name) => (
            <View
              key={name}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: 'rgba(30,35,60,.25)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24">
                {name === 'flash' ? (
                  <Path
                    d="M7.6 1.6h8.8a1.6 1.6 0 0 1 1.6 1.6v1.9H6V3.2a1.6 1.6 0 0 1 1.6-1.6ZM6 6h12l-2.6 4v10.4a2 2 0 0 1-2 2h-2.8a2 2 0 0 1-2-2V10Z"
                    fill="#fff"
                  />
                ) : (
                  <G fill="#fff">
                    <Rect x={2} y={7} width={20} height={14} rx={3} />
                    <Rect x={8} y={4} width={8} height={5} rx={2} />
                    <Circle cx={12} cy={14} r={4} fill="#71748c" />
                  </G>
                )}
              </Svg>
            </View>
          ))}
        </View>
      )}
    </SceneView>
  )
}
export interface NotificationProps extends NativeProps {
  icon?: ReactNode
  title: ReactNode
  body?: ReactNode
  time?: string
  banner?: boolean
}
export function Notification({ icon, title, body, time = 'now', banner, style, ...rest }: NotificationProps) {
  return (
    <SceneView
      {...rest}
      style={[
        row,
        {
          gap: 10,
          padding: 14,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,.62)',
          minHeight: 76,
        },
        banner && { position: 'absolute', left: 18, right: 18, top: 6, zIndex: 50 },
        style,
      ]}
    >
      <Glass tint="light" intensity={45} style={absolute} />
      {icon && <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={[row, { justifyContent: 'space-between', gap: 6 }]}>
          <Label lines={1} style={{ color: '#151519', fontSize: 15, fontWeight: '600', flexShrink: 1 }}>
            {title}
          </Label>
          <Label style={{ color: '#66666c', fontSize: 12 }}>{time}</Label>
        </View>
        {body && (
          <Label lines={3} style={{ color: '#29292d', fontSize: 15, lineHeight: 19 }}>
            {body}
          </Label>
        )}
      </View>
    </SceneView>
  )
}
