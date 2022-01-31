const assert = require('assert');
const { Console } = require('console');
const expect = require('expect');
var DATE = require('../lib/date-utilities');
require('mocha-testcheck').install();

describe('date-utilities', () => {

    describe('.toFormatString', () => {

        check.it('should return string of 10 symbols if format is missing', { numTests: 10 }, gen.posInt, (ms) => {
            var testDate = new Date(ms);
            var formatStr = DATE.toFormatString(testDate);
            expect(formatStr).toHaveLength(10);
        });

    });

});