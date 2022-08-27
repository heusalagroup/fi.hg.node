// Copyright (c) 2021. Sendanor <info@sendanor.fi>. All rights reserved.

import { FiHgComJokerDMAPIService } from "./FiHgComJokerDMAPIService";

const JOKER_SERVER = 'https://dmapi.ote.joker.com';

describe('system', () => {
    describe('FiHgComJokerDMAPIService', () => {
        describe('#constructor', () => {
            test('can create objects', () => {
                expect(() => new FiHgComJokerDMAPIService()).not.toThrow();
            });
            test('can create objects with URL', () => {
                expect(() => new FiHgComJokerDMAPIService(JOKER_SERVER)).not.toThrow();
            });
            test('can create objects with URL and authId', () => {
                expect(() => new FiHgComJokerDMAPIService(JOKER_SERVER, '1234')).not.toThrow();
            });
            test('can create objects with authId and default URL', () => {
                expect(() => new FiHgComJokerDMAPIService(undefined, '1234')).not.toThrow();
            });
        });
    });
});
