/** Coordinates measured on the 400px book illustration, bottom to top of the spine. */
export const PAGE_COLUMNS = 12;
export const PAGE_ROWS = 4;
const REST_ANGLE = Math.PI / 18;
const COS_REST = Math.cos(REST_ANGLE);
const SIN_REST = Math.sin(REST_ANGLE);
export type PagePoint = { x: number; y: number };

function rotateBookPagePoint(alongSpine: number, acrossPage: number, progress: number): PagePoint {
  const s = alongSpine, u = acrossPage;
  const angle = REST_ANGLE + progress * (Math.PI - 2 * REST_ANGLE);
  // Integrating a gently curving tangent preserves the width of the sheet.
  const curl = .28 * Math.sin(Math.PI * progress);
  const start = angle - curl / 2;
  const cosine = Math.abs(curl) < 1e-6 ? u * Math.cos(angle) : (Math.sin(start + curl * u) - Math.sin(start)) / curl;
  const sine = Math.abs(curl) < 1e-6 ? u * Math.sin(angle) : (Math.cos(start) - Math.cos(start + curl * u)) / curl;
  const right = { x: 101 - 5 * s, y: 4 };
  const left = { x: -92 + 2 * s, y: -33 + s };
  // Two measured resting planes determine the projected basis of the rotation.
  const horizontal = { x: (right.x - left.x) / (2 * COS_REST), y: (right.y - left.y) / (2 * COS_REST) };
  const vertical = { x: (right.x + left.x) / (2 * SIN_REST), y: (right.y + left.y) / (2 * SIN_REST) };
  const restingBow = -10 * Math.sin(Math.PI * u) * Math.abs(Math.cos(angle));
  return {
    x: 141 + 39 * s + horizontal.x * cosine + vertical.x * sine,
    y: 308 - 73 * s + horizontal.y * cosine + vertical.y * sine + restingBow,
  };
}

function cubic(t: number, a: PagePoint, b: PagePoint, c: PagePoint, d: PagePoint): PagePoint {
  const v = 1 - t;
  return {
    x: v ** 3 * a.x + 3 * v * v * t * b.x + 3 * v * t * t * c.x + t ** 3 * d.x,
    y: v ** 3 * a.y + 3 * v * v * t * b.y + 3 * v * t * t * c.y + t ** 3 * d.y,
  };
}

// The illustration's left sheet is bowed, not a flat quadrilateral. These four
// measured boundaries register the landing with the existing artwork.
function restingLeftPage(s: number, u: number): PagePoint {
  const frontSpine = { x: 141, y: 308 }, backSpine = { x: 180, y: 235 };
  const frontEdge = { x: 44, y: 255 }, backEdge = { x: 90, y: 200 };
  const gutter = { x: 141 + 39 * s, y: 308 - 73 * s };
  const outer = cubic(s, frontEdge, { x: 54, y: 237 }, { x: 73, y: 216 }, backEdge);
  const front = cubic(u, frontSpine, { x: 113, y: 280 }, { x: 83, y: 249 }, frontEdge);
  const back = cubic(u, backSpine, { x: 174, y: 199 }, { x: 124, y: 174 }, backEdge);
  const coordinate = (axis: 'x' | 'y') =>
    (1 - u) * gutter[axis] + u * outer[axis] + (1 - s) * front[axis] + s * back[axis]
    - ((1 - s) * ((1 - u) * frontSpine[axis] + u * frontEdge[axis])
      + s * ((1 - u) * backSpine[axis] + u * backEdge[axis]));
  return { x: coordinate('x'), y: coordinate('y') };
}

export function projectBookPagePoint(alongSpine: number, acrossPage: number, progress: number): PagePoint {
  const point = rotateBookPagePoint(alongSpine, acrossPage, progress);
  // Keep the sweep unchanged; gradually settle onto the curved left sheet.
  const t = Math.max(0, Math.min(1, (progress - .65) / .35));
  if (t === 0) return point;
  const weight = t * t * (3 - 2 * t);
  const flatRest = rotateBookPagePoint(alongSpine, acrossPage, 1);
  const curvedRest = restingLeftPage(alongSpine, acrossPage);
  return { x: point.x + (curvedRest.x - flatRest.x) * weight, y: point.y + (curvedRest.y - flatRest.y) * weight };
}

const pointText = (p: PagePoint) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
const pathThrough = (points: PagePoint[], close = false) => `M${points.map(pointText).join('L')}${close ? 'Z' : ''}`;

export function buildBookPageFrame(progress: number) {
  const grid = Array.from({ length: PAGE_ROWS + 1 }, (_, row) => Array.from({ length: PAGE_COLUMNS + 1 }, (_, column) => projectBookPagePoint(row / PAGE_ROWS, column / PAGE_COLUMNS, progress)));
  const angle = REST_ANGLE + progress * (Math.PI - 2 * REST_ANGLE);
  const patches = [];
  for (let row = 0; row < PAGE_ROWS; row++) for (let column = 0; column < PAGE_COLUMNS; column++) {
    const across = (column + .5) / PAGE_COLUMNS;
    const crease = .12 * Math.exp(-across * 15);
    const shade = .83 + .15 * Math.abs(Math.cos(angle + .28 * (across - .5))) - crease;
    const mix = (dark: number, light: number) => Math.round(dark + (light - dark) * shade);
    patches.push({
      path: pathThrough([grid[row][column], grid[row + 1][column], grid[row + 1][column + 1], grid[row][column + 1]], true),
      fill: `rgb(${mix(172, 255)} ${mix(139, 239)} ${mix(98, 211)})`,
    });
  }
  const perimeter = [grid[0][0], grid[PAGE_ROWS][0], ...grid[PAGE_ROWS].slice(1), ...grid.slice(0, PAGE_ROWS).reverse().map(row => row[PAGE_COLUMNS]), ...grid[0].slice(1, PAGE_COLUMNS).reverse()];
  // Register the lettering too, so revealing the original sheet does not move it.
  const restingInk = [
    [{ x: 134, y: 257 }, { x: 120, y: 244 }, { x: 94, y: 236 }, { x: 79, y: 237 }],
    [{ x: 145, y: 241 }, { x: 130, y: 227 }, { x: 106, y: 222 }, { x: 91, y: 223 }],
    [{ x: 155, y: 224 }, { x: 143, y: 212 }, { x: 120, y: 207 }, { x: 105, y: 208 }],
  ];
  const landing = Math.max(0, Math.min(1, (progress - .65) / .35));
  const weight = landing * landing * (3 - 2 * landing);
  const ink = [.26, .48, .7].map((row, line) => pathThrough(Array.from({ length: 13 }, (_, i) => {
    const u = .15 + i / 12 * .65;
    const point = projectBookPagePoint(row, u, progress);
    const rest = projectBookPagePoint(row, u, 1);
    const target = cubic(i / 12, restingInk[line][0], restingInk[line][1], restingInk[line][2], restingInk[line][3]);
    return { x: point.x + (target.x - rest.x) * weight, y: point.y + (target.y - rest.y) * weight };
  }))).join('');
  return { patches, outline: pathThrough(perimeter, true), ink };
}
