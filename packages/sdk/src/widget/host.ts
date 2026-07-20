import { openSubmitModal, type SubmitWidgetContext } from "./modal";
import { WIDGET_STYLES } from "./styles";

export interface WidgetHostOptions extends SubmitWidgetContext {
  hotkey?: string;
  showFloatingButton?: boolean;
}

export interface WidgetHost {
  destroy: () => void;
  open: () => void;
}

export function mountSubmitWidget(options: WidgetHostOptions): WidgetHost {
  const {
    apiBaseUrl,
    hotkey = "Shift+Alt+B",
    onComplete,
    showFloatingButton = true,
  } = options;

  let fabHost: HTMLDivElement | null = null;
  let closeModal: (() => void) | null = null;

  const open = () => {
    closeModal?.();
    closeModal = openSubmitModal({ apiBaseUrl, onComplete });
  };

  if (showFloatingButton) {
    fabHost = document.createElement("div");
    fabHost.setAttribute("data-usebugreport-widget", "fab");
    const shadow = fabHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = WIDGET_STYLES;
    shadow.append(style);
    const button = document.createElement("button");
    button.className = "fab";
    button.type = "button";
    button.title = "Report a bug";
    button.setAttribute("aria-label", "Report a bug");
    button.textContent = "!";
    button.addEventListener("click", open);
    shadow.append(button);
    document.body.append(fabHost);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (eventToHotkey(event) === normalizeHotkey(hotkey)) {
      event.preventDefault();
      open();
    }
  };

  window.addEventListener("keydown", onKeyDown);

  return {
    destroy: () => {
      window.removeEventListener("keydown", onKeyDown);
      closeModal?.();
      fabHost?.remove();
      fabHost = null;
    },
    open,
  };
}

function normalizeHotkey(value: string): string {
  return value
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .join("+");
}

function eventToHotkey(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push("ctrl");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  if (event.metaKey) {
    parts.push("meta");
  }
  parts.push(event.key.toLowerCase());
  return parts.join("+");
}
