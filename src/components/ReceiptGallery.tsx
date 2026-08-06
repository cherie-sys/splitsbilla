import { useState } from 'react';
import type { ReceiptImage } from '../types';

interface Props {
  images: ReceiptImage[];
}

export default function ReceiptGallery({ images }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = images.find((img) => img.id === openId) ?? null;

  if (images.length === 0) return null;

  return (
    <div className="receipt-gallery">
      <h3>Scanned receipts</h3>
      <div className="receipt-thumbs">
        {images.map((img) => (
          <button
            type="button"
            key={img.id}
            className="receipt-thumb"
            onClick={() => setOpenId(img.id)}
          >
            <img src={img.dataUrl} alt={img.label} />
            <span className="receipt-thumb-label">{img.label}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="receipt-modal-backdrop" onClick={() => setOpenId(null)}>
          <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-modal-header">
              <span>{open.label}</span>
              <button type="button" className="icon-btn" onClick={() => setOpenId(null)} aria-label="Close">
                ×
              </button>
            </div>
            <img src={open.dataUrl} alt={open.label} />
            <p className="hint">
              {open.itemsAdded} item{open.itemsAdded === 1 ? '' : 's'} added
              {open.duplicatesSkipped > 0
                ? `, ${open.duplicatesSkipped} duplicate${open.duplicatesSkipped === 1 ? '' : 's'} skipped`
                : ''}
              .
            </p>
            {open.rawText && (
              <details className="raw-text-details">
                <summary>View raw scanned text</summary>
                <p className="hint">
                  Compare this against the photo above to see exactly what OCR read — useful for
                  spotting a missed or misread line.
                </p>
                <pre className="raw-text-block">{open.rawText}</pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
