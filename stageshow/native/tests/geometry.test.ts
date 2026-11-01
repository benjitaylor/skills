import { Registry } from '../kit/registry'
import { box, between, contains, inset } from '../kit/geometry'
import { chartPoints } from '../kit/chart-geometry'
import { cellOf } from '../kit/motion/layout'

it('handles native target fractions and compact layouts', () => {
  const r = new Registry(),
    rect = { x: 10, y: 20, width: 80, height: 40 }
  r.entries.set('item', { rect, layout: rect, order: 1 })
  expect(r.resolve({ at: 'item', x: 1, y: 0 }, 'wide')).toEqual({ x: 90, y: 20 })
  expect(r.resolve({ wide: { x: 1, y: 2 }, compact: 'item' }, 'compact')).toEqual({ x: 50, y: 40 })
  expect(() => r.resolve('missing', 'wide')).toThrow('not mounted')
})
it('propagates hover through target ancestors and excludes hidden targets', () => {
  const r = new Registry(),
    rect = { x: 0, y: 0, width: 100, height: 100 }
  r.entries.set('parent', { rect, layout: rect, order: 1 })
  r.entries.set('child', { rect, layout: rect, order: 2, parent: 'parent' })
  r.entries.set('hidden', { rect, layout: rect, order: 3, hidden: true })
  expect(r.hit({ x: 50, y: 50 })).toBe('child')
  r.hover('child')
  expect(r.interaction('parent').hover).toBe(true)
  r.hover(undefined)
  expect(r.interaction('child').hover).toBe(false)
})
it('maps a caret to measured stops across native text lines', () => {
  const r = new Registry(),
    rect = { x: 20, y: 30, width: 100, height: 40 }
  r.entries.set('text', {
    rect,
    layout: rect,
    order: 1,
    lines: [
      { x: 0, y: 0, width: 40, height: 20, text: 'Wi', offset: 0, stops: [0, 30, 40] },
      { x: 0, y: 20, width: 30, height: 20, text: 'abc', offset: 2, stops: [0, 10, 20, 30] },
    ],
  })
  expect(r.caret('text', { x: 49, y: 35 })).toBe(1)
  expect(r.caret('text', { x: 39, y: 55 })).toBe(4)
  expect(r.caret('text', { x: 20, y: 90 })).toBe(5)
})
it('preserves chart geometry when used for markers', () => {
  expect(chartPoints({ data: [0, 10], width: 100, height: 50 })).toEqual([
    { x: 4, y: 46 },
    { x: 96, y: 4 },
  ])
  expect(chartPoints({ data: [], width: 100, height: 50 })).toEqual([])
})
it('holds a cell until a drag crosses its hysteresis band', () => {
  expect(cellOf(105, 100, 0)).toBe(0)
  expect(cellOf(125, 100, 0)).toBe(1)
  expect(cellOf(95, 100, 1)).toBe(1)
  expect(cellOf(75, 100, 1)).toBe(0)
})

it('does not hit a child outside a clipping scroll target or hidden parent', () => {
  const registry = new Registry(),
    parent = { x: 0, y: 0, width: 50, height: 50 },
    child = { x: 0, y: 60, width: 50, height: 20 }
  registry.entries.set('scroll', { rect: parent, layout: parent, clips: true, order: 1 })
  registry.entries.set('row', { rect: child, layout: child, parent: 'scroll', order: 2 })
  expect(registry.hit({ x: 10, y: 70 })).toBeUndefined()
  registry.entries.get('scroll')!.hidden = true
  registry.entries.get('row')!.rect = parent
  expect(registry.hit({ x: 10, y: 10 })).toBeUndefined()
})
