import "server-only";
import QRCode from "qrcode";

export const QR_PREFIX = "SMASHPOINT:";

/** SVG markup for a student's check-in QR code (payload is an opaque, rotatable token). */
export async function studentQrSvg(qrToken: string) {
  return QRCode.toString(`${QR_PREFIX}${qrToken}`, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0b0b0f", light: "#ffffff" },
  });
}
