export const WIDGET_STYLES = `
:host {
  all: initial;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 14, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483000;
}

.panel {
  width: min(420px, calc(100vw - 32px));
  background: #12151c;
  color: #e8eaef;
  border: 1px solid #2a3140;
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.panel h2 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.field label {
  font-size: 12px;
  color: #aab2c0;
}

.field input,
.field textarea {
  background: #0c0f14;
  border: 1px solid #303848;
  border-radius: 8px;
  color: #f3f5f9;
  padding: 10px 12px;
  font-size: 14px;
}

.field textarea {
  min-height: 96px;
  resize: vertical;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

button {
  border: 0;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  cursor: pointer;
}

button.primary {
  background: #5b8cff;
  color: #08111f;
  font-weight: 600;
}

button.secondary {
  background: #242a36;
  color: #e8eaef;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 8px;
  color: #ff8f8f;
  font-size: 13px;
  line-height: 1.4;
}

.fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  border: 0;
  background: #5b8cff;
  color: #08111f;
  font-size: 22px;
  font-weight: 700;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  z-index: 2147482000;
}
`.trim();
