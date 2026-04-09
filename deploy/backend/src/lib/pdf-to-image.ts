/**
 * PDF to Image conversion using mupdf (WASM).
 * Replaces pdftoppm (poppler-utils) which fails on complex PDFs (e.g. Mercado Pago boletos).
 */

import { readFile, writeFile } from "fs/promises";

/**
 * Convert the first page of a PDF to a PNG image file.
 * Uses mupdf for high-fidelity rendering of complex PDFs with embedded fonts.
 */
export async function convertPdfToJpg(pdfPath: string, jpgPath: string, scale: number = 2): Promise<void> {
  console.log(`[pdf-to-image] Converting ${pdfPath} → ${jpgPath} (scale=${scale})`);

  const pdfBuffer = await readFile(pdfPath);

  // Dynamic import for ESM-only mupdf package (bypass TS module resolution)
  const mupdf: any = await (Function('return import("mupdf")')());

  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  const page = doc.loadPage(0);

  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true
  );

  const pngBytes = pixmap.asPNG();
  await writeFile(jpgPath, pngBytes);

  console.log(`[pdf-to-image] ✅ Converted successfully: ${jpgPath} (${pngBytes.length} bytes)`);
}
