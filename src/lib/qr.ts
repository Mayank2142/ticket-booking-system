import QRCode from "qrcode";

export async function bookingQrDataUrl(bookingRef: string) {
  return QRCode.toDataURL(bookingRef, { margin: 1, width: 256 });
}
