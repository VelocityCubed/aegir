import { useEffect, useRef, useState } from "react";
/** Keep typing local; commit one edit on blur/Enter rather than saving each key. */
export function CommitText({
  value,
  label,
  onCommit,
  maxLength,
  multiline = false,
  rows = 3,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => Promise<void>;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
}) {
  const [text, setText] = useState(value);
  const editing = useRef(false),
    current = useRef(value),
    cancelled = useRef(false);
  current.current = value;
  useEffect(() => {
    if (!editing.current) setText(value);
  }, [value]);
  const props = {
    "aria-label": label,
    value: text,
    maxLength,
    onFocus: () => {
      editing.current = true;
      cancelled.current = false;
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setText(e.target.value),
    onBlur: async () => {
      editing.current = false;
      if (cancelled.current) return;
      if (text !== current.current)
        try {
          await onCommit(text);
        } catch {
          setText(current.current);
        }
    },
    onKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (e.key === "Escape") {
        cancelled.current = true;
        setText(current.current);
        e.currentTarget.blur();
      } else if (e.key === "Enter" && !multiline) e.currentTarget.blur();
    },
  };
  return multiline ? <textarea {...props} rows={rows} /> : <input {...props} />;
}
