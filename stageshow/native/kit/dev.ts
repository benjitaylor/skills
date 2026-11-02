// Development-only authoring feedback, as in the web kit. Release bundles define __DEV__ false.
export function isDev() {
  return typeof __DEV__ === 'undefined' || __DEV__
}
export function warn(message: string) {
  if (isDev()) console.warn(`[stageshow-native] ${message}`)
}
