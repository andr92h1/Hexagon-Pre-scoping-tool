var assert = require('assert');
var expect = require('expect');
var PANO = require('../lib/pano-utilities');

const ri_elements = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const elements = [0.99998619, -0.00288618, -0.00448656, 0.00263214, 0.99844784, -0.05563249, 0.00555143, 0.05561726, 0.99843714];
const r_elements = [elements[0], elements[3], elements[6], elements[1], elements[4], elements[7], elements[2], elements[5], elements[8]];

describe('pano-utilities', () => {

    describe('.buildRotationMatrix', () => {

        it('should return identity Matrix3 for NULL', () => {
            const r = PANO.buildRotationMatrix(null);
            assert.deepEqual(r.toArray(), ri_elements);
        });

        it('should return Matrix3 by array[9] of numbers', () => {
            const r = PANO.buildRotationMatrix(elements);
            assert.deepEqual(r.toArray(), r_elements);
        });

        it('should throw exaption for array[1] of number', () => {
            expect(() => {
                PANO.buildRotationMatrix([0])
            }).toThrow();
        });

    });

    describe('.rotatePanoramicPixel', () => {

        it('should through exaption for the NOT Matrix3 as r argument', () => {
            expect(() => {
                PANO.rotatePanoramicPixel(0, 0, 0, 0, new Object())
            }).toThrow();
        });

        it('should rotate (100, 100, 1024, 512, r) => [93.5298378829093, 107.97992451851006]', () => {
            const [w, h] = [1024, 512];
            const [x, y] = [100, 100];
            const [x_exp, y_exp] = [93.5298378829093, 107.97992451851006];
            const r = PANO.buildRotationMatrix(elements);
            const [x_act, y_act] = PANO.rotatePanoramicPixel(x, y, w, h, r);
            expect(x_act).toBeCloseTo(x_exp, 5);
            expect(y_act).toBeCloseTo(y_exp, 5);
        });

        it('should get the same pixel coordinates after double rotation (second with Invered matrix)', () => {
            const [w, h] = [1024, 512];
            const [x, y] = [100, 100];
            const r = PANO.buildRotationMatrix(elements);
            const r_inverted = (r.clone()).invert();
            const [x_tmp, y_tmp] = PANO.rotatePanoramicPixel(x, y, w, h, r);
            const [x_bk, y_bk] = PANO.rotatePanoramicPixel(x_tmp, y_tmp, w, h, r_inverted);
            expect(x_bk).toBeCloseTo(x, 3);
            expect(y_bk).toBeCloseTo(y, 3);
        });

    });

});