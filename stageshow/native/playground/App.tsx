import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { ArrowUp, Mic } from 'lucide-react-native'
import {
  clock,
  installVirtualClock,
  Avatar,
  Badge,
  Bar,
  BrandMark,
  Bubble,
  Camera,
  Caret,
  Chart,
  Check,
  Chip,
  Code,
  Collapse,
  Connector,
  Count,
  Expand,
  Facepile,
  Field,
  Fly,
  Follow,
  Icon,
  Keyboard,
  LockScreen,
  Menu,
  Meter,
  Notification,
  Phone,
  Pin,
  Popover,
  Prompt,
  Receipt,
  Roll,
  Row,
  SceneView,
  Scroll,
  Segmented,
  Slot,
  Spinner,
  Stage,
  Stamp,
  States,
  Stream,
  Swap,
  Tabs,
  Text,
  Thread,
  Toast,
  Toggle,
  Tooltip,
  Window,
  WALLPAPER,
  type Act,
  type Fidelity,
  type PhoneFrame,
  type Theme,
} from '../kit'

const inboxInitial = { message: '', sent: false, typing: false, replied: false, read: false }
async function inboxScript(a: Act<typeof inboxInitial>) {
  await a.wait(700)
  await a.click('compose')
  await a.type('message', 'Coffee at 10?')
  await a.wait(500)
  await a.click('send')
  await a.set({ sent: true, message: '' })
  a.mark('sent')
  await a.wait(800)
  await a.set({ typing: true, read: true })
  await a.wait(1600)
  await a.set({ typing: false, replied: true })
  a.mark('reply')
  await a.wait(2200)
}
const kitInitial = { on: false, count: 1280, tab: 0, value: '', open: false, progress: 0.26 }
async function kitScript(a: Act<typeof kitInitial>) {
  await a.wait(500)
  await a.click('switch')
  await a.set({ on: true, count: 1364, tab: 1, progress: 0.82, open: true })
  a.mark('enabled')
  await a.click('field')
  await a.type('value', 'hello@stageshow.dev')
  await a.wait(1500)
  await a.key('cmd+enter')
  await a.wait(1800)
}
const motionInitial = { open: false, step: 0, show: false, expanded: false }
async function motionScript(a: Act<typeof motionInitial>) {
  await a.wait(500)
  await a.click('source')
  await a.set({ open: true, show: true, step: 1 })
  a.mark('transfer')
  await a.wait(1300)
  await a.scroll('list', 'person-5', { offset: 16 })
  await a.wait(700)
  await a.set({ open: false, step: 2 })
  await a.wait(700)
  await a.click('destination')
  await a.set({ expanded: true })
  a.mark('expanded')
  await a.wait(1800)
  await a.set({ expanded: false })
  await a.wait(600)
}
const frames: PhoneFrame[] = ['pro', 'silver', 'bezel', 'soft', 'bare', 'clay', 'outline', 'android', 'photo']
const names = [
  'Maya Chen',
  'Sam Rivera',
  'Nora Patel',
  'Alex Kim',
  'Jordan Lee',
  'Eli Brooks',
  'Avery James',
  'Riley Cole',
]
const row = { flexDirection: 'row' as const, alignItems: 'center' as const }
const panel = { padding: 18, gap: 18 }
const bold = { fontSize: 18, fontWeight: '600' as const }
const mono = { fontFamily: 'monospace', color: '#d1dae7' }

export default function App() {
  const [page, setPage] = useState('Inbox'),
    [theme, setTheme] = useState<Theme>('light')
  const [fidelity, setFidelity] = useState<Fidelity>('realistic'),
    [poster, setPoster] = useState(false),
    [replay, setReplay] = useState(0)
  const [error, setError] = useState(''),
    [focus, setFocus] = useState(false)
  const [clockMode, setClockMode] = useState<'live' | 'start-step' | 'step' | 'stop-step'>('live'),
    [time, setTime] = useState(0),
    [advancing, setAdvancing] = useState(false)
  useEffect(() => {
    if (clockMode === 'start-step') {
      installVirtualClock({
        onLayout: () =>
          new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      })
      setTime(0)
      setClockMode('step')
    } else if (clockMode === 'stop-step') {
      clock.recording?.restore()
      setClockMode('live')
    } else if (clockMode === 'step' && !clock.recording) {
      // Fast Refresh can preserve React state after restoring the old clock.
      setClockMode('start-step')
    }
  }, [clockMode])
  useEffect(() => () => clock.recording?.restore(), [])
  const advance = async (frames: number) => {
    const control = clock.recording
    if (!control || advancing) return
    setAdvancing(true)
    try {
      await control.step(frames)
      if (clock.recording === control) setTime(control.now() - 1000)
    } finally {
      setAdvancing(false)
    }
  }
  const mounted = clockMode === 'live' || clockMode === 'step'

  const settings = {
    theme,
    fidelity,
    replay,
    reducedMotion: poster,
    onError: (e: unknown) => setError(String(e)),
    play: 'once' as const,
  }
  const button = (label: string, active: boolean, fn: () => void) => (
    <Pressable
      key={label}
      onPress={fn}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.button, active && styles.selected]}
    >
      <RNText style={[styles.buttonText, active && { color: '#fff' }]}>{label}</RNText>
    </Pressable>
  )
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.host}>
          {!focus && (
            <View style={styles.heading}>
              <RNText style={styles.eyebrow}>STAGESHOW / REACT NATIVE</RNText>
              <RNText style={styles.title}>Small stories. Native motion.</RNText>
              <RNText style={styles.description}>
                The same illustration vocabulary, built with native views, text and vector paths.
              </RNText>
            </View>
          )}
          {!focus && (
            <View style={styles.buttons}>
              {['Inbox', 'Kit', 'Motion', 'Devices'].map((name) =>
                button(name, page === name, () => {
                  setPage(name)
                  setError('')
                }),
              )}
            </View>
          )}
          {!focus && (
            <View style={styles.buttons}>
              {(['light', 'dark', 'blueprint', 'glass'] as Theme[]).map((name) =>
                button(name, theme === name, () => setTheme(name)),
              )}
            </View>
          )}
          <View style={styles.buttons}>
            {button(focus ? 'Back' : 'Focus', focus, () => setFocus(!focus))}
            {button(poster ? 'Poster' : 'Animate', poster, () => setPoster(!poster))}
            {button('Replay', false, () => {
              setError('')
              setReplay((n) => n + 1)
            })}
            {!focus &&
              button(fidelity, false, () =>
                setFidelity(fidelity === 'realistic' ? 'minimal' : fidelity === 'minimal' ? 'standard' : 'realistic'),
              )}
            {button('Step mode', clockMode === 'step', () =>
              setClockMode(clockMode === 'step' ? 'stop-step' : 'start-step'),
            )}
          </View>
          {clockMode === 'step' && (
            <View style={styles.buttons}>
              {button('+50 ms', false, () => {
                void advance(3)
              })}
              {button('+1 second', false, () => {
                void advance(60)
              })}
              <RNText style={styles.description}>{advancing ? 'Advancing…' : `${(time / 1000).toFixed(2)}s`}</RNText>
            </View>
          )}
          {!!error && (
            <RNText accessibilityRole="alert" style={styles.error}>
              {error}
            </RNText>
          )}
          <View style={styles.canvas}>
            {mounted && page === 'Inbox' && (
              <Stage
                key="inbox"
                {...settings}
                width={390}
                height={490}
                initial={inboxInitial}
                poster={{ ...inboxInitial, sent: true, replied: true, read: true }}
                script={inboxScript}
                cursor={{ at: { x: 370, y: 610 }, style: 'touch', ripple: false }}
                accessibilityLabel="A conversation about meeting for coffee"
              >
                {(s) => (
                  <View style={{ alignItems: 'center', marginTop: -150 }}>
                    <Phone width={390} frame="silver" dark={theme === 'dark' || theme === 'blueprint'}>
                      <View
                        style={{ ...row, justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 12 }}
                      >
                        <View style={{ transform: [{ rotate: '180deg' }] }}>
                          <Icon name="chevron-right" size={22} />
                        </View>
                        <View style={{ alignItems: 'center', gap: 8 }}>
                          <Avatar name="Maya Chen" tone="ios" size={44} />
                          <Text style={{ fontSize: 13, fontWeight: '600' }}>Maya Chen</Text>
                        </View>
                        <Icon name="more" size={22} />
                      </View>
                      <Thread style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                        <Stamp>Today 9:41 AM</Stamp>
                        <Bubble from="them">There’s a new place on the corner.</Bubble>
                        <Bubble from="them">The coffee looks excellent ☕</Bubble>
                        <Bubble from="me">I’m in. Let’s go!</Bubble>
                        {s.sent && (
                          <Bubble key="sent" from="me" source="compose">
                            Coffee at 10?
                          </Bubble>
                        )}
                        {s.sent && <Receipt>{s.read ? 'Read 9:41' : 'Delivered'}</Receipt>}
                        {(s.typing || s.replied) && (
                          <Bubble
                            key="reply"
                            from="them"
                            typing={s.typing}
                            tapback={s.replied ? { emoji: '❤️' } : undefined}
                          >
                            {s.replied ? 'Perfect. See you there!' : ''}
                          </Bubble>
                        )}
                      </Thread>
                      <View style={{ ...row, gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
                        <Icon name="plus" size={22} />
                        <Field
                          value={s.message}
                          placeholder="iMessage"
                          focused={!s.sent}
                          style={{ flex: 1 }}
                          box={{ target: 'compose' }}
                          trailing={
                            <SceneView
                              target="send"
                              cursor="hand"
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                                backgroundColor: s.message ? '#0b84ff' : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {s.message ? (
                                <ArrowUp color="#fff" size={18} strokeWidth={2.5} />
                              ) : (
                                <Mic
                                  color={theme === 'dark' || theme === 'blueprint' ? '#a7a7ac' : '#8e8e93'}
                                  size={18}
                                />
                              )}
                            </SceneView>
                          }
                        />
                      </View>
                      <Keyboard
                        dark={theme === 'dark' || theme === 'blueprint'}
                        typed={s.message}
                        suggestions={['Coffee', 'at', '10?']}
                      />
                    </Phone>
                  </View>
                )}
              </Stage>
            )}
            {mounted && page === 'Kit' && (
              <Stage
                key="kit"
                {...settings}
                width={370}
                height={910}
                initial={kitInitial}
                poster={{
                  ...kitInitial,
                  on: true,
                  open: true,
                  value: 'hello@stageshow.dev',
                  count: 1364,
                  progress: 0.82,
                }}
                script={kitScript}
                cursor={{ at: { x: 340, y: 40 }, style: 'arrow', ripple: true }}
              >
                {(s) => (
                  <View style={panel}>
                    <View style={{ ...row, justifyContent: 'space-between' }}>
                      <Text style={bold}>Workspace overview</Text>
                      <Badge tone="success" dot>
                        Live
                      </Badge>
                    </View>
                    <View style={{ ...row, justifyContent: 'space-between' }}>
                      <View style={{ gap: 6 }}>
                        <Text>Weekly activity</Text>
                        <Count value={s.count} style={{ fontSize: 30, fontWeight: '600' }} />
                      </View>
                      <Chart width={145} height={70} data={s.on ? [2, 4, 3, 6, 5, 8, 10, 9] : [2, 3, 2, 5, 3, 4]} />
                    </View>
                    <Tabs items={['Overview', 'Members', 'Settings']} value={s.tab} />
                    <View style={{ ...row, justifyContent: 'space-between' }}>
                      <Facepile names={names.slice(0, 4)} size={28} />
                      <View style={{ ...row, gap: 8 }}>
                        <BrandMark brand="figma" />
                        <BrandMark brand="linear" />
                        <BrandMark brand="github" />
                      </View>
                    </View>
                    <Row
                      lead={<Avatar name="Maya Chen" ring="confirmed" />}
                      title="Design review"
                      subtitle="Updated just now"
                      meta="10:24"
                      selected={s.on}
                      unread={!s.on}
                    >
                      <Check on={s.on} pending={!s.on} />
                    </Row>
                    <Segmented items={['Monthly', 'Yearly']} value={s.tab} />
                    <Field
                      label="Invite a teammate"
                      value={s.value}
                      placeholder="Email address"
                      focused={s.on}
                      status={s.value.includes('@') ? 'valid' : undefined}
                      box={{ target: 'field' }}
                    />
                    <View style={{ ...row, justifyContent: 'space-between' }}>
                      <Text>Email notifications</Text>
                      <Toggle target="switch" cursor="hand" on={s.on} />
                    </View>
                    <Meter value={s.progress} />
                    <View style={{ ...row, gap: 8 }}>
                      <Chip remove="remove-chip">Design</Chip>
                      <Chip show={s.open}>Engineering</Chip>
                      <Pin name="Alex" />
                      <Spinner size={14} />
                    </View>
                    <Collapse open={s.open}>
                      <View style={{ gap: 8 }}>
                        <Roll>{s.on ? 'Ready to collaborate' : 'Waiting for teammates'}</Roll>
                        <Stream
                          text="Your workspace is ready for the next big idea."
                          count={s.on ? 11 : 3}
                          mark={(_, i) => i === 3}
                        />
                      </View>
                    </Collapse>
                    <Window title="Configuration" chrome="terminal" style={{ height: 130 }}>
                      <Code
                        numbers
                        lines={[
                          { text: 'const story = {' },
                          { text: '  platform: "native",', kind: 'add' },
                          { text: '  ready: true', kind: 'add' },
                          { text: '}' },
                        ]}
                      />
                    </Window>
                    <Toast show={s.on} icon={<Icon name="check" color="#fff" />}>
                      Workspace updated
                    </Toast>
                  </View>
                )}
              </Stage>
            )}
            {mounted && page === 'Motion' && (
              <Stage
                key="motion"
                {...settings}
                width={370}
                height={650}
                initial={motionInitial}
                poster={{ ...motionInitial, open: true, show: true, step: 1 }}
                script={motionScript}
                cursor={{ at: { x: 340, y: 55 }, style: 'arrow', ripple: true }}
              >
                {(s, rect) => (
                  <View style={{ flex: 1 }}>
                    <View style={panel}>
                      <Text style={bold}>A place for every detail</Text>
                      <View style={{ ...row, justifyContent: 'space-between', height: 56 }}>
                        <SceneView
                          target="source"
                          cursor="grab"
                          style={{ padding: 12, borderRadius: 12, backgroundColor: '#e8eaff' }}
                        >
                          <Text style={{ color: '#3940ac' }}>Design brief</Text>
                        </SceneView>
                        <SceneView
                          target="destination"
                          cursor="hand"
                          style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#b7bbc7' }}
                        >
                          <Text>Project</Text>
                        </SceneView>
                      </View>
                      <Swap id={s.step}>
                        <Text>{['Choose a file', 'Moving into your project', 'Everything in its place'][s.step]}</Text>
                      </Swap>
                      <States
                        value={s.show ? 'ready' : 'loading'}
                        states={{ loading: <Spinner />, ready: <Badge tone="success">Added to project</Badge> }}
                        align="start"
                      />
                      <Slot open={s.show} height={38} dashed>
                        <Row title="Project brief.pdf" lead={<Icon name="file" />} />
                      </Slot>
                      <Scroll name="list" style={{ height: 220 }} bar="always">
                        {names.map((name, i) => (
                          <Row
                            key={name}
                            target={`person-${i}`}
                            lead={<Avatar name={name} />}
                            title={name}
                            subtitle={i % 2 ? 'Editor' : 'Designer'}
                          />
                        ))}
                      </Scroll>
                      <View style={{ height: 60 }}>
                        <Camera focus={s.step === 2 ? { x: 50, y: 0, width: 100, height: 40 } : null} feather={8}>
                          <Chart kind="bars" width={280} height={60} data={[3, 6, 4, 8, 5, 9, 7]} />
                        </Camera>
                      </View>
                      <View style={{ backgroundColor: '#191b20', padding: 12, borderRadius: 8 }}>
                        <Prompt path="~/project">
                          <RNText style={mono}>ready</RNText>
                          <Caret still={poster} />
                        </Prompt>
                      </View>
                      <View style={{ ...row, gap: 6 }}>
                        <Bar w={90} />
                        <Bar w={36} tone={1} />
                      </View>
                    </View>
                    <Connector
                      from={{
                        x: rect('source').x + rect('source').width,
                        y: rect('source').y + rect('source').height / 2,
                      }}
                      to={{ x: rect('destination').x, y: rect('destination').y + rect('destination').height / 2 }}
                      show={s.open}
                      arrow
                    />
                    <Follow
                      to={
                        s.step === 2
                          ? {
                              ...rect('destination'),
                              x: rect('destination').x - 3,
                              y: rect('destination').y - 3,
                              width: rect('destination').width + 6,
                              height: rect('destination').height + 6,
                            }
                          : null
                      }
                      style={{ borderWidth: 1.5, borderColor: '#757dce', borderRadius: 15 }}
                    />
                    <Fly from={rect('source')} to={rect('destination')} go={s.open}>
                      <Badge tone="accent">Brief</Badge>
                    </Fly>
                    <Popover show={s.open} style={{ left: 18, top: 195, width: 170 }}>
                      <Menu items={['Open', 'Move to project', 'Duplicate']} value={1} />
                    </Popover>
                    <Tooltip show={s.open} at={rect('destination')}>
                      Project files
                    </Tooltip>
                    <Expand
                      open={s.expanded}
                      from={rect('destination')}
                      radius={12}
                      face={
                        <View
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#b7bbc7',
                            borderRadius: 12,
                          }}
                        >
                          <Text>Project</Text>
                        </View>
                      }
                      style={{ backgroundColor: theme === 'dark' ? '#202127' : '#fff' }}
                    >
                      <View style={{ padding: 24, gap: 16 }}>
                        <Text style={bold}>Project files</Text>
                        <Row lead={<Icon name="file" />} title="Design brief.pdf" subtitle="Added a moment ago" />
                        <Chart width={280} height={150} data={[2, 3, 5, 4, 7, 9]} />
                      </View>
                    </Expand>
                  </View>
                )}
              </Stage>
            )}
            {mounted && page === 'Devices' && (
              <View>
                {frames.map((frame) => (
                  <View key={frame} style={{ marginBottom: 24 }}>
                    <RNText style={styles.frameLabel}>{frame}</RNText>
                    <Stage {...settings} width={370} height={620} reducedMotion>
                      {() => <ViewScene frame={frame} />}
                    </Stage>
                  </View>
                ))}
              </View>
            )}
          </View>
          <RNText style={styles.footnote}>
            Illustrations are scripted. Use Replay to run a scene again. System Reduce Motion always takes precedence.
          </RNText>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
function ViewScene({ frame }: { frame: PhoneFrame }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 10 }}>
      <Phone width={280} frame={frame} wallpaper={WALLPAPER} dark>
        <LockScreen controls>
          <Notification
            icon={<BrandMark brand="slack" size={36} />}
            title="Design team"
            body="The next chapter starts here."
          />
          <Notification
            icon={<BrandMark brand="figma" size={36} />}
            title="New comment"
            body="Looking good. Ready to share?"
          />
        </LockScreen>
      </Phone>
    </View>
  )
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f1ee' },
  host: { padding: 18, alignSelf: 'center', width: '100%', maxWidth: 600, gap: 14 },
  heading: { gap: 10, paddingVertical: 14 },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: '#72736e' },
  title: { fontSize: 28, fontWeight: '600', letterSpacing: -0.7, color: '#252822' },
  description: { fontSize: 14, lineHeight: 21, color: '#72736e', maxWidth: 360 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#dcddd6' },
  selected: { backgroundColor: '#343b2f', borderColor: '#343b2f' },
  buttonText: { fontSize: 12, color: '#53594e' },
  canvas: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#eaeae6' },
  error: { color: '#a02030', padding: 12, backgroundColor: '#ffe3e3' },
  frameLabel: { padding: 16, fontSize: 13, color: '#62685d' },
  footnote: { fontSize: 11, lineHeight: 17, color: '#777b73', paddingBottom: 30 },
})
