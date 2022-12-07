import {MultipartFileInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {createReadStream, createWriteStream, unlink} from 'fs'
import {Readable, Writable} from "stream";


const LOG = LogService.createLogger('NodeInputStream');


export class NodeOutputStream extends Writable {

    constructor() {
        super();
    }

    public close() {

    }

    public flush() {

    }

    public nullOutputStream() {

    }

    write() {

    }

}
