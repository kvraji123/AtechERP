import { ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import "./TransportModeMultiSelect.css";

type Option = { value: string; label: string };

type TransportModeMultiSelectProps = {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
};

export default function TransportModeMultiSelect({ options, value, onChange, disabled = false }: TransportModeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);
  const labelFor = (mode: string) => options.find((option) => option.value === mode)?.label || mode;

  const toggle = (mode: string, closeMenu = false) => {
    onChange(selected.has(mode) ? value.filter((entry) => entry !== mode) : [...value, mode]);
    if (closeMenu) setOpen(false);
  };

  return <div className="transport-mode-select">
    <button type="button" className="transport-mode-select__control" disabled={disabled} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className="transport-mode-select__chips">{value.length ? value.map((mode) => <span className="transport-mode-select__chip" key={mode}>{labelFor(mode)}<span role="button" tabIndex={0} aria-label={`Remove ${labelFor(mode)}`} onClick={(event) => { event.stopPropagation(); toggle(mode); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); toggle(mode); } }}><X size={13}/></span></span>) : <span className="transport-mode-select__placeholder">Select one or more transport modes</span>}</span>
      <ChevronDown size={17}/>
    </button>
    {open && <div className="transport-mode-select__menu" role="group" aria-label="Allowed transport modes">{options.length ? options.map((option) => <label key={option.value} className="transport-mode-select__option"><input type="checkbox" checked={selected.has(option.value)} onChange={() => toggle(option.value, true)} /><span>{option.label}</span></label>) : <p>No active transport modes are available.</p>}</div>}
  </div>;
}
