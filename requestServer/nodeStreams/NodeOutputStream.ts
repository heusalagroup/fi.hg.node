import {OutputStreamInterface} from "../../../core/request/MultifileInterface";
import {LogService} from "../../../core/LogService";
import {Writable} from "stream";


const LOG = LogService.createLogger('NodeOutputStream');


export class NodeOutputStream extends Writable implements OutputStreamInterface{


    /**
     *
     * @param file
     * @param path
     *
     */
    public constructor(

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

    public write() {

    }

}
