// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.
// Copyright (C) 2011-2017 by Jaakko-Heikki Heusala <jheusala@iki.fi>

import {
    stringify
} from "querystring";
import { HttpService } from "../../../../core/HttpService";
import { ContentType } from "../../../../core/request/ContentType";
import { LogService } from "../../../../core/LogService";
import { isArray, isBoolean, isString, reduce, split } from "../../../../core/modules/lodash";
import { JokerPrivacyType } from "./types/JokerPrivacyType";

const LOG = LogService.createLogger('FiHgComJokerDMAPIService');

interface RequestArgumentObject {
    readonly [key: string]: string;
}

export interface JokerStringObject {
    readonly [key: string] : string;
}

export interface JokerDomainResult {
    readonly domain: string;
    readonly expiration : string;
    readonly status ?: string;
    readonly jokerns ?: boolean;
    readonly grants ?: string;
}

export interface JokerDMAPIResponseObject {
    readonly headers : JokerStringObject;
    readonly body : string;
}

/**
 * Joker.com DMAPI client library for NodeJS
 */
export class FiHgComJokerDMAPIService {

    private readonly _url : string;
    private _authSID : string | undefined;

    /**
     * Creates a client service for Joker.com DMAPI
     *
     * @param url For testing purposes, you may use `https://dmapi.ote.joker.com`
     * @param authId
     */
    public constructor (
        url : string = 'https://dmapi.joker.com',
        authId : string | undefined = undefined
    ) {
        this._url = url;
        this._authSID = authId;
    }

    /** Login using api key
     * @see https://joker.com/faq/content/26/14/en/login.html
     */
    public async loginWithApiKey (apiKey : string) {
        return await this._login({'api-key': apiKey});
    }

    /** Login using username and password
     * @see https://joker.com/faq/content/26/14/en/login.html
     */
    public async loginWithUsername (
        username : string,
        password : string
    ) {
        return await this._login({username, password});
    }

    /** Login implementation
     * @see https://joker.com/faq/content/26/14/en/login.html
     */
    private async _login (args: RequestArgumentObject) {
        const response = await jokerRequest(this._url,'login', args);
        const auth_id = response.headers['auth-sid'];
        const uid = response.headers.uid;
        const tlds = response.body.split("\n");
        this._authSID = isArray(auth_id) ? auth_id[0] : auth_id;
        return {'auth_id':auth_id, 'uid':uid, 'tlds':tlds};
    }

    /** Logout
     * @see https://joker.com/faq/content/26/15/en/logout.html
     */
    public async logout () {
        if (!this._authSID) throw new Error("FiHgComJokerDMAPIService.logout: No authSID. Try login first.");
        await jokerRequest(
            this._url,
            'logout',
            {
                'auth-sid': this._authSID
            }
        );
        this._authSID = undefined;
    }

    /** query-domain-list
     * @params pattern Pattern to match (glob-like)
     * @params from Pattern to match (glob-like)
     * @params to End by this
     * @params showStatus
     * @params showGrants
     * @params showJokerNS
     * @see https://joker.com/faq/content/27/20/en/query_domain_list.html
     */
    public async queryDomainList (
        pattern: string,
        from: string,
        to: string,
        showStatus: boolean,
        showGrants: boolean,
        showJokerNS: boolean
    ) : Promise<JokerDomainResult[]> {
        if (!this._authSID) throw new Error("FiHgComJokerDMAPIService.queryDomainList: No authSID. Try login first.");
        const opts = {
            'auth-sid': this._authSID,
            ...(pattern? {pattern} : {}),
            ...(from ? {from} : {}),
            ...(to ? {to} : {}),
            ...(showStatus  !== undefined ? {'showstatus' : showStatus  ? '1' : '0'} : {}),
            ...(showGrants  !== undefined ? {'showgrants' : showGrants  ? '1' : '0'} : {}),
            ...(showJokerNS !== undefined ? {'showjokerns': showJokerNS ? '1' : '0'} : {})
        };
        const response = await jokerRequest(this._url,'query-domain-list', opts);
        const domains = response.body;
        return domains.split('\n').map(
            (line: string) => parse_domain(line, showStatus, showJokerNS, showGrants)
        );
    }

    /** query-whois
     * At least one of the arguments must be specified
     * @see https://joker.com/faq/content/79/455/en/query_whois.html
     * @param domain
     * @param contact
     * @param host
     */
    public async queryWhois (
        domain  ?: string | undefined,
        contact ?: string | undefined,
        host    ?: string | undefined
    ) : Promise<JokerStringObject> {
        if (!this._authSID) throw new Error("FiHgComJokerDMAPIService.queryWhois: No auth_id. Try login first.");
        if ( domain === undefined && contact === undefined && host === undefined ) {
            throw new TypeError('FiHgComJokerDMAPIService.queryWhois: Exactly one of accepted options must be specified.');
        }
        const opts = {
            'auth-sid': this._authSID,
            ...( domain !== undefined ? {domain} : {}),
            ...( contact !== undefined ? {contact} : {}),
            ...( host !== undefined ? {host} : {})
        };
        const response = await jokerRequest(this._url,'query-whois', opts);
        return parseJokerStringObjectResponse(response.body);
    }

    /** query-profile */
    public async queryProfile () {
        if (!this._authSID) throw new Error("FiHgComJokerDMAPIService.queryProfile: No auth_id. Try login first.");
        const response = await jokerRequest(
            this._url,
            'query-profile',
            {
                'auth-sid': this._authSID
            }
        );
        return parseJokerStringObjectResponse(response.body);
    }

    /** domain-renew
     * @see https://joker.com/faq/content/27/22/en/domain_renew.html
     */
    public async domainRenew (
        domain: string,
        period: string | undefined,
        expyear: string | undefined,
        privacy: JokerPrivacyType | undefined,
        maxPrice: number
    ) {
        if ( !this._authSID ) throw new Error(`FiHgComJokerDMAPIService.domainRenew: No auth_id. Try login first.`);
        if ( !domain ) throw new TypeError('FiHgComJokerDMAPIService.domainRenew: Option "domain" is required.');
        if ( !period && !expyear ) {
            throw new TypeError('FiHgComJokerDMAPIService.domainRenew: One of "period" or "expyear" is required.');
        }
        if (period && expyear) {
            throw new TypeError('FiHgComJokerDMAPIService.domainRenew: Only one of "period" or "expyear" may be used, but not both.');
        }
        if ( maxPrice <= 0 ) {
            throw new TypeError('FiHgComJokerDMAPIService.domainRenew: "max-price" must be above 0')
        }
        const opts : RequestArgumentObject = {
            'auth-sid': this._authSID,
            domain,
            ...(period ? {period} : {}),
            ...(expyear ? {expyear} : {}),
            ...(privacy ? {privacy}: {}),
            ...(maxPrice !== undefined ? {'max-price': maxPrice.toFixed(2)}: {})
        };
        await jokerRequest(this._url,'domain-renew', opts);
    }

    /** grants-list
     * @see https://joker.com/faq/content/76/448/en/grants_list.html
     */
    public async grantsList (
        domain: string,
        showKey: string
    ) : Promise<string> {
        if ( !this._authSID ) throw new Error(`FiHgComJokerDMAPIService.grantsList: No auth_id. Try login first.`);
        if ( !domain ) throw new TypeError('Option "domain" is required.');
        const opts = {
            'auth-sid': this._authSID,
            domain,
            ...(showKey ? {showkey: showKey} : {}),
        };
        const response = await jokerRequest(this._url,'grants-list', opts);
        const grants = response.body;
        // FIXME: Prepare into array
        return grants;
    }

    /** grants-invite
     * @see https://joker.com/faq/content/76/449/en/grants_invite.html
     */
    public async grantsInvite (
        domain: string,
        email: string,
        clientUid: string,
        role: string,
        nickname: string
    ) :Promise<boolean> {
        if ( !this._authSID ) throw new Error(`FiHgComJokerDMAPIService.grantsInvite: No auth_id. Try login first.`);
        if ( !domain ) throw new TypeError('FiHgComJokerDMAPIService.grantsInvite: Option "domain" is required.');
        if ( !email ) throw new TypeError('FiHgComJokerDMAPIService.grantsInvite: Option "email" is required.');
        if ( !role ) throw new TypeError('FiHgComJokerDMAPIService.grantsInvite: Option "role" is required.');
        const opts = {
            'auth-sid': this._authSID,
            domain,
            email,
            role,
            ...(clientUid ? {'client-uid': clientUid} : {}),
            ...(nickname ? {'nick-name': nickname} : {})
        };
        const response = await jokerRequest(this._url,'grants-invite', opts);
        return ''+response.body === 'ok';
    }

    /** domain-modify
     * @see https://joker.com/faq/content/27/24/en/domain_modify.html
     */
    public async domainModify (
        domain          : string,
        billingContact ?: string | undefined,
        adminContact   ?: string | undefined,
        techContact    ?: string | undefined,
        nsList         ?: readonly string[] | undefined,
        registerTag    ?: string | undefined,
        dnssec         ?: boolean | undefined,
        ds             ?: readonly string[] | undefined,
    ) {
        if (!this._authSID) throw new Error("FiHgComJokerDMAPIService.domainModify: No auth_id. Try login first.");
        if (!domain) throw new TypeError('FiHgComJokerDMAPIService.domainModify: Option "domain" is required.');
        if (dnssec === true && !ds) throw new TypeError('FiHgComJokerDMAPIService.domainModify: Option "ds" is required when "dnssec" enabled.');
        if (dnssec === true && ds?.length < 2) throw new TypeError('FiHgComJokerDMAPIService.domainModify: Option "ds" must have at least 2 items.');
        if (nsList !== undefined && nsList?.length < 2) throw new TypeError('FiHgComJokerDMAPIService.domainModify: Option "nsList" must have at least 2 nameservers.');
        const opts = {
            'auth-sid': this._authSID,
            domain,
            ...(billingContact ? {'billing-c': billingContact} : {}),
            ...(adminContact ? {'admin-c': adminContact} : {}),
            ...(techContact ? {'tech-c': techContact} : {}),
            ...(nsList !== undefined ? {'ns-list': nsList.join(':')} : {}),
            ...(registerTag ? {'registrar-tag': registerTag} : {}),
            ...(dnssec !== undefined ? {'dnssec': dnssec ? '1' : '0'} : {}),
            ...(ds.length >= 1 ? {'ds-1': ds[0]} : {}),
            ...(ds.length >= 2 ? {'ds-2': ds[1]} : {}),
            ...(ds.length >= 3 ? {'ds-3': ds[2]} : {}),
            ...(ds.length >= 4 ? {'ds-4': ds[3]} : {}),
            ...(ds.length >= 5 ? {'ds-5': ds[4]} : {}),
            ...(ds.length >= 6 ? {'ds-6': ds[5]} : {}),
        };
        await jokerRequest(this._url,'domain-modify', opts);
    }

}

/**
 * Post generic request
 */
async function jokerRequest (
    baseUrl: string,
    name : string,
    args : RequestArgumentObject
) : Promise<JokerDMAPIResponseObject> {
    const url = `${baseUrl}/request/${name}`;
    const body = stringify(args);
    const response = await HttpService.postText(
        url,
        body,
        {
            'Content-Type': ContentType.X_WWW_FORM_URLENCODED
        }
    );
    LOG.debug(`_exec: response = `, response);
    return parseResponseBody(response);
}

/** Parse DMAPI response body */
function parseResponseBody (data: string) : JokerDMAPIResponseObject {
    const parts = split('\n\n', data);
    const headersString = parts.shift();
    const bodyString = parts.join('\n\n');
    return {
        headers: parseResponseHeaders(headersString),
        body: bodyString
    };
}

function parseResponseHeaders (headersString: string) : JokerStringObject {
    const headerLines = headersString.split("\n");
    return reduce(
        headerLines,
        (obj: JokerStringObject, line: string) : JokerStringObject => {
            if (line.trim() && line.indexOf(': ') < 0) {
                throw new TypeError(`parseResponseHeaders: Could not parse line: "${line}"`);
            }
            const parts = split(': ', ""+line);
            const name = parts.shift();
            const value = parts.join(': ');
            return {
                ...obj,
                [name.toLowerCase()]: value
            };
        },
        {}
    );
}

/** Parse single line */
function parseJokerNS (line : string) : boolean {
    if (! ((line === '1') || (line === '0')) ) {
        throw new TypeError(`FiHgComJokerDMAPIService.parseJokerNS: Could not parse "jokerns": "${line}"`);
    }
    return line === '1';
}

/** Parse single line
 */
function parse_domain (
    line: string,
    showStatus: boolean,
    showJokerNs: boolean,
    showGrants: boolean
) : JokerDomainResult {

    // -S-G-J ==> "example.fi 2017-06-02"
    // +S-G-J ==> "example.fi 2017-06-02 lock"
    // +S+G-J ==> "example.fi 2017-06-02 lock @creator true 0 undef"
    // -S+G-J ==> "example.fi 2017-06-02 @creator true 0 undef"
    // -S-G+J ==> "example.fi 2017-06-02 0"
    // +S+G+J ==> "example.fi 2017-06-02 lock @creator true 0 undef 0"

    const tmp = line.split(' ');
    const domain = tmp.shift();
    if (!domain) throw new TypeError(`FiHgComJokerDMAPIService.parse_domain: Could not parse domain name: "${line}"`);
    const exp_date = tmp.shift();
    if (!exp_date) throw new TypeError(`FiHgComJokerDMAPIService.parse_domain: Could not parse domain exp_date: "${line}"`);

    const status = tmp.shift().split(',');
    if (!isString(status)) throw new TypeError(`FiHgComJokerDMAPIService.parse_domain: Could not parse status: "${line}"`);
    const jokerNS = parseJokerNS(tmp.pop());
    if (!isBoolean(jokerNS)) throw new TypeError(`FiHgComJokerDMAPIService.parse_domain: Could not parse status: "${line}"`);
    const grants = tmp.join(' ');

    return {
        domain: domain,
        expiration: exp_date,
        ...(showStatus ? {status} : {}),
        ...(showJokerNs ? {jokerns: jokerNS} : {}),
        ...(showGrants ? {grants} : {})
    };
}

function parseJokerStringObjectResponse (body: string) : JokerStringObject {
    const lines = body.split('\n');
    return reduce(
        lines,
        (data : JokerStringObject, line: string) : JokerStringObject => {
            const parts = split(line, ': ');
            const key = parts.shift();
            const value = parts.join(': ');
            return {
                ...data,
                [key]: value
            };
        },
        {}
    );
}
