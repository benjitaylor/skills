import { Animated, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Stage, Phone, Thread, Bubble, Stamp, Receipt, Avatar, SceneView, Text } from '../kit'
import { useTween } from '../kit/animate'
import { initial, poster, script, MINE, type S } from './messages-model'
import { Copy, row, type ExampleProps } from './shared'

function Composer({ draft }: { draft: string }) {
  const show = useTween(draft ? 1 : 0, 250)
  return (
    <View style={[row, { gap: 10, marginHorizontal: 14, marginBottom: 36 }]}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: '#e9e9eb',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16">
          <Path d="M8 2.5v11M2.5 8h11" fill="none" stroke="#3c3c43" strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      </View>
      <SceneView
        target="compose"
        style={[
          row,
          {
            flex: 1,
            minHeight: 36,
            paddingLeft: 14,
            paddingRight: 4,
            borderRadius: 18,
            backgroundColor: '#fff',
            boxShadow: 'inset 0 0 0 1px #d1d1d6',
          },
        ]}
      >
        <SceneView target="draft" style={[row, { flex: 1, minWidth: 0 }]}>
          <Text style={{ fontSize: 17, lineHeight: 22.1, letterSpacing: -0.17, color: '#000' }}>{draft}</Text>
          {!!draft && (
            <View style={{ width: 2, height: 20, marginLeft: 1, borderRadius: 1, backgroundColor: '#0a84ff' }} />
          )}
        </SceneView>
        {!draft && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 14 }}>
            <Copy style={{ color: '#b0b0b5', fontSize: 17, lineHeight: 22.1 }}>iMessage</Copy>
          </View>
        )}
        <SceneView
          target="send"
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a84ff',
            opacity: show,
            transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path
              d="M8 13V3.5M3.5 7.5 8 3l4.5 4.5"
              fill="none"
              stroke="#fff"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </SceneView>
      </SceneView>
    </View>
  )
}
/** Native rendition of examples/messages: same crop, content and script. */
export default function Messages({ poster: still, ...props }: ExampleProps) {
  return (
    <Stage<S>
      width={420}
      height={340}
      compact={{ below: 420, width: 358, height: 340 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: 'compose', style: 'touch' }}
      reducedMotion={still}
      tokens={{ background: '#efeeec' }}
      accessibilityLabel="Maya confirms tonight's dinner"
      {...props}
    >
      {(s, _rect, layout) => (
        <Phone width={326} style={{ position: 'absolute', bottom: 16, left: layout === 'compact' ? 16 : 47 }}>
          <View
            style={{
              alignItems: 'center',
              gap: 4,
              paddingTop: 4,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(0,0,0,.06)',
            }}
          >
            <Avatar name="Maya" tone="ios" size={52} />
            <Copy style={{ fontSize: 12 }}>Maya</Copy>
          </View>
          <Thread style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 10 }}>
            <Stamp>Today 9:38</Stamp>
            <Bubble from="them">Are we still on for tonight?</Bubble>
            <Bubble from="them">I booked the place on 5th</Bubble>
            {s.sent && (
              <Bubble from="me" source="draft">
                {MINE}
              </Bubble>
            )}
            <Receipt show={s.delivered}>{s.read ? 'Read 9:41' : 'Delivered'}</Receipt>
            {(s.typing || s.reply) && (
              <Bubble from="them" typing={s.typing}>
                Perfect, I'll grab us a table by the window
              </Bubble>
            )}
          </Thread>
          <Composer draft={s.draft} />
        </Phone>
      )}
    </Stage>
  )
}
