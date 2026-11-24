import { useEffect } from "react";
import { useAppFeedback } from "./AppFeedback";

type AlertProps = { type: "error" | "success"; message: string };
export default function Alert({ type, message }: AlertProps) {
  const { showSuccess, showError, clearError } = useAppFeedback();

  useEffect(() => {
    if (type === "success") {
      showSuccess(message);
      return;
    }

    showError(message);
    return () => clearError(message);
  }, [clearError, message, showError, showSuccess, type]);

  return null;
}
