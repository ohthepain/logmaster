import { Share } from '@capacitor/share'
import { isNativePlatform } from './platform'

export async function saveOrShareFile(file: File): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
    }
  }

  if (isNativePlatform()) {
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
      reader.readAsDataURL(file)
    })
    await Share.share({
      title: file.name,
      dialogTitle: 'Share trip export',
      url: dataUrl,
    })
    return
  }

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (
        window as Window & {
          showSaveFilePicker: (options: {
            suggestedName: string
            types: Array<{ description: string; accept: Record<string, string[]> }>
          }) => Promise<FileSystemFileHandle>
        }
      ).showSaveFilePicker({
        suggestedName: file.name,
        types: [
          {
            description: file.name.split('.').pop()?.toUpperCase() ?? 'File',
            accept: { [file.type || 'application/octet-stream']: [`.${file.name.split('.').pop() ?? 'bin'}`] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(await file.arrayBuffer())
      await writable.close()
      return
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function sanitizeExportFileName(name: string, extension: string): string {
  const base =
    name
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'trip'
  return `${base}.${extension.replace(/^\./, '')}`
}
