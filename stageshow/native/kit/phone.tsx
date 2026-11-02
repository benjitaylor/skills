import { RadialGradient } from './radial-gradient'
import {
  createContext,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Animated, Image, Text as RNText, View, type ImageSourcePropType, type TextStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Path, Rect, G } from 'react-native-svg'
import { BlurTargetView } from 'expo-blur'
import { Label, SceneView, absolute, type NativeProps } from './native'
import { LookContext, mix, useLook } from './look'
import { Mask } from './mask'
import { superellipsePath, gradientLine } from './phone-geometry'
import { Signal, Wifi, Battery, Flashlight, CameraGlyph } from './phone-glyphs'
import { BlurBackground, Glass, blurIntensity } from './glass'
import { useTween } from './animate'
import { useReducedMotion } from './reduced-motion'
import type { Bezier } from './ease'

export type PhoneFrame = 'pro' | 'photo' | 'bezel' | 'soft' | 'bare' | 'silver' | 'clay' | 'outline' | 'android'
// Screens in points: the iPhone 18 Pro, the illustrative soft phone, a Pixel 8
const SCREENS = {
  ios: { width: 402, height: 874, radius: 64 },
  soft: { width: 393, height: 829, radius: 42 },
  android: { width: 412, height: 915, radius: 38 },
}
// The body past the screen on each side: an outer band and the glass inside it
const FRAMES: Record<PhoneFrame, { band: number; glass: number }> = {
  pro: { band: 3, glass: 10 },
  photo: { band: 0, glass: 16 },
  bezel: { band: 0, glass: 12 },
  soft: { band: 0, glass: 12.5 },
  bare: { band: 0, glass: 0 },
  silver: { band: 4, glass: 9 },
  clay: { band: 0, glass: 16 },
  outline: { band: 0, glass: 8 },
  android: { band: 2, glass: 9 },
}
const EASE: Bezier = [0.25, 0.1, 0.25, 1]
function frameShadow(frame: PhoneFrame, s: number) {
  const pt = (n: number) => `${n * s}px`
  if (frame === 'outline') return undefined
  if (frame === 'clay')
    return `0 ${pt(30)} ${pt(60)} ${pt(-12)} rgba(50,50,93,0.2), 0 ${pt(16)} ${pt(32)} ${pt(-16)} rgba(0,0,0,0.16)`
  if (frame === 'soft')
    return `0 0 0 ${pt(1.5)} rgba(10,37,64,0.05), 0 ${pt(30)} ${pt(60)} ${pt(-12)} rgba(50,50,93,0.18), 0 ${pt(18)} ${pt(36)} ${pt(-18)} rgba(0,0,0,0.12)`
  return `0 ${pt(40)} ${pt(80)} ${pt(-16)} rgba(50,50,93,0.25), 0 ${pt(24)} ${pt(48)} ${pt(-24)} rgba(0,0,0,0.3)`
}

/** The screen a Phone gives the parts inside it, in points: its size, corner radius and whether it is dark. */
export interface PhoneScreen {
  width: number
  height: number
  radius: number
  dark?: boolean
}
export const PhoneContext = createContext<PhoneScreen | null>(null)
// Banners render at the Phone's level, over the status bar and under the island
type Place = (key: string, node: ReactNode | null) => void
const BannerSlot = createContext<Place | null>(null)

export type PhoneBezel = ImageSourcePropType | { light: ImageSourcePropType; dark?: ImageSourcePropType }
export interface PhoneProps extends NativeProps {
  width: number
  frame?: PhoneFrame
  time?: string
  island?: boolean
  /** The Dynamic Island's width in points (web `--ss-island-w`). */
  islandWidth?: number
  /** The Dynamic Island's distance from the screen's top in points (web `--ss-island-top`). */
  islandTop?: number
  status?: boolean
  dark?: boolean
  wallpaper?: string | ImageSourcePropType
  /** The photo frame's product bezel, 450 × 920pt with the screen at (24, 23). Pass `{ light, dark }` for a
   * black one on dark stages and dark phones. */
  bezel?: PhoneBezel
}
export const WALLPAPER = 'stageshow:wallpaper'
function pickBezel(bezel: PhoneBezel | undefined, dark: boolean) {
  if (bezel && typeof bezel === 'object' && !Array.isArray(bezel) && 'light' in bezel)
    return dark ? (bezel.dark ?? bezel.light) : bezel.light
  return bezel
}
export function Phone({
  width,
  frame: asked = 'pro',
  time = '9:41',
  island,
  islandWidth,
  islandTop,
  status,
  dark = false,
  wallpaper,
  bezel,
  children,
  style,
  ...rest
}: PhoneProps) {
  const look = useLook(),
    { fidelity, theme, tokens } = look
  const photo = pickBezel(bezel, theme === 'dark' || dark),
    photoKey = typeof photo === 'object' ? JSON.stringify(photo) : photo
  // Without a bezel image, or when it fails to load, the phone draws the pro frame
  const [failed, setFailed] = useState<unknown>(undefined)
  const frame: PhoneFrame = asked === 'photo' && (photo === undefined || failed === photoKey) ? 'pro' : asked
  const { band, glass } = FRAMES[frame]
  const layout = frame === 'android' ? 'android' : frame === 'soft' ? 'soft' : 'ios'
  const screen = SCREENS[layout],
    ios = layout === 'ios'
  const edge = band + glass,
    s = width / (screen.width + edge * 2),
    bodyW = screen.width + edge * 2,
    bodyH = screen.height + edge * 2
  const chrome = ['pro', 'photo', 'bezel', 'silver', 'android'].includes(frame)
  const showStatus = status ?? chrome,
    showIsland = island ?? (chrome && frame !== 'photo')
  const wallpaperTarget = useRef<View>(null)
  const id = useId().replace(/:/g, '')
  const outline = superellipsePath(screen.width, screen.height, ios ? 71 : screen.radius, ios ? 2.31 : 2)
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${screen.width} ${screen.height}"><path d="${outline}" fill="black"/></svg>`
  // Black titanium on dark stages, and on a dark phone on a glass stage; clay darkens on dark stages only
  const darkBand = theme === 'dark' || (theme === 'glass' && dark),
    darkClay = theme === 'dark'
  const bandColors =
    frame === 'silver'
      ? ['#f4f4f6', '#c9cacf', '#eeeef1', '#b9babf', '#e6e6ea']
      : darkBand
        ? ['#5b5c61', '#2b2c2f', '#48494d', '#232427', '#404145']
        : ['#e3e3e6', '#9a9ba0', '#cfd0d4', '#85868b', '#c9cacd']
  // Each band is a stroke of the screen's outline, [reach from the screen's edge, paint], widest first
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
        : frame === 'bezel'
          ? [[12, '#111113']]
          : frame === 'clay'
            ? [
                [16, `url(#${id}clay)`],
                [1, darkClay ? '#333338' : '#e0dfdc'],
              ]
            : []
  const body = gradientLine(150, bodyW, bodyH),
    sky = gradientLine(172, screen.width, screen.height)
  // The outline frame's ring is a 1px hairline 8pt out, as the web cuts it from a mask
  const ring = 8 - 0.5 / s
  const [banners, setBanners] = useState<ReadonlyMap<string, ReactNode>>(() => new Map())
  const place = useCallback<Place>(
    (key, node) =>
      setBanners((old) => {
        if (node === null ? !old.has(key) : old.get(key) === node) return old
        const next = new Map(old)
        if (node === null) next.delete(key)
        else next.set(key, node)
        return next
      }),
    [],
  )
  const context = useMemo<PhoneScreen>(() => ({ ...screen, dark }), [screen, dark])
  // The screen's own type: iOS sizes, black on white (white on a dark phone)
  const screenLook = useMemo(
    () => ({ ...look, tokens: { ...look.tokens, fontSize: 15, text: dark ? '#fff' : '#000' } }),
    [look, dark],
  )
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
          height: bodyH * s,
          borderRadius: (screen.radius + edge) * s,
          boxShadow: frameShadow(frame, s),
        },
        style,
      ]}
    >
      <View
        style={{
          width: bodyW,
          height: bodyH,
          transform: [{ scale: s }],
          transformOrigin: 'top left',
          padding: edge,
        }}
      >
        <Svg pointerEvents="none" style={absolute} width={bodyW} height={bodyH}>
          <Defs>
            <LinearGradient id={`${id}band`} x1="0.2" y1="0" x2="0.8" y2="1">
              {bandColors.map((paint, i) => (
                <Stop key={i} offset={[0, 0.22, 0.48, 0.74, 1][i]} stopColor={paint} />
              ))}
            </LinearGradient>
            <LinearGradient id={`${id}clay`} x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={darkClay ? mix('#2a2a2e', '#ffffff', 0.94) : mix('#ecebe8', '#ffffff', 0.55)}
              />
              <Stop offset="1" stopColor={darkClay ? '#2a2a2e' : mix('#ecebe8', '#000000', 0.94)} />
            </LinearGradient>
            <LinearGradient id={`${id}android`} gradientUnits="userSpaceOnUse" {...body}>
              <Stop offset="0" stopColor="#3a3b3f" />
              <Stop offset="0.4" stopColor="#1d1e21" />
              <Stop offset="0.7" stopColor="#2f3034" />
              <Stop offset="1" stopColor="#1a1b1e" />
            </LinearGradient>
          </Defs>
          {frame === 'android' && (
            <>
              <Rect width={bodyW} height={bodyH} rx={screen.radius + edge} fill={`url(#${id}android)`} />
              <Rect
                x={band}
                y={band}
                width={bodyW - band * 2}
                height={bodyH - band * 2}
                rx={screen.radius + glass}
                fill="#050505"
              />
            </>
          )}
          <G transform={`translate(${edge} ${edge})`}>
            {bands.map(([reach, paint]) => (
              <Path key={reach} d={outline} fill="none" stroke={paint} strokeWidth={reach * 2} />
            ))}
            {frame === 'outline' && (
              <>
                <Path
                  d={superellipsePath(screen.width + ring * 2, screen.height + ring * 2, 71 + ring, 2.31)}
                  transform={`translate(${-ring} ${-ring})`}
                  fill="none"
                  stroke={theme === 'blueprint' ? tokens.border : tokens.textFaint}
                  strokeWidth={1 / s}
                />
                <Path d={outline} fill="none" stroke={tokens.border} strokeWidth={2 / s} />
              </>
            )}
          </G>
        </Svg>
        {frame === 'soft' && (
          // A pale, even band, shaded along its inner bottom edge as if lit from above
          <View
            pointerEvents="none"
            style={[
              absolute,
              {
                borderRadius: screen.radius + glass,
                backgroundColor: theme === 'dark' ? '#1c2433' : '#f6f9fc',
                boxShadow: `inset 0 -2.9px 7.2px ${theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(10,37,64,0.22)'}`,
              },
            ]}
          />
        )}
        <Mask xml={mask} style={{ width: screen.width, height: screen.height }}>
          <View style={{ width: screen.width, height: screen.height, backgroundColor: dark ? '#000' : '#fff' }}>
            <BlurTargetView ref={wallpaperTarget} style={absolute}>
              {wallpaper === WALLPAPER ? (
                <Svg style={absolute} width={screen.width} height={screen.height}>
                  <Defs>
                    <LinearGradient id={id} gradientUnits="userSpaceOnUse" {...sky}>
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
              <PhoneContext.Provider value={context}>
                <LookContext.Provider value={screenLook}>
                  <BannerSlot.Provider value={place}>
                    <View
                      style={{
                        flex: 1,
                        paddingTop: showStatus ? (layout === 'android' ? 48 : 62) : 44,
                        // With no frame the screen's edge is the object's edge: a wider margin
                        paddingHorizontal: frame === 'bare' ? 8 : 0,
                      }}
                    >
                      {children}
                    </View>
                  </BannerSlot.Provider>
                  {showStatus && <StatusBar layout={layout} time={time} dark={dark} minimal={fidelity === 'minimal'} />}
                  {[...banners].map(([key, node]) => (
                    <Fragment key={key}>{node}</Fragment>
                  ))}
                  {showIsland && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        alignSelf: 'center',
                        top: layout === 'android' ? 14 : (islandTop ?? 14),
                        width: layout === 'android' ? 24 : (islandWidth ?? 95),
                        height: layout === 'android' ? 24 : 37,
                        borderRadius: layout === 'android' ? 12 : 18.5,
                        backgroundColor: '#000',
                      }}
                    />
                  )}
                  {chrome && <HomeIndicator dark={dark} android={layout === 'android'} />}
                </LookContext.Provider>
              </PhoneContext.Provider>
            </BlurBackground.Provider>
          </View>
        </Mask>
        {frame === 'photo' && photo !== undefined && (
          // Laid over the body so its cut-out frames the screen exactly
          <Image
            source={photo}
            onError={() => setFailed(photoKey)}
            resizeMode="stretch"
            style={{ position: 'absolute', left: -8, top: -7, width: 450, height: 920 }}
          />
        )}
      </View>
    </SceneView>
  )
}
// SF Pro's ascent and line height per point, to set a placeholder on the time's baseline
const ASCENT = 0.952,
  LINE = 1.193
function StatusInk({
  layout,
  time,
  color,
  minimal,
}: {
  layout: 'ios' | 'android' | 'soft'
  time: string
  color: string
  minimal: boolean
}) {
  const size = layout === 'android' ? 15 : 17.67,
    line = layout === 'ios' ? 22 : size * LINE
  const text: TextStyle =
    layout === 'android'
      ? { color, fontSize: 15, fontWeight: '500' }
      : // iOS sets the time in SF Pro Text at 590
        { color, fontSize: 17.67, fontWeight: '600', letterSpacing: 0 }
  // Minimal fidelity: the time is a placeholder bar like any other word, on its baseline
  const clock = minimal ? (
    <View style={{ height: line }}>
      <View
        style={{
          marginTop: (line - size * LINE) / 2 + size * ASCENT - 7,
          width: 30,
          height: 7,
          borderRadius: 4,
          backgroundColor: color,
          opacity: 0.5,
        }}
      />
    </View>
  ) : (
    <RNText style={[text, layout === 'ios' && { lineHeight: 22, textAlign: 'center' }]}>{time}</RNText>
  )
  if (layout === 'ios')
    // Apple's iOS 27 UI kit layout: the time centred in the first 138.5pt, its 22pt line from y 21.5;
    // signal, wifi and battery from x 285.25, 8 apart, their tops at 26.33, 25.33 and 25.67
    return (
      <>
        <View style={{ position: 'absolute', left: 0, top: 21.5, width: 138.5, alignItems: 'center' }}>{clock}</View>
        <View
          style={{
            position: 'absolute',
            left: 285.25,
            top: 25.33,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <View style={{ marginTop: 1 }}>
            <Signal color={color} />
          </View>
          <Wifi color={color} />
          <View style={{ marginTop: 0.33 }}>
            <Battery color={color} />
          </View>
        </View>
      </>
    )
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: layout === 'android' ? 26 : 52,
        paddingRight: layout === 'android' ? 26 : 34,
      }}
    >
      {clock}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Signal color={color} />
        <Wifi color={color} />
        <Battery color={color} />
      </View>
    </View>
  )
}
/** Light to dark content fades, never cuts, when the phone's `dark` changes. */
function StatusBar({
  layout,
  time,
  dark,
  minimal,
}: {
  layout: 'ios' | 'android' | 'soft'
  time: string
  dark: boolean
  minimal: boolean
}) {
  const fade = useTween(dark ? 1 : 0, 300, { ease: EASE })
  const height = layout === 'ios' ? 62 : layout === 'android' ? 48 : 54
  return (
    <>
      {(['#000', '#fff'] as const).map((color) => {
        const shown = (color === '#fff') === dark
        return (
          <Animated.View
            key={color}
            pointerEvents="none"
            accessibilityElementsHidden={!shown}
            importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height,
              opacity: color === '#fff' ? fade : Animated.subtract(1, fade),
            }}
          >
            <StatusInk layout={layout} time={time} color={color} minimal={minimal} />
          </Animated.View>
        )
      })}
    </>
  )
}
function HomeIndicator({ dark, android }: { dark: boolean; android: boolean }) {
  const fade = useTween(dark ? 1 : 0, 300, { ease: EASE })
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 8,
        alignSelf: 'center',
        width: android ? 108 : 144,
        height: android ? 4 : 5,
        borderRadius: 2.5,
        backgroundColor: fade.interpolate({ inputRange: [0, 1], outputRange: ['#000', '#fff'] }),
      }}
    />
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
/** The lock screen's frosted buttons: a dim, blurred disc with a white glyph. */
function Disc({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Glass tint="default" intensity={blurIntensity(24)} style={absolute} />
      <View style={[absolute, { backgroundColor: 'rgba(10,12,24,0.26)' }]} />
      {children}
    </View>
  )
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
  // Notifications stack at the bottom as iOS does; under the clock for a cropped or satellite phone;
  // just under the status bar, where Notification Center sits, with the clock off
  const at = size === 'satellite' ? { top: clock ? 232 : 74 } : stack === 'top' ? { top: 290 } : { bottom: 118 }
  return (
    // The whole screen, status bar's room included
    <SceneView {...rest} style={[absolute, style]}>
      {clock && (
        <>
          <Label
            style={{
              marginTop: 66,
              color: '#fff',
              textAlign: 'center',
              fontSize: 22,
              fontWeight: '600',
              letterSpacing: -0.22,
              opacity: 0.85,
            }}
          >
            {date}
          </Label>
          <Label
            style={{
              marginTop: -4,
              color: '#fff',
              textAlign: 'center',
              fontSize: 112,
              lineHeight: 112,
              fontWeight: '700',
              letterSpacing: -3.92,
              fontVariant: ['tabular-nums'],
              opacity: 0.92,
            }}
          >
            {time}
          </Label>
        </>
      )}
      <View style={{ position: 'absolute', left: 0, right: 0, gap: 8, ...at }}>{children}</View>
      {controls && size === 'full' && (
        <View
          style={{
            position: 'absolute',
            left: 46,
            right: 46,
            bottom: 48,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Disc>
            <Flashlight color="#fff" />
          </Disc>
          <Disc>
            <CameraGlyph color="#fff" />
          </Disc>
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
// 15pt type on 18pt lines, as iOS sets a banner
const NOTE: TextStyle = { fontSize: 15, lineHeight: 18, letterSpacing: -0.24, color: '#000' }
function NotificationCard({ icon, title, body, time = 'now', banner, style, ...rest }: NotificationProps) {
  const phone = useContext(PhoneContext),
    look = useLook(),
    reduced = useReducedMotion()
  // On a light screen frosted white on white vanishes: the banner takes its own edge
  const lit = !!phone && !phone.dark
  // Unlocked, it drops in at the top from above
  const drop = useTween(0, 520, { from: banner && !reduced ? -110 : 0, ease: [0.2, 0.9, 0.25, 1] })
  const onAccent = useMemo(() => ({ ...look, tokens: { ...look.tokens, text: '#fff' } }), [look])
  const image = isValidElement(icon) && icon.type === Image
  return (
    <SceneView
      {...rest}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          marginHorizontal: 18,
          paddingTop: 14,
          paddingRight: 17,
          paddingBottom: 14,
          paddingLeft: 14,
          borderRadius: 23,
          boxShadow: lit ? '0 0 0 0.5px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)' : '0 4px 24px rgba(0,0,0,0.06)',
        },
        banner && { position: 'absolute', top: 56, left: 0, right: 0, zIndex: 2, transform: [{ translateY: drop }] },
        style,
      ]}
    >
      {/* Only the glass is clipped, so the card's shadow shows */}
      <View pointerEvents="none" style={[absolute, { borderRadius: 23, overflow: 'hidden' }]}>
        <Glass tint="light" intensity={blurIntensity(30)} style={absolute} />
        <View style={[absolute, { backgroundColor: lit ? 'rgba(255,255,255,0.92)' : 'rgba(252,252,253,0.76)' }]} />
      </View>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          overflow: 'hidden',
          // A real app icon is the whole tile, its own corners included
          backgroundColor: image ? undefined : look.tokens.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LookContext.Provider value={onAccent}>{icon}</LookContext.Provider>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Label lines={1} style={[NOTE, { flex: 1, fontWeight: '600' }]}>
            {title}
          </Label>
          <Label
            style={{ flexShrink: 0, fontSize: 12, lineHeight: 18, letterSpacing: -0.06, color: 'rgba(60,60,67,0.6)' }}
          >
            {time}
          </Label>
        </View>
        {body && (
          <Label lines={3} style={NOTE}>
            {body}
          </Label>
        )}
      </View>
    </SceneView>
  )
}
/**
 * An iOS notification, native width (the screen less 18pt each side). On a LockScreen it stacks with the others;
 * with `banner` the phone is unlocked and it drops in at the top of the screen, over the status bar and under the
 * island.
 */
export function Notification(props: NotificationProps) {
  const place = useContext(BannerSlot),
    key = useId()
  const slotted = !!props.banner && !!place
  useLayoutEffect(() => {
    place?.(key, slotted ? <NotificationCard key={key} {...props} /> : null)
  })
  useLayoutEffect(() => () => place?.(key, null), [place, key])
  return slotted ? null : <NotificationCard {...props} />
}
