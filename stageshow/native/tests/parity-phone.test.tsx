import React from 'react'
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { Animated, Image, StyleSheet, Text as RNText, View, type LayoutRectangle } from 'react-native'
import { Path, Rect } from 'react-native-svg'
import { clock, installVirtualClock } from '../kit/clock'
import { bezier, type Bezier } from '../kit/ease'
import { MotionContext } from '../kit/reduced-motion'
import { LookContext, resolveTokens, useLook, type Look, type Theme } from '../kit/look'
import { SceneContext, SceneView } from '../kit/native'
import { Registry } from '../kit/registry'
import { Phone, PhoneContext, LockScreen, Notification, type PhoneScreen } from '../kit/phone'
import { Keyboard } from '../kit/ios'
import { Thread, Bubble, Stamp, Receipt } from '../kit/messages'
import { gradientLine } from '../kit/phone-geometry'

// Phones, iOS surfaces, messages and the keyboard against phone.css, ios.css and messages.css:
// geometry in points, colours, and motion stepped on the virtual clock.
const EASE: Bezier = [0.25, 0.1, 0.25, 1]
const GROW: Bezier = [0.22, 1, 0.36, 1]
const SCROLL: Bezier = [0.25, 1, 0.5, 1]
const moving = { still: false, active: true, instant: false, speed: 1 }
let tree: ReactTestRenderer | undefined
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount())
  tree = undefined
  clock.recording?.restore()
})
const look = (theme: Theme = 'light'): Look => ({
  theme,
  palette: 'accent',
  fidelity: 'standard',
  layout: 'wide',
  tokens: resolveTokens(theme, 'accent'),
})
const scene = (registry = new Registry()) => ({ registry, root: { current: null }, width: 360, height: 640, scale: 1 })
const staged = (node: React.ReactElement, theme: Theme = 'light', s = scene()) => (
  <LookContext.Provider value={look(theme)}>
    <SceneContext.Provider value={s}>
      <MotionContext.Provider value={moving}>{node}</MotionContext.Provider>
    </SceneContext.Provider>
  </LookContext.Provider>
)
async function render(node: React.ReactElement) {
  await act(async () => {
    tree = TestRenderer.create(node)
  })
  return tree!
}
const flat = (node: ReactTestInstance) => (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>
const read = (v: unknown) =>
  v !== null && typeof v === 'object' && '__getValue' in v ? (v as { __getValue(): unknown }).__getValue() : v
const num = (v: unknown) => read(v) as number
const transform = (node: ReactTestInstance, key: string) =>
  num((flat(node).transform as Record<string, unknown>[]).find((t) => key in t)![key])
const lay = (node: ReactTestInstance, layout: Partial<LayoutRectangle>) =>
  act(async () => node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0, ...layout } } }))
const at = (curve: Bezier, t: number) => bezier(curve)(t)
// A bubble's tail: the layer scaled about a point near its corner
const tails = (node: ReactTestInstance) =>
  node.findAll((n) => n.type === Animated.View && String(flat(n).transformOrigin).includes('%'))
const views = (root: ReactTestInstance, test: (style: Record<string, unknown>) => boolean) =>
  root.findAll((n) => (n.type === View || n.type === Animated.View) && test(flat(n)))
const texts = (root: ReactTestInstance, text: string) =>
  root.findAll((n) => (n.type === RNText || n.type === Animated.Text) && n.props.children === text)
const scenes = (root: ReactTestInstance, target: string) =>
  root.findAll((n) => n.type === SceneView && n.props.target === target)
// A pro phone at true points: 402 wide plus a 13pt edge each side
const W = 428

describe('Phone', () => {
  it('exposes the screen, its corner radius and dark, and sets the screen type in points', async () => {
    let screen: PhoneScreen | null = null,
      inside: Look | undefined
    function Probe() {
      screen = React.useContext(PhoneContext)
      inside = useLook()
      return null
    }
    const r = await render(staged(<Phone width={W} dark children={<Probe />} />))
    expect(screen).toEqual({ width: 402, height: 874, radius: 64, dark: true })
    expect(inside?.tokens).toMatchObject({ fontSize: 15, text: '#fff' })
    await act(async () => r.update(staged(<Phone width={W} frame="android" children={<Probe />} />)))
    expect(screen).toEqual({ width: 412, height: 915, radius: 38, dark: false })
    expect(inside?.tokens.text).toBe('#000')
  })

  it('pads content below the status bar, 48 on android, 44 without one, and 8 at the sides when bare', async () => {
    const content = (r: ReactTestRenderer) => views(r.root, (s) => s.flex === 1 && typeof s.paddingTop === 'number')[0]
    const r = await render(staged(<Phone width={W} />))
    expect(flat(content(r))).toMatchObject({ paddingTop: 62, paddingHorizontal: 0 })
    await act(async () => r.update(staged(<Phone width={W} frame="android" />)))
    expect(flat(content(r))).toMatchObject({ paddingTop: 48 })
    await act(async () => r.update(staged(<Phone width={W} frame="bare" />)))
    expect(flat(content(r))).toMatchObject({ paddingTop: 44, paddingHorizontal: 8 })
  })

  it('draws the island, home indicator and dark screen at web size', async () => {
    const r = await render(staged(<Phone width={W} dark islandWidth={126} islandTop={11} />))
    expect(views(r.root, (s) => s.backgroundColor === '#000' && s.width === 126)[0].props.style).toMatchObject({
      top: 11,
      height: 37,
      borderRadius: 18.5,
    })
    expect(views(r.root, (s) => s.width === 402 && s.height === 874)[0].props.style.backgroundColor).toBe('#000')
    const home = views(r.root, (s) => s.bottom === 8 && s.width === 144)[0]
    expect(flat(home)).toMatchObject({ height: 5, borderRadius: 2.5 })
    expect(read(flat(home).backgroundColor)).toBe('rgba(255, 255, 255, 1)')
    await act(async () => r.update(staged(<Phone width={W} frame="android" />)))
    expect(views(r.root, (s) => s.bottom === 8 && s.width === 108)[0].props.style).toMatchObject({ height: 4 })
    expect(views(r.root, (s) => s.backgroundColor === '#000' && s.width === 24)[0].props.style).toMatchObject({
      top: 14,
      borderRadius: 12,
    })
  })

  it('lays out the status bar per frame and fades its ink when dark changes', async () => {
    const c = installVirtualClock()
    const r = await render(staged(<Phone width={W} />))
    // iOS: the time centred in the first 138.5pt from y 21.5; glyphs from x 285.25 aligned to their tops
    expect(texts(r.root, '9:41')[0].props.style).toContainEqual({ lineHeight: 22, textAlign: 'center' })
    expect(flat(texts(r.root, '9:41')[0])).toMatchObject({ fontSize: 17.67, color: '#000' })
    expect(views(r.root, (s) => s.left === 285.25)[0].props.style).toMatchObject({
      top: 25.33,
      alignItems: 'flex-start',
    })
    const layer = (color: string) =>
      r.root.findAll(
        (n) =>
          n.type === Animated.View &&
          flat(n).height === 62 &&
          n.findAll((t) => t.type === RNText && flat(t).color === color).length > 0,
      )[0]
    expect(num(flat(layer('#fff')).opacity)).toBe(0)
    await act(async () => r.update(staged(<Phone width={W} dark />)))
    await act(async () => c.advance(150))
    expect(num(flat(layer('#fff')).opacity)).toBeCloseTo(at(EASE, 0.5), 2)
    await act(async () => c.advance(150))
    expect(num(flat(layer('#fff')).opacity)).toBe(1)
    // Android: a 48pt bar, 26pt in, the time 15pt at 500
    await act(async () => r.update(staged(<Phone width={W} frame="android" />)))
    expect(views(r.root, (s) => s.height === 48)[0]).toBeDefined()
    expect(views(r.root, (s) => s.paddingLeft === 26 && s.justifyContent === 'space-between')).toHaveLength(2)
    expect(flat(texts(r.root, '9:41')[0])).toMatchObject({ fontSize: 15, fontWeight: '500' })
    // A soft phone with its status forced on: 54 tall, 52 and 34 in
    await act(async () => r.update(staged(<Phone width={W} frame="soft" status />)))
    expect(views(r.root, (s) => s.paddingLeft === 52 && s.paddingRight === 34)).toHaveLength(2)
  })

  it('draws a minimal time as a 30 × 7 bar at half strength on the baseline', async () => {
    const r = await render(
      <LookContext.Provider value={{ ...look(), fidelity: 'minimal' }}>
        <Phone width={W} />
      </LookContext.Provider>,
    )
    const bar = views(r.root, (s) => s.width === 30 && s.height === 7)[0]
    expect(flat(bar)).toMatchObject({ borderRadius: 4, opacity: 0.5 })
    // The bar's bottom sits on the time's baseline, about 17.3 into its 22pt line
    expect(21.5 + num(flat(bar).marginTop) + 7).toBeCloseTo(38.8, 0)
  })

  it('casts each frame its own shadow and paints android, soft and clay as the web does', async () => {
    const shadow = (r: ReactTestRenderer) => flat(r.root.findAllByType(SceneView)[0]).boxShadow
    const r = await render(staged(<Phone width={402} frame="bare" />))
    expect(shadow(r)).toBe('0 40px 80px -16px rgba(50,50,93,0.25), 0 24px 48px -24px rgba(0,0,0,0.3)')
    await act(async () => r.update(staged(<Phone width={W} frame="outline" />)))
    expect(shadow(r)).toBeUndefined()
    await act(async () => r.update(staged(<Phone width={434} frame="clay" />)))
    expect(shadow(r)).toBe('0 30px 60px -12px rgba(50,50,93,0.2), 0 16px 32px -16px rgba(0,0,0,0.16)')
    await act(async () => r.update(staged(<Phone width={418} frame="soft" />)))
    expect(shadow(r)).toBe(
      '0 0 0 1.5px rgba(10,37,64,0.05), 0 30px 60px -12px rgba(50,50,93,0.18), 0 18px 36px -18px rgba(0,0,0,0.12)',
    )
    expect(views(r.root, (st) => st.backgroundColor === '#f6f9fc')[0].props.style).toContainEqual(
      expect.objectContaining({ borderRadius: 54.5, boxShadow: 'inset 0 -2.9px 7.2px rgba(10,37,64,0.22)' }),
    )
    await act(async () => r.update(staged(<Phone width={W} frame="soft" />, 'dark')))
    expect(views(r.root, (st) => st.backgroundColor === '#1c2433')).toHaveLength(1)
    // Android: the gradient body, 2pt of it, then the black glass
    await act(async () => r.update(staged(<Phone width={W} frame="android" />)))
    const rects = r.root.findAllByType(Rect)
    expect(rects.find((n) => n.props.fill === '#050505')?.props).toMatchObject({ x: 2, y: 2, rx: 47 })
    expect(rects.find((n) => String(n.props.fill).endsWith('android)'))?.props.rx).toBe(49)
    // Clay is dark on dark stages only
    await act(async () => r.update(staged(<Phone width={W} frame="clay" dark />, 'glass')))
    expect(r.root.findAllByType(Path).some((n) => n.props.stroke === '#e0dfdc')).toBe(true)
  })

  it('places the photo bezel over the body and picks the dark one for dark phones', async () => {
    const light = { uri: 'light.png' },
      dark = { uri: 'dark.png' }
    const r = await render(staged(<Phone width={W} frame="photo" bezel={{ light, dark }} />))
    const photo = () => r.root.findAllByType(Image).at(-1)!
    expect(photo().props.source).toBe(light)
    expect(photo().props.style).toEqual({ position: 'absolute', left: -8, top: -7, width: 450, height: 920 })
    await act(async () => r.update(staged(<Phone width={W} frame="photo" bezel={{ light, dark }} dark />)))
    expect(photo().props.source).toBe(dark)
    // A bezel that fails to load falls back to the pro frame
    await act(async () => photo().props.onError())
    expect(r.root.findAllByType(Image)).toHaveLength(0)
  })

  it('draws the outline ring and the screen hairline in the theme lines', async () => {
    const r = await render(staged(<Phone width={W} frame="outline" />))
    const strokes = r.root.findAllByType(Path).map((n) => n.props.stroke)
    expect(strokes).toEqual(expect.arrayContaining([resolveTokens('light', 'accent').textFaint, 'rgba(0,0,0,0.06)']))
  })

  it('runs the wallpaper gradient on the line CSS draws at 172deg', () => {
    const line = gradientLine(172, 402, 874)
    expect(line.x1).toBeCloseTo(136.9, 1)
    expect(line.y1).toBeCloseTo(-19.2, 1)
    expect(line.x2).toBeCloseTo(265.1, 1)
    expect(line.y2).toBeCloseTo(893.2, 1)
  })
})

describe('LockScreen and Notification', () => {
  it('fills the screen with the date and clock at web size', async () => {
    const r = await render(staged(<Phone width={W} dark children={<LockScreen />} />))
    expect(flat(r.root.findAllByType(LockScreen)[0].findByType(SceneView))).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    })
    expect(flat(texts(r.root, 'Tuesday, October 21')[0])).toMatchObject({
      marginTop: 66,
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.22,
      opacity: 0.85,
    })
    expect(flat(texts(r.root, '9:41').find((n) => flat(n).fontSize === 112)!)).toMatchObject({
      marginTop: -4,
      lineHeight: 112,
      fontWeight: '700',
      letterSpacing: -3.92,
      fontVariant: ['tabular-nums'],
      opacity: 0.92,
    })
    // The controls: 46 in, 48 up, 50pt discs with cut-out glyphs
    expect(views(r.root, (s) => s.left === 46 && s.right === 46)[0].props.style).toMatchObject({ bottom: 48 })
    expect(views(r.root, (s) => s.backgroundColor === 'rgba(10,12,24,0.26)')).toHaveLength(2)
    expect(
      r.root
        .findAllByType(LockScreen)[0]
        .findAllByType(Path)
        .filter((n) => n.props.fillRule === 'evenodd'),
    ).toHaveLength(2)
  })

  it('stacks notifications where the web does', async () => {
    const stack = (node: React.ReactElement) =>
      render(staged(<Phone width={W} children={node} />)).then(
        (r) => flat(views(r.root, (s) => s.gap === 8 && s.position === 'absolute')[0]) as Record<string, unknown>,
      )
    expect(await stack(<LockScreen />)).toMatchObject({ bottom: 118 })
    expect(await stack(<LockScreen stack="top" />)).toMatchObject({ top: 290 })
    expect(await stack(<LockScreen size="satellite" />)).toMatchObject({ top: 232 })
    expect(await stack(<LockScreen size="satellite" clock={false} />)).toMatchObject({ top: 74 })
  })

  it('sets the card in iOS points, lit on a light screen and frosted on a dark one', async () => {
    const r = await render(staged(<Phone width={W} children={<Notification title="Maya" body="Running late" />} />))
    const card = () => r.root.findAllByType(Notification)[0].findAllByType(SceneView)[0]
    expect(flat(card())).toMatchObject({
      gap: 13,
      marginHorizontal: 18,
      paddingTop: 14,
      paddingRight: 17,
      paddingBottom: 14,
      paddingLeft: 14,
      borderRadius: 23,
      boxShadow: '0 0 0 0.5px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12)',
    })
    expect(views(r.root, (s) => s.backgroundColor === 'rgba(255,255,255,0.92)')).toHaveLength(1)
    // The icon tile is always drawn, in the accent
    expect(views(r.root, (s) => s.width === 38 && s.height === 38)[0].props.style).toMatchObject({
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor: resolveTokens('light', 'accent').accent,
    })
    expect(flat(texts(r.root, 'Maya')[0])).toMatchObject({
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '600',
      color: '#000',
    })
    expect(flat(texts(r.root, 'now')[0])).toMatchObject({ fontSize: 12, color: 'rgba(60,60,67,0.6)' })
    await act(async () => r.update(staged(<Phone width={W} dark children={<Notification title="Maya" />} />)))
    expect(flat(card()).boxShadow).toBe('0 4px 24px rgba(0,0,0,0.06)')
    expect(views(r.root, (s) => s.backgroundColor === 'rgba(252,252,253,0.76)')).toHaveLength(1)
  })

  it('drops a banner in at 56pt, over the status bar and under the island', async () => {
    const c = installVirtualClock()
    const r = await render(staged(<Phone width={W} children={<Notification banner title="Maya" />} />))
    const json = r.toJSON() as TestRenderer.ReactTestRendererJSON
    const find = (
      node: TestRenderer.ReactTestRendererJSON,
      test: (n: TestRenderer.ReactTestRendererJSON) => boolean,
    ): TestRenderer.ReactTestRendererJSON | undefined => {
      if (test(node)) return node
      for (const child of node.children ?? [])
        if (typeof child !== 'string') {
          const hit: TestRenderer.ReactTestRendererJSON | undefined = find(child, test)
          if (hit) return hit
        }
      return undefined
    }
    const style = (n: TestRenderer.ReactTestRendererJSON) =>
      (StyleSheet.flatten(n.props.style) ?? {}) as Record<string, unknown>
    const screen = find(json, (n) => style(n).width === 402 && style(n).backgroundColor === '#fff')!
    const order = (screen.children as TestRenderer.ReactTestRendererJSON[]).map((n) =>
      style(n).top === 56 ? 'banner' : style(n).height === 62 ? 'status' : style(n).width === 95 ? 'island' : '',
    )
    expect(order.filter(Boolean)).toEqual(['status', 'status', 'banner', 'island'])
    const card = r.root.findAll((n) => n.type === SceneView && flat(n).top === 56)[0]
    expect(transform(card, 'translateY')).toBe(-110)
    await act(async () => c.advance(260))
    expect(transform(card, 'translateY')).toBeCloseTo(-110 * (1 - at([0.2, 0.9, 0.25, 1], 0.5)), 1)
    await act(async () => c.advance(260))
    expect(transform(card, 'translateY')).toBe(0)
    // Unmounted with the story, it goes with it
    await act(async () => r.update(staged(<Phone width={W} />)))
    expect(r.root.findAll((n) => n.type === SceneView && flat(n).top === 56)).toHaveLength(0)
  })
})

describe('Keyboard', () => {
  it('sizes every key from the sheet: ten keys and nine 6pt gaps per row', async () => {
    const r = await render(staged(<Phone width={W} children={<Keyboard />} />))
    const sheet = r.root.findAllByType(Keyboard)[0].findAllByType(SceneView)[0]
    expect(flat(sheet)).toMatchObject({
      marginHorizontal: 3,
      marginBottom: 4,
      paddingHorizontal: 3,
      borderTopLeftRadius: 28,
      borderBottomLeftRadius: 52,
      backgroundColor: 'rgba(227,228,233,0.94)',
    })
    const k = (396 - 60) / 10
    const keys = () => r.root.findAll((n) => n.type === Animated.View && flat(n).borderRadius === 8.5)
    expect(keys().filter((n) => flat(n).width === k)).toHaveLength(26)
    expect(keys().filter((n) => flat(n).width === k * 1.36)).toHaveLength(2)
    expect(keys().filter((n) => flat(n).width === k * 2.78)).toHaveLength(2)
    expect(views(r.root, (s) => s.height === 42.5 && s.gap === 6)).toHaveLength(4)
    expect(views(r.root, (s) => s.height === 42.5 && s.marginBottom === 11)).toHaveLength(3)
    expect(views(r.root, (s) => s.height === 50)).toHaveLength(1)
    expect(views(r.root, (s) => s.height === 72 && s.paddingHorizontal === 22)).toHaveLength(1)
    // Measured, the sheet resets the key
    await lay(sheet, { width: 300 })
    expect(keys().filter((n) => flat(n).width === 24)).toHaveLength(26)
  })

  it('pops a callout out of a typed letter, anchored inside the row ends', async () => {
    const c = installVirtualClock()
    const r = await render(staged(<Phone width={W} children={<Keyboard typed="" />} />))
    await act(async () => r.update(staged(<Phone width={W} children={<Keyboard typed="H" />} />)))
    const k = 33.6
    const balloon = views(r.root, (s) => s.height === 54)[0]
    expect(flat(balloon)).toMatchObject({
      bottom: 30,
      width: k * 1.45,
      paddingBottom: 6,
      borderRadius: 12,
    })
    expect(flat(balloon).left).toBeCloseTo(-0.225 * k, 5)
    expect(flat(balloon).boxShadow).toBe('0 1px 6px rgba(0,0,0,0.16)')
    const stem = flat(views(balloon, (s) => s.height === 14)[0])
    expect(stem.top).toBe(50)
    expect(stem.width).toBeCloseTo(k * 1.45 * 0.69, 5)
    expect(flat(texts(balloon, 'h')[0])).toMatchObject({ fontSize: 34 })
    await act(async () => c.advance(140))
    expect(views(r.root, (s) => s.height === 54)).toHaveLength(0)
    await act(async () => r.update(staged(<Phone width={W} children={<Keyboard typed="Hq" />} />)))
    expect(flat(views(r.root, (s) => s.height === 54)[0]).left).toBe(0)
    await act(async () => r.update(staged(<Phone width={W} children={<Keyboard typed="Hqp" />} />)))
    expect(flat(views(r.root, (s) => s.height === 54)[0]).right).toBe(0)
  })

  it('darkens only special keys, at once, and lets them back over 0.12s', async () => {
    const c = installVirtualClock()
    const space = (r: ReactTestRenderer) =>
      r.root.findAll((n) => n.type === Animated.View && flat(n).borderRadius === 8.5 && flat(n).flex === 1)[0]
    const r = await render(staged(<Keyboard pressed="space" />))
    expect(read(flat(space(r)).backgroundColor)).toBe('rgba(196, 198, 205, 1)')
    await act(async () => r.update(staged(<Keyboard pressed={null} />)))
    await act(async () => c.advance(120))
    expect(read(flat(space(r)).backgroundColor)).toBe('rgba(255, 255, 255, 1)')
    // A held letter shows nothing on the key itself
    await act(async () => r.update(staged(<Keyboard pressed="a" />)))
    expect(r.root.findAll((n) => n.type === Animated.View && flat(n).backgroundColor === '#fff').length).toBe(26)
  })

  it('uses the web colours, light and dark, and takes overrides', async () => {
    const r = await render(staged(<Keyboard dark />))
    const sheet = () => r.root.findAllByType(Keyboard)[0].findAllByType(SceneView)[0]
    expect(flat(sheet())).toMatchObject({
      backgroundColor: 'rgba(42,42,44,0.94)',
      boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.1)',
    })
    expect(r.root.findAll((n) => n.type === Animated.View && flat(n).backgroundColor === '#4a4a4c')).toHaveLength(26)
    expect(flat(texts(r.root, '123')[0])).toMatchObject({ fontSize: 17, color: '#fff' })
    // Below the keys the emoji and mic are faint; the emoji's face is cut in the sheet colour
    const paths = r.root.findAllByType(Path)
    expect(paths.some((n) => n.props.fill === '#2a2a2c')).toBe(true)
    expect(paths.some((n) => n.props.stroke === '#ebebf5')).toBe(true)
    await act(async () => r.update(staged(<Keyboard colors={{ sheet: '#102030', key: '#ff0000' }} />)))
    expect(flat(sheet()).backgroundColor).toBe('rgba(16,32,48,0.94)')
    expect(r.root.findAll((n) => n.type === Animated.View && flat(n).backgroundColor === '#ff0000')).toHaveLength(26)
  })
})

describe('Messages', () => {
  const bubble = (r: ReactTestRenderer, name: string) => scenes(r.root, name)[0]
  const fillOf = (node: ReactTestInstance) =>
    node.findAll((n) => n.type === Animated.View && flat(n).position === 'absolute' && flat(n).top === 0)[0]

  it('colours bubbles per web, darkening received ones on a dark phone, and takes colour hooks', async () => {
    const thread = (props: { dark?: boolean; app?: 'imessage' | 'sms' }, extra?: React.ReactNode) => (
      <Phone width={W} dark={props.dark}>
        <Thread app={props.app}>
          <Bubble from="them" target="them">
            Hi
          </Bubble>
          <Bubble from="me" target="me">
            Hello
          </Bubble>
          {extra}
        </Thread>
      </Phone>
    )
    const r = await render(staged(thread({})))
    expect(flat(fillOf(bubble(r, 'them'))).backgroundColor).toBe('#e9e9eb')
    expect(read(flat(texts(r.root, 'Hi')[0]).color)).toBe('#000')
    expect(flat(fillOf(bubble(r, 'me'))).backgroundColor).toBe('#0a84ff')
    await act(async () => r.update(staged(thread({ dark: true }), 'blueprint')))
    expect(flat(fillOf(bubble(r, 'them'))).backgroundColor).toBe('#26252a')
    expect(read(flat(texts(r.root, 'Hi')[0]).color)).toBe('#fff')
    await act(async () => r.update(staged(thread({}), 'blueprint')))
    expect(flat(fillOf(bubble(r, 'them'))).backgroundColor).toBe('#e9e9eb')
    await act(async () => r.update(staged(thread({ app: 'sms' }))))
    expect(flat(fillOf(bubble(r, 'me'))).backgroundColor).toBe('#34c759')
    await act(async () =>
      r.update(
        staged(
          <Thread me="#111" meText="#222" them="#333" themText="#444">
            <Bubble from="them" target="them">
              Hi
            </Bubble>
            <Bubble from="me" target="me" me="#555">
              Hello
            </Bubble>
          </Thread>,
        ),
      ),
    )
    expect(flat(fillOf(bubble(r, 'them'))).backgroundColor).toBe('#333')
    expect(read(flat(texts(r.root, 'Hi')[0]).color)).toBe('#444')
    expect(flat(fillOf(bubble(r, 'me'))).backgroundColor).toBe('#555')
    expect(read(flat(texts(r.root, 'Hello')[0]).color)).toBe('#222')
  })

  it('sets bubbles in ems of the thread size: 17 in a phone, 15 outside', async () => {
    const r = await render(
      staged(
        <Phone width={W}>
          <Thread>
            <Bubble from="them" target="b">
              Hi
            </Bubble>
          </Thread>
        </Phone>,
      ),
    )
    expect(flat(bubble(r, 'b'))).toMatchObject({ paddingVertical: 7.14, maxWidth: '75%', borderRadius: 1.06 * 17 })
    expect(flat(bubble(r, 'b')).paddingHorizontal).toBeCloseTo(12.92, 5)
    expect(flat(texts(r.root, 'Hi')[0])).toMatchObject({ fontSize: 17, lineHeight: 17 * 1.3, letterSpacing: -0.17 })
    await act(async () =>
      r.update(
        staged(
          <Thread>
            <Bubble from="them" target="b">
              Hi
            </Bubble>
          </Thread>,
        ),
      ),
    )
    expect(flat(bubble(r, 'b')).paddingHorizontal).toBeCloseTo(11.4, 5)
    expect(flat(bubble(r, 'b')).borderRadius).toBeCloseTo(15.9, 5)
    // The tail: 1.06em × 0.94em, 0.36em out from the corner
    const tail = tails(bubble(r, 'b'))[0]
    expect(flat(tail)).toMatchObject({
      width: 1.06 * 15,
      height: 0.94 * 15,
      left: -0.36 * 15,
      transformOrigin: '85% 85%',
    })
  })

  it('draws the chat look: plain replies, a quiet bubble for the person, wider gaps', async () => {
    const tokens = resolveTokens('light', 'accent')
    const r = await render(
      staged(
        <Thread app="chat">
          <Bubble from="me" target="me">
            Question
          </Bubble>
          <Bubble from="them" target="them">
            Answer
          </Bubble>
        </Thread>,
      ),
    )
    expect(views(r.root, (s) => s.overflow === 'hidden' && s.marginHorizontal === -1000)[0].props.style).toMatchObject({
      gap: 18,
    })
    expect(flat(bubble(r, 'them'))).toMatchObject({
      paddingVertical: 0,
      paddingHorizontal: 0,
      borderRadius: 0,
      maxWidth: '100%',
    })
    expect(read(flat(texts(r.root, 'Answer')[0]).color)).toBe(tokens.muted)
    expect(flat(texts(r.root, 'Answer')[0]).lineHeight).toBeCloseTo(15 * 1.55, 5)
    expect(flat(fillOf(bubble(r, 'me'))).backgroundColor).toBe(tokens.ink[0])
    expect(flat(bubble(r, 'me'))).toMatchObject({ paddingVertical: 7.5, paddingHorizontal: 13.5, borderRadius: 18 })
    // No tails, no gap between runs
    expect(tails(bubble(r, 'me'))).toHaveLength(0)
    expect(r.root.findAll((n) => n.type === Animated.View && flat(n).marginTop === 8)).toHaveLength(0)
  })

  it('clips the thread at its top only', async () => {
    const r = await render(staged(<Thread style={{ paddingTop: 12 }} />))
    expect(views(r.root, (s) => s.overflow === 'hidden')[0].props.style).toMatchObject({
      marginTop: -12,
      paddingTop: 12,
      marginHorizontal: -1000,
      paddingHorizontal: 1000,
      marginBottom: -1000,
      paddingBottom: 1000,
    })
  })

  it('rises an arrival in from its tail corner and grows its tail once nearly landed', async () => {
    const c = installVirtualClock()
    const node = (more: boolean) =>
      staged(
        <Thread>
          <Bubble from="them">Hi</Bubble>
          {more && (
            <Bubble from="me" target="new">
              Hello
            </Bubble>
          )}
        </Thread>,
      )
    const r = await render(node(false))
    await act(async () => r.update(node(true)))
    const b = bubble(r, 'new')
    const fill = fillOf(b),
      tail = tails(b)[0]
    expect(num(flat(b).opacity)).toBe(0)
    expect(transform(b, 'translateY')).toBe(6)
    expect(transform(fill, 'scale')).toBeCloseTo(0.8, 5)
    expect(flat(fill).transformOrigin).toBe('right bottom')
    await act(async () => c.advance(225))
    expect(num(flat(b).opacity)).toBeCloseTo(at(GROW, 0.5), 2)
    expect(transform(tail, 'scale')).toBeCloseTo(0.2 + 0.8 * at(SCROLL, 25 / 320), 2)
    await act(async () => c.advance(225))
    expect(num(flat(b).opacity)).toBe(1)
    expect(transform(fill, 'scale')).toBe(1)
    await act(async () => c.advance(100))
    expect(num(flat(tail).opacity)).toBe(1)
    expect(transform(tail, 'scale')).toBe(1)
  })

  it('pops a tapback in on its corner and makes room below the bubble', async () => {
    const c = installVirtualClock()
    const node = (show: boolean) =>
      staged(
        <Thread>
          <Bubble from="them" target="b" tapback={{ emoji: '❤️', show }}>
            Hi
          </Bubble>
        </Thread>,
      )
    const r = await render(node(false))
    const b = bubble(r, 'b'),
      tap = b.findAll((n) => n.type === Animated.View && flat(n).bottom === -17)[0]
    expect(flat(tap)).toMatchObject({ width: 24, height: 24, left: 8, backgroundColor: '#fff' })
    expect(flat(tap).boxShadow).toBe('0 1px 2px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.05)')
    expect(transform(tap, 'scale')).toBe(0.5)
    expect(num(flat(b).marginBottom)).toBe(0)
    await act(async () => r.update(node(true)))
    await act(async () => c.advance(100))
    expect(num(flat(tap).opacity)).toBe(1)
    await act(async () => c.advance(125))
    expect(transform(tap, 'scale')).toBeCloseTo(0.5 + 0.5 * at([0.22, 1.4, 0.36, 1], 0.5), 2)
    expect(num(flat(b).marginBottom)).toBeCloseTo(21 * at(GROW, 0.5), 1)
    await act(async () => c.advance(225))
    expect(num(flat(b).marginBottom)).toBe(21)
    // Closing waits 0.12s, then takes 0.3s
    await act(async () => r.update(node(false)))
    await act(async () => c.advance(120))
    expect(num(flat(b).marginBottom)).toBe(21)
    await act(async () => c.advance(300))
    expect(num(flat(b).marginBottom)).toBe(0)
    expect(transform(tap, 'scale')).toBe(0.5)
  })

  it('bobs three typing dots one line tall, 0.16s apart', async () => {
    const c = installVirtualClock()
    const r = await render(
      staged(
        <Thread>
          <Bubble from="them" target="b" typing>
            Hi
          </Bubble>
        </Thread>,
      ),
    )
    expect(flat(bubble(r, 'b'))).toMatchObject({ paddingVertical: 0.84 * 15, paddingHorizontal: 0.8 * 15 })
    const dots = r.root.findAll((n) => n.type === Animated.View && flat(n).backgroundColor === '#8e8e93')
    expect(dots).toHaveLength(3)
    expect(flat(dots[0])).toMatchObject({ width: 0.46 * 15, height: 0.46 * 15 })
    expect(views(r.root, (s) => s.gap === 0.24 * 15)).toHaveLength(1)
    // 30% into the cycle the first dot is full and lifted 0.12em; the second, 0.16s behind, is still rising
    await act(async () => c.advance(360))
    expect(num(flat(dots[0]).opacity)).toBeCloseTo(1, 2)
    expect(transform(dots[0], 'translateY')).toBeCloseTo(-0.12 * 15, 2)
    expect(num(flat(dots[1]).opacity)).toBeCloseTo(0.4 + 0.6 * at([0.42, 0, 0.58, 1], (0.3 - 0.16 / 1.2) / 0.3), 1)
    expect(num(flat(dots[2]).opacity)).toBeCloseTo(0.4 + 0.6 * at([0.42, 0, 0.58, 1], (0.3 - 0.32 / 1.2) / 0.3), 1)
  })

  it('grows the typing bubble into the reply: box eases over 0.35s, words fade in over 0.28s', async () => {
    const c = installVirtualClock()
    const node = (typing: boolean) =>
      staged(
        <Thread>
          <Bubble from="them" target="b" typing={typing}>
            Perfect, see you there
          </Bubble>
        </Thread>,
      )
    const r = await render(node(true))
    await lay(bubble(r, 'b'), { width: 54, height: 32 })
    await act(async () => r.update(node(false)))
    const b = bubble(r, 'b')
    expect(num(flat(b).width)).toBe(54)
    expect(num(flat(b).height)).toBe(32)
    // The words are laid out once, at their final width, and the box eases to them
    const words = b.findAll((n) => n.type === View && typeof n.props.onLayout === 'function' && !n.props.style)[0]
    await lay(words, { width: 160, height: 19.5 })
    await act(async () => c.advance(175))
    expect(num(flat(b).width)).toBeCloseTo(54 + (160 + 0.76 * 30 - 54) * at(GROW, 0.5), 0)
    const fade = r.root.findAll((n) => n.type === Animated.View && n.findAllByType(Animated.Text).length === 1).at(-1)!
    expect(num(flat(fade).opacity)).toBeCloseTo(at(EASE, 175 / 280), 2)
    await act(async () => c.advance(300))
    expect(flat(bubble(r, 'b')).width).toBeUndefined()
  })

  it('forms a sent bubble out of the composer: words from the field, fill fading in, tail after landing', async () => {
    const c = installVirtualClock()
    const registry = new Registry()
    registry.measure = async () => {}
    const s = scene(registry)
    const node = (sent: boolean) =>
      staged(
        <Thread>
          <Bubble from="them">Hi</Bubble>
          {sent && (
            <Bubble from="me" target="sent" source="draft">
              See you at 7
            </Bubble>
          )}
        </Thread>,
        'light',
        s,
      )
    await render(staged(<SceneView target="draft" />, 'light', s))
    const r = tree!
    await act(async () => r.update(node(false)))
    await act(async () => r.update(node(true)))
    const b = bubble(r, 'sent')
    // Held unseen until measured
    expect(num(flat(b).opacity)).toBe(0)
    registry.entries.set('draft', {
      rect: { x: 40, y: 600, width: 200, height: 22 },
      layout: { x: 0, y: 0, width: 0, height: 0 },
      order: 0,
    })
    const own = registry.entries.get('sent')!
    own.rect = own.layout = { x: 180, y: 500, width: 120, height: 34 }
    await act(async () => c.advance(16))
    const padX = 0.76 * 15
    expect(num(flat(b).opacity)).toBe(1)
    expect(transform(b, 'translateX')).toBeCloseTo(40 - (180 + padX), 1)
    expect(transform(b, 'translateY')).toBeCloseTo(611 - 517, 1)
    const fill = fillOf(b)
    expect(num(flat(fill).opacity)).toBe(0)
    expect(num(flat(tails(b)[0]).opacity)).toBe(0)
    // Field colour to bubble ink, and the fill, over 0.3s after 0.06s
    await act(async () => c.advance(60 + 150))
    expect(num(flat(fill).opacity)).toBeCloseTo(at(EASE, 0.5), 1)
    expect(transform(b, 'translateX')).toBeCloseTo((40 - (180 + padX)) * (1 - at(GROW, 210 / 500)), 0)
    await act(async () => c.advance(300))
    expect(transform(b, 'translateX')).toBeCloseTo(0, 5)
    expect(read(flat(texts(r.root, 'See you at 7')[0]).color)).toBe('rgba(255, 255, 255, 1)')
    // The tail grows from 0.32s after the bubble formed, over 0.32s
    const tail = tails(b)[0]
    await act(async () => c.advance(150))
    expect(num(flat(tail).opacity)).toBe(1)
  })

  it('glides rows up over 0.55s on the scroll curve when a commit moves them, and only then', async () => {
    const c = installVirtualClock()
    const thread = (more: boolean) =>
      staged(
        <Thread>
          <Bubble from="them">Hi</Bubble>
          {more && <Bubble from="me">Hello</Bubble>}
        </Thread>,
      )
    const r = await render(thread(false))
    const row = r.root.findAll(
      (n) => n.type === Animated.View && typeof n.props.onLayout === 'function' && 'marginTop' in flat(n),
    )[0]
    await lay(row, { y: 100 })
    // Something still opening below (a receipt) moves it without a commit: it is already traveling
    await lay(row, { y: 96 })
    expect(transform(row, 'translateY')).toBe(0)
    // A new message arrives: the commit moves it up, and it glides from where it was
    await act(async () => r.update(thread(true)))
    await lay(row, { y: 76 })
    expect(transform(row, 'translateY')).toBe(20)
    await act(async () => c.advance(275))
    expect(transform(row, 'translateY')).toBeCloseTo(20 * (1 - at(SCROLL, 0.5)), 2)
    await act(async () => c.advance(275))
    expect(transform(row, 'translateY')).toBe(0)
  })

  it('sets stamps and receipts small and grey, 14pt in a phone', async () => {
    const r = await render(
      staged(
        <Phone width={W}>
          <Thread>
            <Stamp>Today 9:41</Stamp>
            <Receipt>Delivered</Receipt>
          </Thread>
        </Phone>,
      ),
    )
    const type = { fontSize: 14, color: '#8e8e93', fontWeight: '500', lineHeight: 14 * 1.3 }
    expect(flat(texts(r.root, 'Today 9:41')[0])).toMatchObject(type)
    expect(flat(r.root.findAllByType(Stamp)[0].findByType(SceneView))).toMatchObject({
      paddingTop: 10,
      paddingBottom: 6,
    })
    expect(flat(texts(r.root, 'Delivered')[0])).toMatchObject(type)
    expect(views(r.root, (s) => s.alignItems === 'flex-end' && s.paddingRight === 0.3 * 14)).toHaveLength(1)
    await act(async () =>
      r.update(
        staged(
          <Thread>
            <Stamp>Today 9:41</Stamp>
            <Receipt>Delivered</Receipt>
          </Thread>,
        ),
      ),
    )
    expect(flat(texts(r.root, 'Today 9:41')[0]).fontSize).toBeCloseTo(10.5, 5)
    expect(flat(texts(r.root, 'Delivered')[0]).fontSize).toBeCloseTo(9.9, 5)
  })

  it('opens a receipt over 0.55s and rolls Delivered to Read', async () => {
    const c = installVirtualClock()
    const node = (show: boolean, text: string) =>
      staged(
        <Thread>
          <Receipt show={show}>{text}</Receipt>
        </Thread>,
      )
    const r = await render(node(false, 'Delivered'))
    const box = () => r.root.findAllByType(Receipt)[0].findByType(SceneView)
    const inner = box().findAll((n) => n.type === View && flat(n).alignItems === 'flex-end')[0]
    await lay(inner, { height: 13 })
    expect(num(flat(box()).height)).toBe(0)
    await act(async () => r.update(node(true, 'Delivered')))
    await act(async () => c.advance(125))
    expect(num(flat(box()).opacity)).toBeCloseTo(at(EASE, 0.5), 2)
    await act(async () => c.advance(150))
    expect(num(flat(box()).height)).toBeCloseTo(13 * at(SCROLL, 0.5), 1)
    await act(async () => c.advance(275))
    expect(num(flat(box()).height)).toBe(13)
    // The roll: the old word lifts out over 0.3s as the new rises in 0.08s later over 0.4s
    await act(async () => r.update(node(true, 'Read 9:41')))
    const measure = (text: string) =>
      r.root.findAll((n) => n.type === RNText && n.props.children === text && typeof n.props.onLayout === 'function')[0]
    await act(async () => {
      measure('Delivered').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 50, height: 13 } } })
      measure('Read 9:41').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 46, height: 13 } } })
    })
    // Each word moves in its own right-pinned layer
    const layer = (text: string) =>
      r.root
        .findAll((n) => n.type === Animated.View && flat(n).position === 'absolute' && flat(n).right === 0)
        .filter((n) => n.findAll((m) => m.type === RNText && m.props.children === text).length)[0]
    const old = layer('Delivered'),
      next = layer('Read 9:41')
    await act(async () => c.advance(150))
    expect(num(flat(old).opacity)).toBeCloseTo(1 - at(EASE, 0.5), 2)
    expect(num(flat(next).opacity)).toBeCloseTo(at(SCROLL, 70 / 400), 2)
    await act(async () => c.advance(350))
    expect(num(flat(old).opacity)).toBe(0)
    expect(num(flat(next).opacity)).toBe(1)
    expect(transform(next, 'translateY')).toBe(0)
  })
})
