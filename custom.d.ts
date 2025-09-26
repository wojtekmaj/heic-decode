declare module 'libheif-js/wasm-bundle.js' {
  export class HeifDecoder {
    decode(buffer: ArrayBuffer | Uint8Array): HeifImage[];
    decoder: { delete(): void };
  }

  export interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(
      options: { data: Uint8ClampedArray; width: number; height: number },
      callback: (result: { data: Uint8ClampedArray } | null) => void
    ): void;
    free(): void;
  }

  export const ready: Promise<void>;

  export const libheif = {
    HeifDecoder: HeifDecoder,
    HeifImage: HeifImage,
    ready: Promise<void>,
  };

  export default libheif;
}
