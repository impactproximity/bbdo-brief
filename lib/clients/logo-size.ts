/**
 * Intrinsic pixel dimensions of a logo, read from the image's own header.
 *
 * WHY THIS IS NEEDED AT ALL. A hand-authored client sets logoWidth/logoHeight by eye — P&O
 * is 38x35 because its mark is nearly square, while the others are wide and take the ~100x26
 * default. A brand synced from Pulse has nobody to do that: we receive bytes with no
 * declared display size, and whatever aspect ratio the brand happens to use. Applying the
 * wide default to a square mark does not fail, it just renders a visibly squashed logo in
 * the .docx header of every brief for that brand — the kind of defect that ships because
 * nothing errors.
 *
 * So the ratio is read from the bytes and scaled to fit a fixed box.
 *
 * DELIBERATELY NOT A DEPENDENCY. image-size and sharp both do this, and both are a new
 * package in the deploy for four header reads. These four formats are the ones Pulse's blob
 * container actually serves (their logo route declares image/png, image/jpeg, image/webp,
 * image/svg+xml). Anything unrecognised returns null and the caller keeps today's default,
 * so the failure mode is "sized as before", never a throw.
 */

export interface Dimensions {
  width: number;
  height: number;
}

/** The .docx header box a client logo is fitted into. Matches the existing ~100x26 default. */
export const LOGO_BOX = { width: 100, height: 30 } as const;

function pngSize(b: Buffer): Dimensions | null {
  // \x89PNG\r\n\x1a\n then a 4-byte length and the 'IHDR' chunk type; width and height are
  // the first two big-endian uint32s of IHDR's data.
  if (b.length < 24) return null;
  if (b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function jpegSize(b: Buffer): Dimensions | null {
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      // Not on a marker boundary — a malformed or progressive-with-padding file. Give up
      // rather than scan heuristically for something that looks like a size.
      return null;
    }
    const marker = b[offset + 1];

    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = b.readUInt16BE(offset + 2);

    // Any Start-Of-Frame: baseline, extended, progressive, lossless, and the arithmetic
    // variants. 0xC4 (DHT), 0xC8 (JPG) and 0xCC (DAC) sit in the same range and are not SOF.
    const isSOF =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      // SOF payload: precision (1 byte), height (2), width (2).
      return { height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }
  return null;
}

function gifSize(b: Buffer): Dimensions | null {
  if (b.length < 10) return null;
  const magic = b.toString('ascii', 0, 6);
  if (magic !== 'GIF87a' && magic !== 'GIF89a') return null;
  // Logical screen descriptor, little-endian.
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function webpSize(b: Buffer): Dimensions | null {
  if (b.length < 30) return null;
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;

  const chunk = b.toString('ascii', 12, 16);

  // Extended format: a 24-bit canvas size, stored minus one.
  if (chunk === 'VP8X') {
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width, height };
  }

  // Simple lossy: the VP8 keyframe header, 14 bits each.
  if (chunk === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }

  // Lossless: 14 bits each, bit-packed across bytes 21-24 after the signature byte.
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }

  return null;
}

/** Dimensions from the bytes, or null when the format is not one of the four handled. */
export function imageDimensions(buffer: Buffer): Dimensions | null {
  const size = pngSize(buffer) ?? jpegSize(buffer) ?? gifSize(buffer) ?? webpSize(buffer);
  if (!size || !(size.width > 0) || !(size.height > 0)) return null;
  return size;
}

/**
 * Scale to fit inside a box, preserving the aspect ratio. Never enlarges: a logo smaller
 * than the box is left alone rather than upscaled into a blurry one.
 */
export function fitToBox(size: Dimensions, box: Dimensions = LOGO_BOX): Dimensions {
  const scale = Math.min(box.width / size.width, box.height / size.height, 1);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * The `type` docx's ImageRun requires, from an HTTP Content-Type.
 *
 * Null for anything else, including image/svg+xml: docx can embed an SVG but demands a
 * raster `fallback` alongside it, and producing one would mean a rasteriser in the deploy.
 * A null here makes the header fall back to the brand's name as text, which is the same
 * thing a static client with no logo file already does.
 */
export function docxImageType(contentType: string): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  switch (contentType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/bmp':
      return 'bmp';
    default:
      return null;
  }
}
