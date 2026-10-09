import { useEffect, useId, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

// Native date pickers can accept six-digit years when typed. Constrain them consistently.
export default function DateInput({ type = "date", min, max, onChange, onInput, onBlur, value, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [error, setError] = useState("");
  const minimum = String(min || (type === "datetime-local" ? "1000-01-01T00:00" : "1000-01-01"));
  const maximum = String(max || (type === "datetime-local" ? "9999-12-31T23:59" : "9999-12-31"));
  const validate = (element: HTMLInputElement, show = false) => {
    element.setCustomValidity("");
    let message = "";
    if (element.validity.badInput || (element.value && !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/.test(element.value))) {
      message = "Enter a valid date with a four-digit year.";
    } else if (element.validity.rangeUnderflow || element.validity.rangeOverflow) {
      message = `Enter a date between ${minimum.replace('T', ' ')} and ${maximum.replace('T', ' ')}.`;
    }
    element.setCustomValidity(message);
    setError(message);
    if (show && message) element.reportValidity();
    return !message;
  };
  useEffect(() => { if (input.current) validate(input.current); }, [value, minimum, maximum]);
  return <><input {...props} ref={input} type={type} value={value} min={minimum} max={maximum} data-validated-date="true"
    aria-invalid={error ? true : undefined} aria-describedby={error ? `${props['aria-describedby'] || ''} ${id}`.trim() : props['aria-describedby']}
    onInput={event => { validate(event.currentTarget); onChange?.(event as ChangeEvent<HTMLInputElement>); onInput?.(event); }}
    onChange={event => { validate(event.currentTarget); onChange?.(event); }}
    onBlur={event => { validate(event.currentTarget, true); onBlur?.(event); }} />
    {error && <small id={id} role="alert" className="date-validation-error">{error}</small>}</>;
}

export function validateVisibleDates() {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[data-validated-date="true"]');
  for (const input of inputs) {
    if (input.disabled || input.readOnly || !input.getClientRects().length) continue;
    // Requiredness stays with each form's existing draft/submit rules.
    if (input.validity.badInput || input.validity.customError || input.validity.rangeOverflow || input.validity.rangeUnderflow) {
      input.reportValidity(); input.focus();
      return false;
    }
  }
  return true;
}

export function DateValidationBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const guard = (event: Event) => {
      const button = event.target instanceof Element ? event.target.closest('button, input[type="submit"]') : null;
      if (event.type !== 'submit' && (!button || !/\b(save|submit|create|update|approve|complete|post|send|generate|confirm)\b/i.test(button.textContent || button.getAttribute('value') || ''))) return;
      if (!validateVisibleDates()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    document.addEventListener('submit', guard, true);
    document.addEventListener('click', guard, true);
    return () => { document.removeEventListener('submit', guard, true); document.removeEventListener('click', guard, true); };
  }, []);
  return <>{children}</>;
}
