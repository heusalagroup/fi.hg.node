// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { RequestClient } from "../core/RequestClient";
import { NodeRequestClient } from "./requestClient/node/NodeRequestClient";
import { LogLevel } from "../core/types/LogLevel";
import { LogService } from "../core/LogService";
import { RequestClientInterface } from "../core/requestClient/RequestClientInterface";

const LOG = LogService.createLogger('initializeHgNode');

export class HgNode {

    public static setLogLevel (level: LogLevel) {
        LOG.setLogLevel(level);
    }

    public static initialize (
        requestClient ?: RequestClientInterface | undefined
    ) {
        if (!requestClient) {
            const HTTP = require('http');
            const HTTPS = require('https');
            requestClient = new NodeRequestClient(HTTP, HTTPS);
        }
        RequestClient.useClient(requestClient);
    }

}
