// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { RequestClient } from "../core/RequestClient";
import { NodeRequestClient } from "./requestClient/node/NodeRequestClient";
import { LogLevel } from "../core/types/LogLevel";
import { LogService } from "../core/LogService";
import { RequestClientInterface } from "../core/requestClient/RequestClientInterface";
import { NodeChildProcessService } from "./NodeChildProcessService";
import { SystemService } from "../core/SystemService";

const LOG = LogService.createLogger('HgNode');

export class HgNode {

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
    }

    /**
     * This method will initialize our libraries using frontend implementations.
     *
     * Right now it will call `RequestClient.setClient()` with a standard NodeJS
     * implementation. It has a dependency to NodeJS's http and https modules.
     *
     * @param requestClient
     */
    public static initialize (
        requestClient ?: RequestClientInterface | undefined
    ) {
        if (!requestClient) {
            const HTTP = require('http');
            const HTTPS = require('https');
            requestClient = new NodeRequestClient(HTTP, HTTPS);
        }
        RequestClient.setClient(requestClient);

        SystemService.initialize( new NodeChildProcessService() );

    }

}
