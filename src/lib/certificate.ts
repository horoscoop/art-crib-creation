import jsPDF from "jspdf";
import QRCode from "qrcode";

export async function generateCertificatePdf(opts: {
  title: string;
  artist?: string | null;
  nfcId: string;
  koaSystem?: string | null;
  installDate?: string | null;
  baseUrl: string;
}): Promise<Blob> {
  const url = `${opts.baseUrl}/trace/${opts.nfcId}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 400 });

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("KOA TRACE · CERTIFICAT D'IDENTITÉ", 20, 20);
  doc.setLineWidth(0.2);
  doc.line(20, 23, 190, 23);

  // Title
  doc.setFontSize(22);
  doc.text(opts.title, 20, 45);
  if (opts.artist) {
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(opts.artist, 20, 53);
    doc.setTextColor(0);
  }

  // Meta
  doc.setFontSize(9);
  let y = 75;
  const row = (k: string, v: string) => {
    doc.setTextColor(120);
    doc.text(k.toUpperCase(), 20, y);
    doc.setTextColor(0);
    doc.text(v, 70, y);
    y += 7;
  };
  row("Identifiant NFC", opts.nfcId);
  row("Système KOA", opts.koaSystem ?? "—");
  row("Date d'installation", opts.installDate ?? "—");
  row("Émis le", new Date().toLocaleDateString("fr-FR"));

  // QR code
  doc.addImage(qrDataUrl, "PNG", 130, 70, 50, 50);
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Scannez pour vérifier", 142, 124);

  // Footer
  doc.setTextColor(0);
  doc.setFontSize(7);
  doc.text(url, 20, 270);
  doc.text("Registre vérifiable — chaîne SHA-256 append-only", 20, 275);

  return doc.output("blob");
}
