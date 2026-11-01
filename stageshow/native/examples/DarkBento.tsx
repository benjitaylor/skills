import { useId } from 'react'
import { View } from 'react-native'
import Svg, { Defs, Rect, Stop } from 'react-native-svg'
import { RadialGradient } from '../kit/radial-gradient'
import { Avatar, Bar, Facepile, Stage, Window } from '../kit'
import { Copy, Sleeve, FaceGradient, row, heroShadow, type ExampleProps } from './shared'
const tracks = [
  { title: 62, artist: 40, art: 1 },
  { title: 48, artist: 54, art: 2 },
  { added: true, title: 58, artist: 38, art: 3 },
  { title: 70, artist: 36, art: 4 },
  { title: 56, artist: 46, art: 5 },
]
const face = { backgroundColor: '#d8d8db' }
/** Exact 360 × 280 gold composition: one playlist and one explanatory satellite. */
export default function DarkBento(_props: ExampleProps) {
  const id = useId().replace(/[^a-z0-9]/gi, '')
  return (
    <Stage
      width={360}
      height={280}
      compact={{ below: 360, width: 358, height: 280 }}
      theme="dark"
      palette="mono"
      style={{ borderRadius: 18, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' }}
      tokens={{ background: '#111113', well: '#151517', surface: '#1b1b1e' }}
      accessibilityLabel="Sunday Slow, a shared playlist with a track added by Mara"
    >
      {() => (
        <>
          <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
            <Defs>
              <RadialGradient id={id} cx="70%" cy="-10%" rx="120%" ry="90%">
                <Stop stopColor="#fff" stopOpacity={0.06} />
                <Stop offset={0.6} stopColor="#fff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
          <Window
            lights="grey"
            style={{
              position: 'absolute',
              top: 22,
              left: 88,
              width: 400,
              height: 300,
              borderRadius: 12,
              borderWidth: 0,
              boxShadow: '0 0 0 1px rgba(255,255,255,.08), 0 30px 60px -12px rgba(0,0,0,.5)',
            }}
            body={{ style: { flexDirection: 'row' } }}
          >
            <View
              style={{
                width: 92,
                paddingVertical: 14,
                paddingHorizontal: 8,
                gap: 4,
                borderRightWidth: 1,
                borderRightColor: 'rgba(255,255,255,.08)',
                backgroundColor: '#151517',
              }}
            >
              {[46, 52, 40].map((w, i) => (
                <View key={i} style={[row, { height: 22, paddingHorizontal: 4, gap: 8 }]}>
                  <Bar w={10} h={10} r={3} tone={i === 2 ? 4 : 2} />
                  <Bar w={w} h={5} tone={i === 2 ? 4 : 2} />
                </View>
              ))}
            </View>
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
              <View style={[row, { alignItems: 'flex-end', gap: 12, marginBottom: 16 }]}>
                <Sleeve art={3} size={48} cover />
                <View style={{ gap: 8, paddingBottom: 2 }}>
                  <Copy style={{ fontSize: 14, lineHeight: 18.2, fontWeight: '600', letterSpacing: -0.14 }}>
                    Sunday Slow
                  </Copy>
                  <Facepile
                    names={['', '', '', '']}
                    tones={['ink', 'ink', 'ink', 'ink']}
                    size={18}
                    overlap={4}
                    avatars={[0, 1, 2, 3].map((i) => (
                      <Avatar key={i} size={18} background={<FaceGradient size={18} index={i} />} />
                    ))}
                  />
                </View>
              </View>
              {tracks.map((t) => (
                <View
                  key={t.art}
                  style={[
                    row,
                    {
                      gap: 10,
                      height: 38,
                      marginHorizontal: -8,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: t.added ? '#29292c' : 'transparent',
                    },
                  ]}
                >
                  <View>
                    <Sleeve art={t.art} size={26} />
                    {t.added && (
                      <Avatar
                        name="Mara"
                        size={14}
                        background={<FaceGradient size={14} />}
                        textStyle={{ color: '#111113', fontWeight: '600' }}
                        style={[face, { position: 'absolute', right: -5, bottom: -5, boxShadow: '0 0 0 2px #29292c' }]}
                      />
                    )}
                  </View>
                  <View style={{ gap: 6 }}>
                    <Bar w={t.title} h={5} tone={t.added ? 5 : 3} />
                    <Bar w={t.artist} h={4} tone={t.added ? 3 : 2} />
                  </View>
                </View>
              ))}
            </View>
          </Window>
          <View
            style={{
              position: 'absolute',
              left: 22,
              bottom: 22,
              width: 136,
              padding: 12,
              borderRadius: 12,
              backgroundColor: '#222225',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,.09), inset 0 1px 0 rgba(255,255,255,.05), 0 24px 48px -12px rgba(0,0,0,.8), 0 6px 14px -6px rgba(0,0,0,.6)',
            }}
          >
            <View
              style={[
                row,
                { gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.08)' },
              ]}
            >
              <Sleeve art={3} size={32} />
              <View style={{ gap: 6 }}>
                <Bar w={58} h={5} tone={5} />
                <Bar w={38} h={4} tone={3} />
              </View>
            </View>
            <View style={[row, { gap: 8, paddingTop: 10 }]}>
              <Avatar
                name="Mara"
                size={20}
                background={<FaceGradient size={20} />}
                textStyle={{ color: '#111113', fontWeight: '600' }}
                style={face}
              />
              <Copy style={{ fontSize: 11, lineHeight: 14.3, fontWeight: '500', color: '#9d9da1' }}>Added by Mara</Copy>
            </View>
          </View>
        </>
      )}
    </Stage>
  )
}
