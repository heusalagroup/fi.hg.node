import {InputStreamInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {MultipartFile} from "./MultipartFile";
import {Blob} from "buffer";

const LOG = LogService.createLogger('NodeInputStream');

export class NodeInputStream extends MultipartFile implements InputStreamInterface {
    readonly _file: any;
    readonly _options: Object;
    readonly _buffer: Promise<Uint8Array>;

    /**
     *
     * @param file
     * @param options
     */
    public constructor(
        file: File,
        options: Object,
    ) {
        super(file, options)
        this._file = file;
        this._options = options;
        this._buffer = this.toArrayBuffer(file);
    }

    private async toArrayBuffer(inputFile: File):Promise<Uint8Array> {
        const newBuffer = new Blob([inputFile])
        const buffer = await newBuffer.arrayBuffer().then<ArrayBuffer>(r => {return <Uint8Array>r})
        const uint8Arr = new Uint8Array(buffer)
        return uint8Arr
    }

    available() {
        const size = this._buffer.then(r => {
            return r.byteLength
        })
       return size;
    }

    close(): void {
        this.destroy()
    }

    mark(readLimit?: number): void {
    }

    markSupported(): boolean {
        return false;
    }

    nullInputStream(): void {
    }

    readAllBytes(): Uint8Array {
        const read = this;
        const fullFile: any[] = [];

        read.on('data', (chunk: any) => {
            fullFile.push(chunk)
        })

        read.on('error', (err: any) => {
            LOG.error('readAllBytes failed with: ', err)
        })

        read.on('end', () => {
            LOG.info("Stream has ended")
        })

        const bit = new Uint8Array(fullFile);
        return bit
    }

    readNBytes(len: number, b?: Uint8Array, off?: number): ArrayBuffer {
        if (len && b && off) {
            const chunk = this.read()
            const length = chunk.length;
            const buffer = new Uint8Array(
                b.buffer,
                off,
                length
            );
            return buffer;
        }
        return this.read()
    }

    reset(pos: number): void {
    }

    skip(n: number): number {
        return 0;
    }

    read(): Uint8Array;
    read(b: Uint8Array): number;
    read(b: Uint8Array, off: number, len: number): number;
    read(b?: Uint8Array, off?: number, len?: number): Uint8Array | number {
        if (b && off && len) {
            if (len === 0) return 0;
            const chunk = this.read()
            const length = b.length + chunk.length;
            const buffer = new Uint8Array(
                b.buffer,
                off,
                length
            );
            return buffer.length;

        } else if (b) {
            const chunk = this.read();
            const length = b.length + chunk.length;
            const buffer = new ArrayBuffer(length);
            return new Uint8Array(buffer);
        } else {
            this.push(this._file)
            return 1;
        }
    }

    // Typescript keeps complaining about inheritance unless I use any
    transferTo(out: any): number {
        if (out) {
            const readable = this.read();

        }
        return 0;
    }


}
