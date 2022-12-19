import {MultipartFileInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {Duplex, Readable, Writable} from "stream";


const LOG = LogService.createLogger('NodeInputStream');


export class MultipartFile extends Duplex implements MultipartFileInterface {

    protected readonly _readable:            Readable;
    protected readonly _writable:            Writable;

    /**
     *
     * @param file
     *
     */
    public constructor(
        readableStream: Readable = new Readable(),
        writableStream: Writable = new Writable()
    ) {
        super()
        LOG.debug('newReadStreams: ', readableStream);
        LOG.debug('newWriteStreams: ', writableStream);

        this._readable = readableStream;
        this._writable = writableStream;
    }

    read(size?: number) {
        if(size) super.read(size);
        super.read();
    }

    public async getBytes(): Promise<Uint8Array> {
        const buffer = await this._file.arrayBuffer()
        return new Uint8Array(buffer);
    };

    public getContentType(): string {
        const file: File = this._file;

        const type = file.type;
        if (type) return type;
        return '';
    };

    public getName() {
        const file = this._file;

        const name = file.name;
        return name;
    }

    public getOriginalFilename(): string {
        const file = this._file;

        const name = file.name;
        if (name) return name;
        return '';
    }

    public getSize() {
        const fileSize = this._file.size;

        if (fileSize) return fileSize;
        return 0;
    }

    public isEmpty() {
        const file = this._file;

        if (file.size > 0) return false;
        return true;
    }

    public transferTo(dest?: File) {
        const destinationFile = dest;

        if(destinationFile) {
            const readStream = new Readable({
            })
            const writeStream = new Writable()

            readStream.push(this._file, "binary")
            readStream.push(null)
            const result = readStream.pipe(writeStream)
        }
    }

}