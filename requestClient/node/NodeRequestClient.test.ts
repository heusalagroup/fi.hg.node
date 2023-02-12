import { HttpModule, NodeRequestClient } from "./NodeRequestClient";
import { RequestMethod } from "../../../core/request/types/RequestMethod";
import { EventEmitter } from "events";
import { LogLevel } from "../../../core/types/LogLevel";
import { ResponseEntity } from "../../../core/request/ResponseEntity";

interface MockHttpModule extends HttpModule {
    mockResponse(statusCode: number, body: string): void;
    mockClear() : void;
}

function createMockHttpModule (
    statusCode: number,
    body: string
) : MockHttpModule {
    let timeout : any = undefined;
    const http = {
        request: jest.fn((options, callback) => {

            const res : any = new EventEmitter();
            res.statusCode = statusCode;
            res.end = jest.fn();

            timeout = setTimeout(() => {
                timeout = undefined;
                res.emit('data', new Buffer(body));
                res.emit('end');
            }, 100);

            callback(res);

            const req : any = new EventEmitter();
            req.statusCode = statusCode;
            req.write = jest.fn();
            req.end = jest.fn();
            return req;
        }),
        mockResponse(s: number, b: string) {
            statusCode = s;
            body = b;
        },
        mockClear() {
            if (timeout !== undefined) {
                clearTimeout(timeout);
                timeout = undefined;
            }
        }
    } as unknown as MockHttpModule;
    return http;
}

describe('NodeRequestClient', () => {

    let http : MockHttpModule;
    let client : NodeRequestClient;

    beforeEach ( () => {
        NodeRequestClient.setLogLevel(LogLevel.NONE);
        http = createMockHttpModule(200, '');
        client = new NodeRequestClient(http, http);
    });

    afterEach( () => {
        http.mockClear();
    });

    describe('textRequest', () => {

        it('should return a GET response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response = await client.textRequest(RequestMethod.GET, 'http://example.com');
            expect(response).toBe('Hello world');
        });

        it('should return a POST response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response = await client.textRequest(RequestMethod.POST, 'http://example.com');
            expect(response).toBe('Hello world');
        });

        it('should return a PUT response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response = await client.textRequest(RequestMethod.PUT, 'http://example.com');
            expect(response).toBe('Hello world');
        });

        it('should return a DELETE response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response = await client.textRequest(RequestMethod.DELETE, 'http://example.com');
            expect(response).toBe('Hello world');
        });

        it('should throw an error when the request is unsuccessful', async () => {
            http.mockResponse(400, 'Hello world');
            try {
                await client.textRequest(RequestMethod.GET, 'http://example.com');
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error.getStatusCode()).toStrictEqual(400);
                expect(error.getBody()).toStrictEqual('Hello world');
            }
        });

    });

    describe('jsonRequest', () => {

        it('should return a JSON GET response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonRequest(RequestMethod.GET, 'http://example.com');
            expect(response).toStrictEqual({hello: 'world'});
        });

        it('should return a JSON POST response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonRequest(RequestMethod.POST, 'http://example.com');
            expect(response).toStrictEqual({hello: 'world'});
        });

        it('should return a JSON PUT response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonRequest(RequestMethod.PUT, 'http://example.com');
            expect(response).toStrictEqual({hello: 'world'});
        });

        it('should return a JSON DELETE response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonRequest(RequestMethod.DELETE, 'http://example.com');
            expect(response).toStrictEqual({hello: 'world'});
        });

        it('should throw an error when the request is unsuccessful', async () => {
            http.mockResponse(400, JSON.stringify({hello: 'world'}));
            try {
                await client.jsonRequest(RequestMethod.GET, 'http://example.com');
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error?.getStatusCode()).toBe(400);
                expect(error?.getBody()).toStrictEqual({hello: 'world'});
            }
        });

    });


    describe('textEntityRequest', () => {

        it('should return a GET response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response : ResponseEntity<any> = await client.textEntityRequest(RequestMethod.GET, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toBe('Hello world');
        });

        it('should return a POST response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response = await client.textEntityRequest(RequestMethod.POST, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toBe('Hello world');
        });

        it('should return a PUT response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response = await client.textEntityRequest(RequestMethod.PUT, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toBe('Hello world');
        });

        it('should return a DELETE response when the request is successful', async () => {
            http.mockResponse(200, 'Hello world');
            const response = await client.textEntityRequest(RequestMethod.DELETE, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toBe('Hello world');
        });

        it('should throw an error when the request is unsuccessful', async () => {
            http.mockResponse(400, 'Hello world');
            try {
                await client.textEntityRequest(RequestMethod.GET, 'http://example.com');
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error.getStatusCode()).toStrictEqual(400);
                expect(error.getBody()).toBe('Hello world');
            }
        });

    });

    describe('jsonEntityRequest', () => {

        it('should return a JSON GET response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonEntityRequest(RequestMethod.GET, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toStrictEqual({hello: 'world'});
        });

        it('should return a JSON POST response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonEntityRequest(RequestMethod.POST, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toStrictEqual({hello: 'world'});
        });

        it('should return a JSON PUT response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonEntityRequest(RequestMethod.PUT, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toStrictEqual({hello: 'world'});
        });

        it('should return a JSON DELETE response when the request is successful', async () => {
            http.mockResponse(200, JSON.stringify({hello: 'world'}));
            const response = await client.jsonEntityRequest(RequestMethod.DELETE, 'http://example.com');
            expect(response).toBeDefined();
            expect(response.getStatusCode()).toStrictEqual(200);
            expect(response.getBody()).toStrictEqual({hello: 'world'});
        });

        it('should throw an error when the request is unsuccessful', async () => {
            http.mockResponse(400, JSON.stringify({hello: 'world'}));
            try {
                await client.jsonEntityRequest(RequestMethod.GET, 'http://example.com');
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error?.getStatusCode()).toBe(400);
                expect(error?.getBody()).toStrictEqual({hello: 'world'});
            }
        });

    });

});
