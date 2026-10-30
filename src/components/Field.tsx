import { useEffect, useState, useId } from "react";
export function Field({
  label,
  value,
  onChange,
  unit = "",
  min,
  max,
  step = 0.1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  const [text, setText] = useState(String(Number(value.toFixed(4))));
  const hintId = useId();
  useEffect(() => setText(String(Number(value.toFixed(4)))), [value]);
  const commit = () => {
    const n = Number(text);
    if (
      text.trim() !== "" &&
      Number.isFinite(n) &&
      (min === undefined || n >= min) &&
      (max === undefined || n <= max)
    )
      onChange(n);
    else setText(String(Number(value.toFixed(4))));
  };
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          aria-describedby={hint ? hintId : undefined}
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <em>{unit}</em>
      </div>
      {hint && (
        <small id={hintId} className="field-input-help">
          {hint}
        </small>
      )}
    </label>
  );
}
export function Slider({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 0.01,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit: string;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div className="slider-field" title={hint}>
      <div>
        <span>{label}</span>
        <b>
          {Number(value.toFixed(3))}
          <em>{unit}</em>
        </b>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="range-ends">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}
