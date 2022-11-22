// Copyright (c) 2022. Heusala Group Oy <info@heusalagroup.fi>. All rights reserved.


import exp from "constants";

describe('NodeInputStream', () => {
    beforeEach(() => {

    })
    it('Buffer transcode', () => {
        const buffer = require('buffer');
        const newBuf = buffer.transcode(Buffer.from('€'), 'utf8', 'ascii');
        expect(newBuf.toString('ASCII')).toEqual('?')
        expect(newBuf.toJSON('ASCII')).toContain('?')
    })

    it('Buffer isBuffer', () => {
        expect(Buffer.isBuffer(Buffer.alloc(10))).toBeTruthy()
        expect(Buffer.isBuffer(Buffer.from('foo'))).toBeTruthy()
        expect(Buffer.isBuffer('a string')).toBeFalsy()
        expect(Buffer.isBuffer([])).toBeFalsy()
        expect(Buffer.isBuffer(new Uint8Array(1024))).toBeFalsy()
    })

    it('Buffers and character encodings', () => {
        const buf = Buffer.from('hello world', 'utf8');
        expect(buf.toString('hex')).toEqual('68656c6c6f20776f726c64')
        expect(buf.toString('base64')).toEqual('aGVsbG8gd29ybGQ=')
        expect(buf[1]).toEqual(101);
        expect(buf[7]).toEqual(111);
    })

    it('Buffer arrayBuffer', () => {
        const arrayBuffer = new ArrayBuffer(16);
        const buffer = Buffer.from(arrayBuffer);
        expect(buffer).toBeTruthy();
    })

    it('Buffer types', () => {
        const buf = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]);
        const json = JSON.stringify(buf);
        expect(json.toString()).toEqual("{\"type\":\"Buffer\",\"data\":[1,2,3,4,5]}")
        expect(Buffer.alloc(10)).toHaveLength(10)
        expect(Buffer.alloc(5, 1)[3]).toEqual( 1)
        expect(Buffer.from([1, 2, 3, 9, 44])).toContain( 9)
    })

})
