import { useState } from 'react';
import { Bold, Italic, Palette, Underline } from 'lucide-react';
import { openMenu } from '../store';
import { TEXT_COLORS, normalizeTextStyle } from '../lib/textStyle';
import { rectOf } from './MenuLayer';

function Toggle({ active, label, icon: Icon, onClick }) {
  return (
    <button type="button" className={`text-style-toggle${active ? ' on' : ''}`} aria-pressed={active} title={label} onClick={onClick}>
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

export function TextStylePopover({ value, onChange, initialPanel = null, showAll = false }) {
  const [style, setStyle] = useState(() => normalizeTextStyle(value));
  const [panel, setPanel] = useState(initialPanel);
  const set = (patch) => {
    const next = { ...style, ...patch };
    setStyle(next);
    onChange(next);
  };
  return (
    <div className={`text-style-popover${showAll ? ' text-style-popover-full' : ''}`} aria-label="Text style">
      {!initialPanel && !showAll && <TextStyleControls value={style} onChange={set} activePanel={panel} onPanel={setPanel} />}
      {(showAll || panel === 'color') && (
        <div className={showAll ? 'text-style-popup-row' : ''}>
          {showAll && <span>Color</span>}
          <div className="text-style-swatches" aria-label="Text color">
            <button
              type="button"
              className={`text-style-color none${!style.color ? ' on' : ''}`}
              title="Default color"
              aria-label="Default color"
              onClick={() => set({ color: null })}
            >A</button>
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`text-style-color${style.color === color ? ' on' : ''}`}
                style={{ '--swatch': color }}
                aria-label={`Use ${color}`}
                aria-pressed={style.color === color}
                onClick={() => set({ color })}
              />
            ))}
            <label className="text-style-custom" title="Choose any color">
              <Palette size={13} strokeWidth={2} />
              <input type="color" value={style.color || '#64748b'} onChange={(e) => set({ color: e.target.value })} />
            </label>
          </div>
        </div>
      )}
      {(showAll || panel === 'style') && (
        <div className={showAll ? 'text-style-popup-row' : ''}>
          {showAll && <span>Style</span>}
          <div className="text-style-toggles" aria-label="Text style">
            <Toggle active={style.bold} label="Bold" icon={Bold} onClick={() => set({ bold: !style.bold })} />
            <Toggle active={style.italic} label="Italic" icon={Italic} onClick={() => set({ italic: !style.italic })} />
            <Toggle active={style.underline} label="Underline" icon={Underline} onClick={() => set({ underline: !style.underline })} />
          </div>
        </div>
      )}
      {(showAll || panel === 'size') && (
        <div className={showAll ? 'text-style-popup-row' : ''}>
          {showAll && <span>Size</span>}
          <label className="text-style-size">
            <input type="number" min="11" max="32" value={style.size || ''} placeholder="Default" onChange={(e) => set({ size: e.target.value === '' ? null : Number(e.target.value) })} /> px
          </label>
        </div>
      )}
      {showAll && <div className="text-style-popup-row"><span>Capsule fill</span><CapsuleToggle style={style} onChange={set} /></div>}
    </div>
  );
}

/** A shared trigger that anchors its style controls beside the title. */
export function TextStyleButton({ value, onChange, label = 'Text style', className = '', panel = null, kind = 'color', showAll = false }) {
  const Icon = kind === 'style' ? Bold : Palette;
  return (
    <button
      type="button"
      className={`icon-btn sm text-style-button ${className}`.trim()}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        openMenu({
          kind: 'popover',
          rect: rectOf(e.currentTarget),
          render: () => <TextStylePopover value={value} onChange={onChange} initialPanel={panel} showAll={showAll} />,
        });
      }}
    >
      {kind === 'size' ? <span className="text-style-size-glyph">A+</span> : <Icon size={14} strokeWidth={1.9} />}
    </button>
  );
}

function TextStyleAllButton({ value, onChange }) {
  return (
    <button
      type="button"
      className="text-style-all-button"
      title="All text style controls"
      onClick={(e) => {
        e.stopPropagation();
        openMenu({
          kind: 'popover',
          rect: rectOf(e.currentTarget),
          render: () => <TextStylePopover value={value} onChange={onChange} showAll />,
        });
      }}
    >
      Style
    </button>
  );
}

/** Clean inline controls for the detail panel: each icon opens only its own tool. */
export function TextStyleControls({ value, onChange, activePanel, onPanel }) {
  const style = normalizeTextStyle(value);
  if (onPanel) {
    return (
      <div className="text-style-toolbar">
        <button type="button" className={`text-style-tool${activePanel === 'color' ? ' on' : ''}`} title="Text color" aria-label="Text color" onClick={() => onPanel(activePanel === 'color' ? null : 'color')}><Palette size={15} strokeWidth={1.9} /></button>
        <button type="button" className={`text-style-tool${activePanel === 'style' ? ' on' : ''}`} title="Text style" aria-label="Text style" onClick={() => onPanel(activePanel === 'style' ? null : 'style')}><Bold size={15} strokeWidth={2} /></button>
        <button type="button" className={`text-style-tool${activePanel === 'size' ? ' on' : ''}`} title="Text size" aria-label="Text size" onClick={() => onPanel(activePanel === 'size' ? null : 'size')}><span className="text-style-size-glyph">A+</span></button>
        <CapsuleToggle style={style} onChange={onChange} />
      </div>
    );
  }
  return (
    <div className="text-style-inline" aria-label="Text style controls">
      <TextStyleAllButton value={value} onChange={onChange} />
      <TextStyleButton value={value} onChange={onChange} panel="color" label="Text color" />
      <TextStyleButton value={value} onChange={onChange} panel="style" kind="style" label="Text style" />
      <TextStyleButton value={value} onChange={onChange} panel="size" kind="size" label="Text size" />
      <CapsuleToggle style={style} onChange={onChange} />
    </div>
  );
}

function CapsuleToggle({ style, onChange }) {
  return (
    <button
      type="button"
      className={`text-style-switch${style.filled ? ' on' : ''}`}
      role="switch"
      aria-checked={style.filled}
      aria-label="Capsule fill"
      title="Capsule fill"
      onClick={() => onChange({ ...style, filled: !style.filled })}
    ><span /></button>
  );
}
