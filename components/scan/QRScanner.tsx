"use client";

import { useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onScan: (decoded: string) => void;
  onError?: (message: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 260,
          height: 260,
        },
        rememberLastUsedCamera: true,
      },
      false,
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
      },
      (scanError) => {
        if (onError) {
          onError(scanError);
        }
      },
    );

    return () => {
      void scanner.clear();
    };
  }, [onScan, onError]);

  return <div id="qr-reader" className="qr-shell" />;
}
