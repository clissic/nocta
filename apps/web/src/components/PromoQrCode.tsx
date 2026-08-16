import { useEffect, useState } from "react";

type PromoQrCodeProps = {
  payload: string;
  size?: number;
  className?: string;
};

/** QR en data-URL (blanco sobre fondo oscuro de la card). */
export function PromoQrCode({
  payload,
  size = 220,
  className = "",
}: PromoQrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setSrc(null);

    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(payload, {
          width: size,
          margin: 2,
          color: { dark: "#0a0a0b", light: "#ffffff" },
          errorCorrectionLevel: "M",
        })
      )
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });

    return () => {
      alive = false;
    };
  }, [payload, size]);

  if (failed) {
    return (
      <p className="text-secondary small mb-0">
        No se pudo generar el QR. Mostrá este código en puerta:{" "}
        <code className="user-select-all">{payload}</code>
      </p>
    );
  }

  if (!src) {
    return (
      <div
        className={`promo-qr-skeleton${className ? ` ${className}` : ""}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      className={`promo-qr-image${className ? ` ${className}` : ""}`}
      src={src}
      alt="Código QR de la promoción"
      width={size}
      height={size}
    />
  );
}
