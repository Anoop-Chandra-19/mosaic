import type { PdfRule } from './pdfModel';

/** How many rules a document is read for; drawings past it are not looked at. */
export const MAX_PDF_RULES = 5_000;

/** The thickest a line may be and still be a rule, in points. */
const MAX_RULE_THICKNESS = 3;

/** An affine transform as PDF writes one: [a b c d e f]. */
type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `inner` first, then `outer`: a point goes through both, as the PDF's `cm` stacks them. */
function concatMatrices(outer: Matrix, inner: Matrix): Matrix {
  const [a, b, c, d, e, f] = outer;
  const [p, q, r, s, t, u] = inner;
  return [
    a * p + c * q,
    b * p + d * q,
    a * r + c * s,
    b * r + d * s,
    a * t + c * u + e,
    b * t + d * u + f,
  ];
}

function applyMatrix([a, b, c, d, e, f]: Matrix, x: number, y: number): [number, number] {
  return [a * x + c * y + e, b * x + d * y + f];
}

/** The numbers pdf.js puts in an operator list: its op codes, by name. */
export interface PdfOps {
  save: number;
  restore: number;
  transform: number;
  setLineWidth: number;
  setGState: number;
  constructPath: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
  stroke: number;
  closeStroke: number;
  fill: number;
  eoFill: number;
  fillStroke: number;
  eoFillStroke: number;
  closeFillStroke: number;
  closeEOFillStroke: number;
}

/** pdf.js's path commands inside `constructPath`, with how many numbers each takes. */
const PATH_COMMAND_SIZES = [2, 2, 6, 4, 0]; // moveTo, lineTo, curveTo, quadraticCurveTo, closePath

/** The box a path covers in its own space: [minX, minY, maxX, maxY], or null if empty. */
function boxOfPath(path: ArrayLike<number>): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < path.length; ) {
    const size = PATH_COMMAND_SIZES[path[i]];
    if (size === undefined) return null;
    for (let j = i + 1; j < i + 1 + size; j += 2) {
      minX = Math.min(minX, path[j]);
      maxX = Math.max(maxX, path[j]);
      minY = Math.min(minY, path[j + 1]);
      maxY = Math.max(maxY, path[j + 1]);
    }
    i += 1 + size;
  }
  return minX <= maxX ? [minX, minY, maxX, maxY] : null;
}

interface DrawState {
  matrix: Matrix;
  lineWidth: number;
}

/**
 * The thin horizontal lines a page draws, from pdf.js's operator list: each path that is
 * painted, placed through the transforms in force, and kept when it is much wider than it
 * is tall. `view` is the page's box, `[left, bottom, right, top]`, as pdf.js gives it;
 * rules come back from the page's top-left, like runs. Reads what is drawn, not what it
 * is for — `pdfLines` decides which rules underline words.
 */
export function readPdfRules(
  operators: { fnArray: number[]; argsArray: unknown[] },
  ops: PdfOps,
  view: number[],
  limit = MAX_PDF_RULES
): PdfRule[] {
  const [viewLeft, , , viewTop] = view;
  const painters = new Set([
    ops.stroke,
    ops.closeStroke,
    ops.fill,
    ops.eoFill,
    ops.fillStroke,
    ops.eoFillStroke,
    ops.closeFillStroke,
    ops.closeEOFillStroke,
  ]);
  const strokers = new Set([
    ops.stroke,
    ops.closeStroke,
    ops.fillStroke,
    ops.eoFillStroke,
    ops.closeFillStroke,
    ops.closeEOFillStroke,
  ]);

  const rules: PdfRule[] = [];
  const stack: DrawState[] = [];
  let state: DrawState = { matrix: IDENTITY, lineWidth: 1 };

  for (let i = 0; i < operators.fnArray.length && rules.length < limit; i++) {
    const op = operators.fnArray[i];
    const args = operators.argsArray[i] as unknown[] | null;
    if (op === ops.save) {
      stack.push(state);
    } else if (op === ops.restore) {
      state = stack.pop() ?? state;
    } else if (op === ops.transform && args) {
      state = { ...state, matrix: concatMatrices(state.matrix, args as Matrix) };
    } else if (op === ops.paintFormXObjectBegin) {
      stack.push(state);
      const matrix = args?.[0];
      if (Array.isArray(matrix) && matrix.length === 6) {
        state = { ...state, matrix: concatMatrices(state.matrix, matrix as Matrix) };
      }
    } else if (op === ops.paintFormXObjectEnd) {
      state = stack.pop() ?? state;
    } else if (op === ops.setLineWidth && args) {
      state = { ...state, lineWidth: Number(args[0]) || 0 };
    } else if (op === ops.setGState && args) {
      // A graphics state dictionary can set the line width too: [['LW', 0.5], …].
      for (const entry of (args[0] as unknown[]) ?? []) {
        if (Array.isArray(entry) && entry[0] === 'LW') {
          state = { ...state, lineWidth: Number(entry[1]) || 0 };
        }
      }
    } else if (op === ops.constructPath && args) {
      const [paint, data, given] = args as [number, unknown[] | null, ArrayLike<number> | null];
      if (!painters.has(paint)) continue;
      const path = data?.[0];
      const box =
        given && given.length === 4
          ? ([given[0], given[1], given[2], given[3]] as [number, number, number, number])
          : path && typeof path === 'object' && 'length' in path
            ? boxOfPath(path as ArrayLike<number>)
            : null;
      if (!box) continue;
      const rule = placeRule(box, state, strokers.has(paint));
      if (!rule) continue;
      rules.push({
        left: rule.left - viewLeft,
        right: rule.right - viewLeft,
        top: viewTop - rule.top,
        bottom: viewTop - rule.bottom,
      });
    }
  }
  return rules;
}

/**
 * A path's box on the page, grown by half the pen for a stroke — kept only when it is a
 * thin horizontal line. Coordinates here are PDF space, `top` above `bottom`.
 */
function placeRule(
  [minX, minY, maxX, maxY]: [number, number, number, number],
  { matrix, lineWidth }: DrawState,
  stroked: boolean
) {
  const corners = [
    applyMatrix(matrix, minX, minY),
    applyMatrix(matrix, maxX, minY),
    applyMatrix(matrix, minX, maxY),
    applyMatrix(matrix, maxX, maxY),
  ];
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  // A stroke's pen, measured on the page: the transform scales it too.
  const pen = stroked
    ? (lineWidth || 1) * Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]))
    : 0;
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys) - pen / 2;
  const top = Math.max(...ys) + pen / 2;
  const width = right - left;
  const thickness = top - bottom;
  if (thickness <= 0 || thickness > MAX_RULE_THICKNESS || width < thickness * 4) return null;
  return { left, right, top, bottom };
}
