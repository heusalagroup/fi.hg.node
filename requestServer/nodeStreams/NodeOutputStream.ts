import {OutputStreamInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {Writable} from "stream";


const LOG = LogService.createLogger('NodeOutputStream');


export class NodeOutputStream extends Writable implements OutputStreamInterface{


    /**
     *
     * @param file
     * @param path
     * @param buffer
     */
    public constructor(
        path:           'string',
        file:           File,
        buffer:         BufferEncoding
    ) {
        super()

    }

    public close() {
        return
    }

    public flush() {
        return
    }

    public nullOutputStream() {
        return
    }

    public write(b: (number | BufferEncoding), off?:number, len?:number):(number | void) {

    }

}
