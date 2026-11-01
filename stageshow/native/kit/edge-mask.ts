export function edgeMask(width: number, height: number, feather: number, horizontal = true) {
  const x = Math.min(0.499, feather / Math.max(1, width)),
    y = Math.min(0.499, feather / Math.max(1, height))
  const gradient = (id: string, horizontal: boolean, edge: number) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${horizontal ? 1 : 0}" y2="${horizontal ? 0 : 1}"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset="${edge}" stop-color="white"/><stop offset="${1 - edge}" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${gradient('x', true, x)}${gradient('y', false, y)}<mask id="vertical"><rect width="100%" height="100%" fill="url(#y)"/></mask></defs><rect width="100%" height="100%" fill="${horizontal ? 'url(#x)' : 'white'}" mask="url(#vertical)"/></svg>`
}
