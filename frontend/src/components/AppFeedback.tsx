import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Trash2,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmationState = Required<ConfirmOptions> & {
  tone: "danger" | "primary";
  resolve: (confirmed: boolean) => void;
};

type AppFeedbackValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  clearError: (message?: string) => void;
  confirmDelete: (options: ConfirmOptions | string) => Promise<boolean>;
  confirmAction: (options: ConfirmOptions | string) => Promise<boolean>;
};

const AppFeedbackContext = createContext<AppFeedbackValue | null>(null);

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmation, setConfirmation] =
    useState<ConfirmationState | null>(null);
  const successTimer = useRef<number | null>(null);

  const showSuccess = useCallback((message: string) => {
    if (successTimer.current !== null) {
      window.clearTimeout(successTimer.current);
    }

    setSuccessMessage(message);
    successTimer.current = window.setTimeout(() => {
      setSuccessMessage("");
      successTimer.current = null;
    }, 2400);
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const clearError = useCallback((message?: string) => {
    setErrorMessage((current) => !message || current === message ? "" : current);
  }, []);

  const confirmDelete = useCallback(
    (options: ConfirmOptions | string) =>
      new Promise<boolean>((resolve) => {
        const normalized =
          typeof options === "string" ? { message: options } : options;

        setConfirmation((current) => {
          current?.resolve(false);
          return {
            title: normalized.title || "Confirm deletion",
            message: normalized.message,
            confirmLabel: normalized.confirmLabel || "Delete",
            cancelLabel: normalized.cancelLabel || "Cancel",
            tone: "danger",
            resolve,
          };
        });
      }),
    []
  );

  const confirmAction = useCallback(
    (options: ConfirmOptions | string) =>
      new Promise<boolean>((resolve) => {
        const normalized =
          typeof options === "string" ? { message: options } : options;

        setConfirmation((current) => {
          current?.resolve(false);
          return {
            title: normalized.title || "Continue?",
            message: normalized.message,
            confirmLabel: normalized.confirmLabel || "Continue",
            cancelLabel: normalized.cancelLabel || "Stay Here",
            tone: "primary",
            resolve,
          };
        });
      }),
    []
  );

  const closeConfirmation = useCallback((confirmed: boolean) => {
    setConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  useEffect(
    () => () => {
      if (successTimer.current !== null) {
        window.clearTimeout(successTimer.current);
      }
      confirmation?.resolve(false);
    },
    [confirmation]
  );

  const value = useMemo(
    () => ({ showSuccess, showError, clearError, confirmDelete, confirmAction }),
    [clearError, confirmAction, confirmDelete, showError, showSuccess]
  );

  return (
    <AppFeedbackContext.Provider value={value}>
      {children}

      {successMessage && (
        <div
          className="app-success-popup-layer"
          role="status"
          aria-live="polite"
        >
          <div className="app-success-popup">
            <CheckCircle2 size={30} />
            <div>
              <strong>Success</strong>
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              aria-label="Close success notification"
              onClick={() => setSuccessMessage("")}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          className="app-error-banner-layer"
          role="alert"
          aria-live="assertive"
        >
          <div className="app-error-banner">
            <AlertTriangle size={20} />
            <div>
              <strong>Unable to continue</strong>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              aria-label="Close error notification"
              onClick={() => clearError()}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      {confirmation && (
        <div
          className="app-confirm-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeConfirmation(false);
            }
          }}
        >
          <section
            className="app-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-confirm-title"
            aria-describedby="app-confirm-message"
          >
            <div className={`app-confirm-icon ${confirmation.tone}`}>
              {confirmation.tone === "danger"
                ? <AlertTriangle size={25} />
                : <CheckCircle2 size={25} />}
            </div>
            <div className="app-confirm-copy">
              <h2 id="app-confirm-title">{confirmation.title}</h2>
              <p id="app-confirm-message">{confirmation.message}</p>
            </div>
            <div className="app-confirm-actions">
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => closeConfirmation(false)}
              >
                {confirmation.cancelLabel}
              </button>
              <button
                type="button"
                className={confirmation.tone === "danger"
                  ? "app-confirm-delete-button"
                  : "app-confirm-primary-button"}
                autoFocus
                onClick={() => closeConfirmation(true)}
              >
                {confirmation.tone === "danger"
                  ? <Trash2 size={16} />
                  : <ArrowRight size={16} />}
                {confirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppFeedbackContext.Provider>
  );
}

export function useAppFeedback() {
  const context = useContext(AppFeedbackContext);
  if (!context) {
    throw new Error("useAppFeedback must be used within AppFeedbackProvider.");
  }
  return context;
}
