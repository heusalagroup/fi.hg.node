import {MultipartFileInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {copyFile} from 'fs'
import {Readable} from "stream";


const LOG = LogService.createLogger('NodeInputStream');


export class MultipartFile extends Readable implements MultipartFileInterface {

    protected readonly _path:             string;
    protected readonly _file:             File;
    protected readonly _buffer:           BufferEncoding;
    protected readonly _highWaterMark:    number;

    /**
     *
     * @param file
     * @param path
     * @param buffer
     * @param highWaterMark
     *
     */
    public constructor(
        path: string = '',
        file: File = new File([""], "hello-world"),
        buffer: BufferEncoding = 'binary',
        highWaterMark = 8192,
    ) {
        super()
        LOG.debug('newPath: ', path);

        this._path = path;
        this._file = file;
        this._buffer = buffer;
        this._highWaterMark = highWaterMark;
    }

    public getBytes(): Uint8Array[] {
        const reader = new FileReader();
        const fileByteArray: any = [];
        reader.readAsArrayBuffer(this._file);
        reader.onloadend = function (evt) {
            if (evt?.target?.readyState == FileReader.DONE) {
                const arrayBuffer = <Uint8Array>evt.target.result;
                const array = new Uint8Array(arrayBuffer);
                for (var i = 0; i < array.length; i++) {
                    fileByteArray.push(array[i]);
                }
            }
        }
        if (fileByteArray.length > 0) return fileByteArray;
        return [] as Uint8Array[];
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