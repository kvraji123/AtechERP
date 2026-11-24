import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type OnlyOfficeEditorConfig = {
  documentType: "cell";
  type: "desktop" | "mobile" | "embedded";
  document: {
    fileType: "xlsx";
    key: string;
    title: string;
    url: string;
  };
  editorConfig: {
    callbackUrl: string;
    lang: string;
    mode: "edit" | "view";
    user: { id: string; name: string };
    customization?: Record<string, unknown>;
  };
  token: string;
};

type OnlyOfficeEditorInstance = {
  destroyEditor?: () => void;
};

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (elementId: string, config: unknown) => OnlyOfficeEditorInstance;
    };
  }
}

const documentApiLoads = new Map<string, Promise<void>>();

function documentApiUrl(documentServerUrl: string) {
  return `${documentServerUrl.replace(/\/$/, "")}/web-apps/apps/api/documents/api.js`;
}

function loadDocumentApi(documentServerUrl: string) {
  const url = documentApiUrl(documentServerUrl);
  const existing = documentApiLoads.get(url);
  if (existing) return existing;

  const load = new Promise<void>((resolve, reject) => {
    if (window.DocsAPI?.DocEditor) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => window.DocsAPI?.DocEditor
      ? resolve()
      : reject(new Error("ONLYOFFICE loaded without its document editor API."));
    script.onerror = () => reject(new Error("The ONLYOFFICE Document Server could not be reached."));
    document.head.appendChild(script);
  });
  documentApiLoads.set(url, load);
  return load;
}

export default function OnlyOfficeToolListEditor({
  documentServerUrl,
  config,
  onClose,
  onSaved,
}: {
  documentServerUrl: string;
  config: OnlyOfficeEditorConfig;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const elementId = useRef(`tool-list-editor-${Math.random().toString(36).slice(2)}`);
  const onSavedRef = useRef(onSaved);
  const documentWasDirty = useRef(false);
  const [status, setStatus] = useState("Loading spreadsheet editor…");
  const [error, setError] = useState("");

  onSavedRef.current = onSaved;

  useEffect(() => {
    let disposed = false;
    let editor: OnlyOfficeEditorInstance | null = null;
    documentWasDirty.current = false;

    void loadDocumentApi(documentServerUrl)
      .then(() => {
        if (disposed || !window.DocsAPI?.DocEditor) return;
        const editorConfig = {
          ...config,
          events: {
            onAppReady: () => {
              if (!disposed) setStatus("Edit the Tool List here. Changes save back to this operation.");
            },
            onDocumentStateChange: (event: { data?: boolean }) => {
              if (event.data) {
                documentWasDirty.current = true;
                if (!disposed) setStatus("Saving changes…");
              } else if (documentWasDirty.current) {
                documentWasDirty.current = false;
                if (!disposed) setStatus("Saved to this operation.");
                window.setTimeout(() => onSavedRef.current?.(), 800);
              }
            },
            onError: (event: { data?: { errorDescription?: string } }) => {
              if (!disposed) setError(event.data?.errorDescription || "ONLYOFFICE could not save this Tool List.");
            },
          },
        };
        editor = new window.DocsAPI.DocEditor(elementId.current, editorConfig);
      })
      .catch((loadError: unknown) => {
        if (!disposed) setError(loadError instanceof Error ? loadError.message : "Unable to load the spreadsheet editor.");
      });

    return () => {
      disposed = true;
      editor?.destroyEditor?.();
    };
  }, [config, documentServerUrl]);

  return <div className="onlyoffice-tool-list-overlay" role="dialog" aria-modal="true" aria-labelledby="onlyoffice-tool-list-title">
    <section className="onlyoffice-tool-list-dialog">
      <header>
        <div><h3 id="onlyoffice-tool-list-title">Tool List — {config.document.title}</h3><p>{error || status}</p></div>
        <button type="button" onClick={onClose} aria-label="Close Tool List editor"><X size={19}/></button>
      </header>
      {error
        ? <div className="onlyoffice-tool-list-error"><p>{error}</p><button type="button" className="secondary-action-button" onClick={onClose}>Close</button></div>
        : <div id={elementId.current} className="onlyoffice-tool-list-frame"/>}
    </section>
  </div>;
}
