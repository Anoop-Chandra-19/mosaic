interface DownloadTextFileOptions {
  fileName: string;
  content: string;
  mimeType?: string;
}

export function downloadTextFile({
  fileName,
  content,
  mimeType = 'application/json',
}: DownloadTextFileOptions): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
