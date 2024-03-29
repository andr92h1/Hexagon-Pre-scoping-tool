"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateUUID = generateUUID;
exports.clamp = clamp;
exports.euclideanModulo = euclideanModulo;
exports.mapLinear = mapLinear;
exports.inverseLerp = inverseLerp;
exports.lerp = lerp;
exports.damp = damp;
exports.pingpong = pingpong;
exports.smoothstep = smoothstep;
exports.smootherstep = smootherstep;
exports.randInt = randInt;
exports.randFloat = randFloat;
exports.randFloatSpread = randFloatSpread;
exports.seededRandom = seededRandom;
exports.degToRad = degToRad;
exports.radToDeg = radToDeg;
exports.isPowerOfTwo = isPowerOfTwo;
exports.ceilPowerOfTwo = ceilPowerOfTwo;
exports.floorPowerOfTwo = floorPowerOfTwo;
exports.setQuaternionFromProperEuler = setQuaternionFromProperEuler;
exports.RAD2DEG = exports.DEG2RAD = void 0;
var _lut = [];

for (var i = 0; i < 256; i++) {
  _lut[i] = (i < 16 ? '0' : '') + i.toString(16);
}

var _seed = 1234567;
var DEG2RAD = Math.PI / 180;
exports.DEG2RAD = DEG2RAD;
var RAD2DEG = 180 / Math.PI; // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136

exports.RAD2DEG = RAD2DEG;

function generateUUID() {
  var d0 = Math.random() * 0xffffffff | 0;
  var d1 = Math.random() * 0xffffffff | 0;
  var d2 = Math.random() * 0xffffffff | 0;
  var d3 = Math.random() * 0xffffffff | 0;
  var uuid = _lut[d0 & 0xff] + _lut[d0 >> 8 & 0xff] + _lut[d0 >> 16 & 0xff] + _lut[d0 >> 24 & 0xff] + '-' + _lut[d1 & 0xff] + _lut[d1 >> 8 & 0xff] + '-' + _lut[d1 >> 16 & 0x0f | 0x40] + _lut[d1 >> 24 & 0xff] + '-' + _lut[d2 & 0x3f | 0x80] + _lut[d2 >> 8 & 0xff] + '-' + _lut[d2 >> 16 & 0xff] + _lut[d2 >> 24 & 0xff] + _lut[d3 & 0xff] + _lut[d3 >> 8 & 0xff] + _lut[d3 >> 16 & 0xff] + _lut[d3 >> 24 & 0xff]; // .toUpperCase() here flattens concatenated strings to save heap memory space.

  return uuid.toUpperCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
} // compute euclidian modulo of m % n
// https://en.wikipedia.org/wiki/Modulo_operation


function euclideanModulo(n, m) {
  return (n % m + m) % m;
} // Linear mapping from range <a1, a2> to range <b1, b2>


function mapLinear(x, a1, a2, b1, b2) {
  return b1 + (x - a1) * (b2 - b1) / (a2 - a1);
} // https://www.gamedev.net/tutorials/programming/general-and-gameplay-programming/inverse-lerp-a-super-useful-yet-often-overlooked-function-r5230/


function inverseLerp(x, y, value) {
  if (x !== y) {
    return (value - x) / (y - x);
  } else {
    return 0;
  }
} // https://en.wikipedia.org/wiki/Linear_interpolation


function lerp(x, y, t) {
  return (1 - t) * x + t * y;
} // http://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/


function damp(x, y, lambda, dt) {
  return lerp(x, y, 1 - Math.exp(-lambda * dt));
} // https://www.desmos.com/calculator/vcsjnyz7x4


function pingpong(x) {
  var length = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
  return length - Math.abs(euclideanModulo(x, length * 2) - length);
} // http://en.wikipedia.org/wiki/Smoothstep


function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  x = (x - min) / (max - min);
  return x * x * (3 - 2 * x);
}

function smootherstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  x = (x - min) / (max - min);
  return x * x * x * (x * (x * 6 - 15) + 10);
} // Random integer from <low, high> interval


function randInt(low, high) {
  return low + Math.floor(Math.random() * (high - low + 1));
} // Random float from <low, high> interval


function randFloat(low, high) {
  return low + Math.random() * (high - low);
} // Random float from <-range/2, range/2> interval


function randFloatSpread(range) {
  return range * (0.5 - Math.random());
} // Deterministic pseudo-random float in the interval [ 0, 1 ]


function seededRandom(s) {
  if (s !== undefined) _seed = s % 2147483647; // Park-Miller algorithm

  _seed = _seed * 16807 % 2147483647;
  return (_seed - 1) / 2147483646;
}

function degToRad(degrees) {
  return degrees * DEG2RAD;
}

function radToDeg(radians) {
  return radians * RAD2DEG;
}

function isPowerOfTwo(value) {
  return (value & value - 1) === 0 && value !== 0;
}

function ceilPowerOfTwo(value) {
  return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}

function floorPowerOfTwo(value) {
  return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
}

function setQuaternionFromProperEuler(q, a, b, c, order) {
  // Intrinsic Proper Euler Angles - see https://en.wikipedia.org/wiki/Euler_angles
  // rotations are applied to the axes in the order specified by 'order'
  // rotation by angle 'a' is applied first, then by angle 'b', then by angle 'c'
  // angles are in radians
  var cos = Math.cos;
  var sin = Math.sin;
  var c2 = cos(b / 2);
  var s2 = sin(b / 2);
  var c13 = cos((a + c) / 2);
  var s13 = sin((a + c) / 2);
  var c1_3 = cos((a - c) / 2);
  var s1_3 = sin((a - c) / 2);
  var c3_1 = cos((c - a) / 2);
  var s3_1 = sin((c - a) / 2);

  switch (order) {
    case 'XYX':
      q.set(c2 * s13, s2 * c1_3, s2 * s1_3, c2 * c13);
      break;

    case 'YZY':
      q.set(s2 * s1_3, c2 * s13, s2 * c1_3, c2 * c13);
      break;

    case 'ZXZ':
      q.set(s2 * c1_3, s2 * s1_3, c2 * s13, c2 * c13);
      break;

    case 'XZX':
      q.set(c2 * s13, s2 * s3_1, s2 * c3_1, c2 * c13);
      break;

    case 'YXY':
      q.set(s2 * c3_1, c2 * s13, s2 * s3_1, c2 * c13);
      break;

    case 'ZYZ':
      q.set(s2 * s3_1, s2 * c3_1, c2 * s13, c2 * c13);
      break;

    default:
      console.warn('THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: ' + order);
  }
}