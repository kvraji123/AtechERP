import { useEffect } from "react";
import { useAppFeedback } from "./AppFeedback";

type AlertProps = { type: "error" | "success"; message: string };
export default function Alert({ type, message }: AlertProps) {
  const { showSuccess } = useAppFeedback();

  useEffect(() => {
    if (type === "success") {
      showSuccess(message);
    }
  }, [message, showSuccess, type]);

  if (type === "success") return null;
  return <div className={`marketing-form-alert ${type}`}>{message}</div>;
}
