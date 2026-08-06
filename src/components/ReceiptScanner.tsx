import { useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { parseReceiptText, type ParsedReceipt } from '../lib/parseReceipt';
import { compressImage } from '../lib/image';

interface Props {
  onScanned: (result: ParsedReceipt, imageDataUrl: string) => void;
}

export default function ReceiptScanner({ onScanned }: Props) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setProgress(0);

    try {
      const [worker, imageDataUrl] = await Promise.all([
        createWorker('eng', undefined, {
          logger: (m) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              setProgress(Math.round(m.progress * 100));
            }
          },
        }),
        compressImage(file),
      ]);
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const parsed = parseReceiptText(data.text);
      onScanned(parsed, imageDataUrl);
    } catch (err) {
      setError('Could not read that image. Try a clearer, well-lit photo, or add items manually below.');
      console.error(err);
    } finally {
      setProgress(null);
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div className="scanner">
      <div className="scanner-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => inputRef.current?.click()}
        >
          Scan receipt
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {preview && (
        <div className="scanner-preview">
          <img src={preview} alt="Receipt preview" />
        </div>
      )}

      {progress !== null && (
        <div className="scanner-progress">
          <div className="scanner-progress-bar" style={{ width: `${progress}%` }} />
          <span>Reading receipt… {progress}%</span>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
