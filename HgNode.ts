// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { RequestClientImpl } from "../core/RequestClientImpl";
import { NodeRequestClient } from "./requestClient/node/NodeRequestClient";
import { LogLevel } from "../core/types/LogLevel";
import { LogService } from "../core/LogService";
import { RequestClientAdapter } from "../core/requestClient/RequestClientAdapter";
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
     * Right now it will call `RequestClientImpl.setClient()` with a standard NodeJS
     * implementation. It has a dependency to NodeJS's http and https modules.
     *
     * @param requestClient The request client adapter to be used by default
     */
    public static initialize (
        requestClient ?: RequestClientAdapter | undefined
    ) {
        if (!requestClient) {
            const HTTP = require('http');
            const HTTPS = require('https');
            requestClient = NodeRequestClient.create(HTTP, HTTPS);
        }
        RequestClientImpl.setClient(requestClient);
        SystemService.initialize( new NodeChildProcessService() );
    }

}
