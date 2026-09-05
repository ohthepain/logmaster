declare module 'piexifjs' {
  export interface IExif {
    '0th'?: Record<number, string>
    Exif?: Record<number, string>
    GPS?: Record<number, string | number[][]>
  }

  export const ImageIFD: Record<string, number>
  export const ExifIFD: Record<string, number>
  export const GPSIFD: Record<string, number>

  export const GPSHelper: {
    degToDmsRational: (deg: number) => number[][]
    dmsRationalToDeg: (dmsArray: number[][], ref: string) => number
  }

  export function dump(exifObj: IExif): string
  export function insert(exifBytes: string, dataUrl: string): string
  export function load(data: string): IExif

  const piexif: {
    ImageIFD: typeof ImageIFD
    ExifIFD: typeof ExifIFD
    GPSIFD: typeof GPSIFD
    GPSHelper: typeof GPSHelper
    dump: typeof dump
    insert: typeof insert
    load: typeof load
  }

  export default piexif
}
