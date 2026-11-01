import { View } from 'react-native'
import {
  Stage,
  Text,
  Badge,
  Count,
  Chart,
  Field,
  Toggle,
  Avatar,
  Check,
  Row,
  Chip,
  Phone,
  Thread,
  Bubble,
  Stamp,
  Receipt,
  Keyboard,
  Icon,
  Swap,
  type Act,
} from '../kit'
import { ArrowUp, Mic } from 'lucide-react-native'
import {
  chart,
  states,
  messages,
  hold,
  story,
  type Phase,
  type ReviewTheme,
  type SceneName,
  type ReviewState,
} from './model'

export interface ReviewSceneProps {
  scene: SceneName
  theme: ReviewTheme
  phase: Phase | 'live'
  reduced?: boolean
  replay?: number
  onMark?: (mark: string) => void
  onError?: (error: unknown) => void
}
const row = { flexDirection: 'row' as const, alignItems: 'center' as const }
export function ReviewScene({ scene, theme, phase, reduced = false, replay = 0, onMark, onError }: ReviewSceneProps) {
  const dark = theme === 'dark' || theme === 'blueprint'
  return (
    <Stage<ReviewState>
      width={scene === 'phone' ? 390 : 720}
      height={scene === 'phone' ? 490 : 300}
      compact={scene === 'controls' ? { below: 600, width: 358, height: 480 } : undefined}
      initial={states.opening}
      poster={states.payoff}
      script={(phase === 'live' ? story : hold) as (a: Act<ReviewState>) => Promise<void>}
      play="once"
      theme={theme}
      fidelity="realistic"
      reducedMotion={reduced}
      replay={replay}
      onMark={onMark}
      onError={onError}
      accessibilityLabel={
        scene === 'phone' ? 'A conversation about meeting for coffee' : 'Invite a teammate to your workspace'
      }
    >
      {(live, _rect, layout) => {
        const s = phase === 'live' ? live : states[phase]
        return scene === 'phone' ? (
          <View style={{ alignItems: 'center', marginTop: -150 }}>
            <Phone width={390} frame="silver" dark={dark}>
              <View style={{ ...row, justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 12 }}>
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
                {messages.map((text, i) => (
                  <Bubble key={text} from={i === 2 ? 'me' : 'them'}>
                    {text}
                  </Bubble>
                ))}
                {s.saved && <Bubble from="me">Coffee at 10?</Bubble>}
                {s.saved && <Receipt>Read 9:41</Receipt>}
                {s.saved && (
                  <Bubble from="them" tapback={{ emoji: '❤️' }}>
                    Perfect. See you there!
                  </Bubble>
                )}
              </Thread>
              <View style={{ ...row, gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
                <Icon name="plus" size={22} />
                <Field
                  value={!s.saved && s.enabled ? 'Coffee at 10?' : ''}
                  placeholder="iMessage"
                  focused={!s.saved}
                  style={{ flex: 1 }}
                  trailing={
                    s.enabled && !s.saved ? <ArrowUp size={18} color="#0b84ff" /> : <Mic size={18} color="#8e8e93" />
                  }
                />
              </View>
              <Keyboard
                dark={dark}
                typed={s.enabled && !s.saved ? 'Coffee at 10?' : ''}
                suggestions={['Coffee', 'at', '10?']}
              />
            </Phone>
          </View>
        ) : (
          <View style={{ padding: 24, gap: 24 }}>
            <View style={{ ...row, justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 20, fontWeight: '600' }}>Studio workspace</Text>
              <Badge tone={s.saved ? 'success' : 'neutral'}>{s.saved ? 'Ready' : 'Draft'}</Badge>
            </View>
            <View style={{ flexDirection: layout === 'compact' ? 'column' : 'row', gap: 28 }}>
              <View style={{ flex: layout === 'compact' ? undefined : 1, gap: 18 }}>
                <View style={{ ...row, justifyContent: 'space-between' }}>
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12 }}>Weekly activity</Text>
                    <Count value={s.count} style={{ fontSize: 32, fontWeight: '600' }} />
                  </View>
                  <Chart width={128} height={64} data={chart} />
                </View>
                <Row lead={<Avatar name="Maya Chen" />} title="Maya Chen" subtitle="Design team">
                  <Check on={s.saved} pending={!s.saved} />
                </Row>
              </View>
              <View style={{ flex: layout === 'compact' ? undefined : 1, gap: 16 }}>
                <Field
                  label="Invite a teammate"
                  value={s.email}
                  placeholder="Email address"
                  focused={!s.saved}
                  status={s.saved ? 'valid' : undefined}
                  box={{ target: 'invite' }}
                />
                <View style={{ ...row, justifyContent: 'space-between' }}>
                  <Text>Email notifications</Text>
                  <Toggle on={s.enabled} />
                </View>
                <View style={{ ...row, gap: 8 }}>
                  <Chip>Design</Chip>
                  <Chip>Engineering</Chip>
                </View>
                <Swap id={s.saved ? 'done' : 'draft'}>
                  <Text>{s.saved ? 'Ready to collaborate' : 'Bring your team together'}</Text>
                </Swap>
              </View>
            </View>
          </View>
        )
      }}
    </Stage>
  )
}
