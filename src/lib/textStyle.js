const HEX = /^#[0-9a-f]{6}$/i;

export const TEXT_COLORS = ['#e25555', '#e08a28', '#c8a014', '#3e9a68', '#299c9c', '#4c83dc', '#8664d7', '#c45aa0'];

/** Keep saved title styling small, safe and independent from the UI. */
export function normalizeTextStyle(value) {
  const style = value && typeof value === 'object' ? value : {};
  return {
    color: typeof style.color === 'string' && HEX.test(style.color) ? style.color : null,
    filled: Boolean(style.filled),
    bold: Boolean(style.bold),
    italic: Boolean(style.italic),
    underline: Boolean(style.underline),
    size: Number.isFinite(style.size) ? Math.max(11, Math.min(32, Math.round(style.size))) : null,
  };
}

/** Props shared by every rendered title, whether it is a project or task. */
export function textStyleProps(value) {
  const style = normalizeTextStyle(value);
  const css = {};
  if (style.color) css.color = style.color;
  if (style.size) css.fontSize = `${style.size}px`;
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = 'italic';
  if (style.underline) css.textDecoration = 'underline';
  if (style.color) css['--title-style-color'] = style.color;
  return {
    className: style.filled ? 'text-capsule' : '',
    style: Object.keys(css).length ? css : undefined,
  };
}
