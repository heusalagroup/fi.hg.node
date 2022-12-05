import { MultipartFileInterface } from "../../../core/request/MultifileInterface";
import { LogService } from "../../../core/LogService";
import { createReadStream } from 'fs'


const LOG = LogService.createLogger('NodeInputStream');


export class NodeInputStream implements MultipartFileInterface  {

    private readonly _path           : string;
    private readonly _file           : File;
    private readonly _buffer         : BufferEncoding;

    /**
     *
     * @param file
     * @param path
     *
     */
    public constructor (
        path    : string                    = '',
        file    : File                      = new File([""], "hello-world"),
        buffer  : BufferEncoding            = 'binary',
    ) {
        LOG.debug('new: ', path);

        this._path      = path;
        this._file      = file;
        this._buffer    = buffer;
    }

    public getBytes(): ArrayBuffer[] {
        const reader = new FileReader();
        const fileByteArray:any = [];
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
        if(fileByteArray.length > 0) return fileByteArray;
        return [] as ArrayBuffer[];
    };
    public getContentType():string | null {
        const files = this._file;

        const type = files.type;
        if(type) return type;
        return null;
    };
    public getInputStream() {
        const stream = createReadStream(this._path, this._buffer)

        return stream.read()

    };
    public getName():void {
        return
    }
    public getOriginalFilename(): string {
        const file = this._file;

        const name = file.name;
        if(name) return name;
        return '';
    }
    public getSize() {
        const file = this._file;

        if (file.size) return file.size;
        return 0
    }
    public isEmpty() {
        const file = this._file;

        if(file.size > 0) return false;
        return true;
    }
    public transferTo() {
        const file = this._file;
        if(this._path) {

        }
    }


}
