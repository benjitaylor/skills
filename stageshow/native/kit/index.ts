// The stage: the canvas, the script, the cursor, measuring and playback
export { Stage } from './stage'
export { useLook } from './look'
export { useReducedMotion } from './reduced-motion'
export { inset, box, between, contains } from './geometry'
export type { StageProps, Play } from './stage'
export type { LookTokens } from './look'
export type { Act, Script } from './act'
export type { Point, Rect, Target } from './geometry'
export type { CursorKind, CursorStyle } from './cursor-types'
export type { Theme, Palette, Fidelity, Layout } from './look'
export type { KeysAt } from './cursor-types'
export { clock, installVirtualClock } from './clock'
export type { ClockControl } from './clock'

// Frames: windows, devices and system surfaces, from real geometry
export { Window, Bar, Text, Prompt, Caret } from './window'
export type { WindowProps, BarProps, TextProps, PromptProps } from './window'
export { Phone, LockScreen, Notification, WALLPAPER } from './phone'
export type { PhoneProps, PhoneFrame, LockScreenProps, NotificationProps } from './phone'
export { Keyboard } from './ios'
export type { KeyboardProps } from './ios'
export { Thread, Bubble, Stamp, Receipt } from './messages'
export type { ThreadProps, BubbleProps } from './messages'

// Motion: behaviors that have to hold up frame by frame (motion/, one file per part)
export {
  Connector,
  Count,
  Roll,
  Swap,
  Collapse,
  Fly,
  Follow,
  cellOf,
  States,
  Stream,
  Popover,
  Camera,
  Scroll,
  Expand,
} from './motion'
export type { ConnectorProps, CountProps, FollowProps, FlyProps, PopoverOrigin } from './motion'
export { EASE, bezier, css as easeCss } from './ease'
export type { EaseName, Bezier } from './ease'

// Small parts: starting points with quiet defaults; restyle them as the product does (parts/, controls/)
export { Avatar, Check, Icon, Spinner, Toast, Tooltip, Meter, Menu, Facepile, Chip, BrandMark, Pin, Row } from './parts'
export type { AvatarProps, IconName, BrandMarkProps, PinProps, RowProps } from './parts'
export { brandMarks } from './brands'
export type { BrandName, BrandAsset } from './brands'
export { Field, Segmented, Toggle, Tabs, Badge, Slot } from './controls'
export type { FieldProps } from './controls'
export { Code } from './code'
export type { CodeLine } from './code'
export { Chart, chartPoints } from './chart'
export type { ChartProps } from './chart'

// Native targets replace DOM attributes; styles use React Native values.
export { SceneView } from './native'
export type { NativeProps, NativeStyle } from './native'
