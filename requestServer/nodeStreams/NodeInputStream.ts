import {MultipartFileInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {createReadStream, copyFile} from 'fs'
import {Readable} from "stream";


const LOG = LogService.createLogger('NodeInputStream');


export class NodeInputStream extends Readable implements MultipartFileInterface {

    private readonly _path:             string;
    private readonly _file:             File;
    private readonly _buffer:           BufferEncoding;

    /**
     *
     * @param file
     * @param path
     *
     */
    public constructor(
        path: string = '',
        file: File = new File([""], "hello-world"),
        buffer: BufferEncoding = 'binary',
    ) {
        super()
        LOG.debug('newPath: ', path);

        this._path = path;
        this._file = file;
        this._buffer = buffer;
    }

    public getBytes(): ArrayBuffer[] {
        const reader = new FileReader();
        const fileByteArray: any = [];
        reader.readAsArrayBuffer(this._file);
        reader.onloadend = function (evt) {
            if (evt?.target?.readyState == FileReader.DONE) {
                const arrayBuffer = <ArrayBuffer>evt.target.result;
                const array = new Uint8Array(arrayBuffer);
                for (var i = 0; i < array.length; i++) {
                    fileByteArray.push(array[i]);
                }
            }
        }
        if (fileByteArray.length > 0) return fileByteArray;
        return [] as ArrayBuffer[];
    };

    public getContentType(): string {
        const file: File = this._file;

        const type = file.type;
        if (type) return type;
        return '';
    };

    public getInputStream() {
        const readable = createReadStream(this._path, this._buffer);

        return readable.read();
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
        const file = this._file;
        const buffer = new ArrayBuffer(file.size);

        if (buffer.byteLength) {
            return buffer.byteLength;
        }
        return 0
    }

    public isEmpty() {
        const file = this._file;

        if (file.size > 0) return false;
        return true;
    }

    public transferTo(dest?: string) {
        const currentPath = this._path;
        const destinationPath = dest;

        if (destinationPath) {
            copyFile(currentPath, destinationPath, () => {
                LOG.debug(`File copied from: ${currentPath} to ${destinationPath}`)
            });

        }
    }

}
