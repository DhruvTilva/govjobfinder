/** Public URL of an organisation logo (always a 128×128 WebP served by /files/<id>/…). No server-only imports. */
export const logoPath = (uploadId: number) => `/files/${uploadId}/logo.webp`;
