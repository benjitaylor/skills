import { useEffect, useRef, useState } from 'react'
import { Animated, ScrollView, View } from 'react-native'
import { SceneView, useInteraction, useScene, type NativeProps } from '../native'
import { Mask, edgeMask } from '../mask'
import { useTween } from '../animate'

export function Scroll({
  name,
  bar = 'overlay',
  children,
  style,
  ...rest
}: NativeProps & { name: string; bar?: 'overlay' | 'always' | 'none' }) {
  const scene = useScene(),
    ref = useRef<ScrollView>(null),
    [height, setHeight] = useState(0),
    [width, setWidth] = useState(0),
    [total, setTotal] = useState(0),
    [offset, setOffset] = useState(0)
  const interaction = useInteraction(name),
    opacity = useTween(bar === 'always' || interaction?.scrolling ? 1 : 0, 250)
  const scrolling = useRef({
    offset: 0,
    max: 0,
    set: (value: number) => {
      ref.current?.scrollTo({ y: value, animated: false })
      setOffset(value)
    },
  }).current
  scrolling.max = Math.max(0, total - height)
  useEffect(() => {
    const entry = scene?.registry.entries.get(name)
    if (entry) {
      entry.scroll = scrolling
      entry.clips = true
    }
    return () => {
      if (entry?.scroll === scrolling) delete entry.scroll
    }
  }, [scene?.registry, name, scrolling])
  const thumb = total > height ? Math.max(24, (height * height) / total) : 0
  return (
    <SceneView
      {...rest}
      target={name}
      onLayout={(event) => {
        setHeight(event.nativeEvent.layout.height)
        setWidth(event.nativeEvent.layout.width)
      }}
      style={[{ overflow: 'hidden', minHeight: 0 }, style]}
    >
      <Mask xml={edgeMask(Math.max(1, width), Math.max(1, height), offset > 0 ? 18 : 0, false)} style={{ flex: 1 }}>
        <ScrollView
          ref={ref}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(_, h) => setTotal(h)}
          onScroll={(event) => {
            scrolling.offset = event.nativeEvent.contentOffset.y
            setOffset(scrolling.offset)
          }}
          scrollEventThrottle={16}
        >
          {children}
        </ScrollView>
      </Mask>
      {bar !== 'none' && thumb > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 3,
            top: 0,
            width: 4,
            height: thumb,
            borderRadius: 2,
            backgroundColor: '#9b9b9b',
            opacity,
            transform: [{ translateY: total > height ? (offset / (total - height)) * (height - thumb) : 0 }],
          }}
        />
      )}
    </SceneView>
  )
}
