import {InputStreamInterface, MultipartFileInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {Readable} from "stream";
import {MultipartFile} from "./MultipartFile";


const LOG = LogService.createLogger('NodeInputStream');


export class NodeInputStream extends MultipartFile implements InputStreamInterface {
    public readonly _stream: Readable;

    /**
     *
     * @param stream
     *
     */
    public constructor(
        stream = new MultipartFile()
    ) {
        super()
        this._stream = stream;
    }

    available(): number {
        const size = this._file.size
        if (size) return size;
        return 0;
    }

    close(): void {
        this._stream.destroy()
    }

    mark(readLimit?: number): void {
    }

    markSupported(): boolean {
        return false;
    }

    nullInputStream(): void {
    }

    readAllBytes(): Uint8Array {
        const read = this._stream.read();
        const fullFile: any[] = [];

        read.on('data', (chunk: any) => {
            fullFile.push(chunk)
        })

        read.on('error', (err: any) => {
            LOG.error('readAllBytes failed with: ', err)
        })

        const result = read.on('end', () => {
            LOG.info("Stream has ended")
            const bit = new Uint8Array(fullFile);
            return bit
        })

        return result
    }

    readNBytes(len: number): ArrayBuffer;
    readNBytes(b: ArrayBuffer, off: number, len: number): ArrayBuffer
    readNBytes(len: number | ArrayBuffer, off?: number): ArrayBuffer {
        if (typeof len === "number" && off) {
            return this._stream.read(len);
        }
        return this._stream.read(this._highWaterMark)
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
            const chunk = this._stream.read(len)
            const length = b.length + chunk.length;
            const buffer = new Uint8Array(
                b.buffer,
                off,
                length
            );
            return buffer.length;

        } else if (b) {
            const chunk = this._stream.read(len);
            const length = b.length + chunk.length;
            const buffer = new ArrayBuffer(length);
            return new Uint8Array(buffer);
        } else {
            const nextByte = this._stream.read()
            return nextByte;
        }
    }

    // Typescript keeps complaining about inheritance unless I use any
    transferTo(out: any): number {
        if (out) {
            const readable = this._stream.read();
            const result = readable.pipe(out)
            return result.size;
        }
        return 0;
    }


}

const test = new NodeInputStream()
test.available()
test.getOriginalFilename()
test.getBytes()
test.read()
const stream = new TransformStream()
test.transferTo(stream)