import { useEffect } from "react";

function isEditableNumberInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement
    && target.type === "number"
    && !target.disabled
    && !target.readOnly;
}

/**
 * Keeps native numeric inputs keyboard-editable while preventing accidental
 * value changes caused by a mouse wheel, touchpad scroll, or the arrow keys.
 */
export default function NumericInputBehavior() {
  useEffect(() => {
    const preventArrowStep = (event: KeyboardEvent) => {
      if (
        isEditableNumberInput(event.target)
        && (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
      }
    };

    const releaseNumberInputBeforeScroll = (event: WheelEvent) => {
      const activeElement = document.activeElement;
      if (isEditableNumberInput(activeElement) && event.target === activeElement) {
        activeElement.blur();
      }
    };

    document.addEventListener("keydown", preventArrowStep, true);
    document.addEventListener("wheel", releaseNumberInputBeforeScroll, true);

    return () => {
      document.removeEventListener("keydown", preventArrowStep, true);
      document.removeEventListener("wheel", releaseNumberInputBeforeScroll, true);
    };
  }, []);

  return null;
}
