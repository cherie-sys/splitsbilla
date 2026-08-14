interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// A real in-app confirmation, used instead of window.confirm() — native JS
// dialogs are silently blocked (or auto-rejected) by many mobile browsers and
// embedded/in-app webviews, which made "Start afresh" and friends do nothing.
export default function ConfirmDialog({ message, confirmLabel = 'Confirm', onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
