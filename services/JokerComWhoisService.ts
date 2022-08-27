// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.

import { WhoisService } from "../../core/whois/WhoisService";
import { WhoisLookupResult } from "../../core/whois/types/WhoisLookupResult";
import { WhoisLookupOptions } from "../../core/whois/types/WhoisLookupOptions";
import { createWhoisServerOptions, WhoisServerOptions } from "../../core/whois/types/WhoisServerOptions";

export const JOKER_WHOIS_HOSTNAME = "whois.joker.com";
export const JOKER_WHOIS_PORT = 4343;

/**
 * @see https://joker.com/faq/content/85/437/en/check-domain-availability.html
 */
export class JokerComWhoisService implements WhoisService {

    private readonly _whois : WhoisService;

    public constructor (whois: WhoisService) {
        this._whois = whois;
    }

    public static getServerOptions () : WhoisServerOptions {
        return createWhoisServerOptions(JOKER_WHOIS_HOSTNAME, JOKER_WHOIS_PORT);
    }

    public async whoisLookup (
        address: string,
        options?: WhoisLookupOptions
    ): Promise<readonly WhoisLookupResult[]> {
        return await this._whois.whoisLookup(address, options);
    }

}
