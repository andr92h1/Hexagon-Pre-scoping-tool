"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Euler = void 0;

var _Quaternion = require("./Quaternion.js");

var _Vector = require("./Vector3.js");

var _Matrix = require("./Matrix4.js");

var _MathUtils = require("./MathUtils.js");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var _matrix = /*@__PURE__*/new _Matrix.Matrix4();

var _quaternion = /*@__PURE__*/new _Quaternion.Quaternion();

var Euler = /*#__PURE__*/function () {
  function Euler() {
    var x = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    var y = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var z = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var order = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : Euler.DefaultOrder;

    _classCallCheck(this, Euler);

    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
  }

  _createClass(Euler, [{
    key: "x",
    get: function get() {
      return this._x;
    },
    set: function set(value) {
      this._x = value;

      this._onChangeCallback();
    }
  }, {
    key: "y",
    get: function get() {
      return this._y;
    },
    set: function set(value) {
      this._y = value;

      this._onChangeCallback();
    }
  }, {
    key: "z",
    get: function get() {
      return this._z;
    },
    set: function set(value) {
      this._z = value;

      this._onChangeCallback();
    }
  }, {
    key: "order",
    get: function get() {
      return this._order;
    },
    set: function set(value) {
      this._order = value;

      this._onChangeCallback();
    }
  }, {
    key: "set",
    value: function set(x, y, z) {
      var order = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : this._order;
      this._x = x;
      this._y = y;
      this._z = z;
      this._order = order;

      this._onChangeCallback();

      return this;
    }
  }, {
    key: "clone",
    value: function clone() {
      return new this.constructor(this._x, this._y, this._z, this._order);
    }
  }, {
    key: "copy",
    value: function copy(euler) {
      this._x = euler._x;
      this._y = euler._y;
      this._z = euler._z;
      this._order = euler._order;

      this._onChangeCallback();

      return this;
    }
  }, {
    key: "setFromRotationMatrix",
    value: function setFromRotationMatrix(m) {
      var order = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._order;
      var update = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
      var te = m.elements;
      var m11 = te[0],
          m12 = te[4],
          m13 = te[8];
      var m21 = te[1],
          m22 = te[5],
          m23 = te[9];
      var m31 = te[2],
          m32 = te[6],
          m33 = te[10];

      switch (order) {
        case 'XYZ':
          this._y = Math.asin((0, _MathUtils.clamp)(m13, -1, 1));

          if (Math.abs(m13) < 0.9999999) {
            this._x = Math.atan2(-m23, m33);
            this._z = Math.atan2(-m12, m11);
          } else {
            this._x = Math.atan2(m32, m22);
            this._z = 0;
          }

          break;

        case 'YXZ':
          this._x = Math.asin(-(0, _MathUtils.clamp)(m23, -1, 1));

          if (Math.abs(m23) < 0.9999999) {
            this._y = Math.atan2(m13, m33);
            this._z = Math.atan2(m21, m22);
          } else {
            this._y = Math.atan2(-m31, m11);
            this._z = 0;
          }

          break;

        case 'ZXY':
          this._x = Math.asin((0, _MathUtils.clamp)(m32, -1, 1));

          if (Math.abs(m32) < 0.9999999) {
            this._y = Math.atan2(-m31, m33);
            this._z = Math.atan2(-m12, m22);
          } else {
            this._y = 0;
            this._z = Math.atan2(m21, m11);
          }

          break;

        case 'ZYX':
          this._y = Math.asin(-(0, _MathUtils.clamp)(m31, -1, 1));

          if (Math.abs(m31) < 0.9999999) {
            this._x = Math.atan2(m32, m33);
            this._z = Math.atan2(m21, m11);
          } else {
            this._x = 0;
            this._z = Math.atan2(-m12, m22);
          }

          break;

        case 'YZX':
          this._z = Math.asin((0, _MathUtils.clamp)(m21, -1, 1));

          if (Math.abs(m21) < 0.9999999) {
            this._x = Math.atan2(-m23, m22);
            this._y = Math.atan2(-m31, m11);
          } else {
            this._x = 0;
            this._y = Math.atan2(m13, m33);
          }

          break;

        case 'XZY':
          this._z = Math.asin(-(0, _MathUtils.clamp)(m12, -1, 1));

          if (Math.abs(m12) < 0.9999999) {
            this._x = Math.atan2(m32, m22);
            this._y = Math.atan2(m13, m11);
          } else {
            this._x = Math.atan2(-m23, m33);
            this._y = 0;
          }

          break;

        default:
          console.warn('THREE.Euler: .setFromRotationMatrix() encountered an unknown order: ' + order);
      }

      this._order = order;
      if (update === true) this._onChangeCallback();
      return this;
    }
  }, {
    key: "setFromQuaternion",
    value: function setFromQuaternion(q, order, update) {
      _matrix.makeRotationFromQuaternion(q);

      return this.setFromRotationMatrix(_matrix, order, update);
    }
  }, {
    key: "setFromVector3",
    value: function setFromVector3(v) {
      var order = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this._order;
      return this.set(v.x, v.y, v.z, order);
    }
  }, {
    key: "reorder",
    value: function reorder(newOrder) {
      // WARNING: this discards revolution information -bhouston
      _quaternion.setFromEuler(this);

      return this.setFromQuaternion(_quaternion, newOrder);
    }
  }, {
    key: "equals",
    value: function equals(euler) {
      return euler._x === this._x && euler._y === this._y && euler._z === this._z && euler._order === this._order;
    }
  }, {
    key: "fromArray",
    value: function fromArray(array) {
      this._x = array[0];
      this._y = array[1];
      this._z = array[2];
      if (array[3] !== undefined) this._order = array[3];

      this._onChangeCallback();

      return this;
    }
  }, {
    key: "toArray",
    value: function toArray() {
      var array = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      array[offset] = this._x;
      array[offset + 1] = this._y;
      array[offset + 2] = this._z;
      array[offset + 3] = this._order;
      return array;
    }
  }, {
    key: "toVector3",
    value: function toVector3(optionalResult) {
      if (optionalResult) {
        return optionalResult.set(this._x, this._y, this._z);
      } else {
        return new _Vector.Vector3(this._x, this._y, this._z);
      }
    }
  }, {
    key: "_onChange",
    value: function _onChange(callback) {
      this._onChangeCallback = callback;
      return this;
    }
  }, {
    key: "_onChangeCallback",
    value: function _onChangeCallback() {}
  }]);

  return Euler;
}();

exports.Euler = Euler;
Euler.prototype.isEuler = true;
Euler.DefaultOrder = 'XYZ';
Euler.RotationOrders = ['XYZ', 'YZX', 'ZXY', 'XZY', 'YXZ', 'ZYX'];