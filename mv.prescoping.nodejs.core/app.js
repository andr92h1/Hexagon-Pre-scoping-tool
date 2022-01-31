'use strict';

const assert = require('assert');
const PSULIB = require('./lib/psulib');

//const MVMD = require('./lib/multivista-metadata');

//const credentials = {
//    username: 'multiviewer@multivista.com',
//    password: 'Leica123*'
//}

//MVMD.getPhotos('8781B12D-E943-4EA2-9D03-B178BD71EB5F', '2021-05-24', credentials).then(photos => {
//    var t = 1;
//});

// TEST buildRotationMatrix/rotatePanoramicPixel
// from raw to aligned


/*
 
    0: 0.99998619
    1: 0.00263214
    2: 0.00555143
    3: -0.00288618
    4: 0.99844784
    5: 0.05561726
    6: -0.00448656
    7: -0.05563249
    8: 0.99843714
 
 */

var elements = [0.99998619, -0.00288618, -0.00448656, 0.00263214, 0.99844784, -0.05563249, 0.00555143, 0.05561726, 0.99843714];
var r_elements = [elements[0], elements[3], elements[6], elements[1], elements[4], elements[7], elements[2], elements[5], elements[8]];

const r = PSULIB.PANO.buildRotationMatrix(elements);
assert.deepEqual(r.toArray(), r_elements);


const rf = PSULIB.PANO.buildRotationMatrix([0.99998619, -0.00288618, -0.00448656, 0.00263214, 0.99844784, -0.05563249, 0.00555143, 0.05561726, 0.99843714]);

// from aligned to raw
const rb = rf.clone();
rb.invert();

const [x_ali, y_ali] = [100, 100];
const [x_raw, y_raw] = PSULIB.PANO.rotatePanoramicPixel(x_ali, y_ali, 1024, 512, rf);
const [x_ali_back, y_ali_back] = PSULIB.PANO.rotatePanoramicPixel(x_raw, y_raw, 1024, 512, rb);

console.log([x_ali, y_ali]);
console.log([x_ali_back, y_ali_back]);

assert.ok(Math.abs(x_ali - x_ali_back) < 0.001 && Math.abs(y_ali - y_ali_back) < 0.001);

// TEST uvToXyz & xyxToUv
const [u, v] = [0.25, 0.25];
var xyz = PSULIB.PANO.uvToXyz(0.25, 0.25, 1);
const [u_, v_] = PSULIB.PANO.xyxToUv(xyz.x, xyz.y, xyz.z);
assert.ok(Math.abs(u - u_) < 0.001 && Math.abs(v - v_) < 0.001);
