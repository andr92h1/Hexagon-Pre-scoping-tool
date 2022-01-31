const { Matrix3 } = require('./three/Matrix3');
const { Vector3 } = require('./three/Vector3');
const { Euler } = require('./three/Euler');

exports.rotatePanoramicPixel = function (x, y, w, h, r) {

    if (r instanceof Matrix3 == false) {
        throw new Error('Incorrect type of the rotation matrix, use function buildRotationMatrix to get correct instance!');
    }

    var x_ang = (x - w / 2 - 0.5) / w * Math.PI * 2;
    var y_ang = -(y - h / 2 - 0.5) / h * Math.PI;

    var x_new = Math.cos(y_ang) * Math.sin(x_ang);
    var y_new = Math.cos(y_ang) * Math.cos(x_ang);
    var z_new = Math.sin(y_ang);

    var xyz = new Vector3(x_new, y_new, z_new);
    xyz.applyMatrix3(r);

    var dist_xy = Math.sqrt(xyz.x * xyz.x + xyz.y * xyz.y);
    dist_xy = Math.max(dist_xy, 0.000001);
    var dist_xyz = Math.sqrt(xyz.x * xyz.x + xyz.y * xyz.y + xyz.z * xyz.z);
    var v = Math.asin(xyz.z / dist_xyz);
    var u = Math.asin(xyz.x / dist_xy);

    var isValid = (xyz.y < 0) && (u >= 0);

    if (isValid) {
        u = Math.PI - u;
    }

    isValid = (xyz.y < 0) && (u <= 0);

    if (isValid) {
        u = -Math.PI - u;
    }

    if (isNaN(u)) {
        u = 0;
    }

    var px = (u + Math.PI) / (2 * Math.PI) * w + 0.5;
    var py = (-v + Math.PI / 2) / Math.PI * h + 0.5;

    return [px, py];
};

exports.buildRotationMatrix = function (components = null) {

    const r = new Matrix3();

    if (components === null) {
        return r;
    }

    if (Array.isArray(components) == false || components.length != 9) {
        throw new Error('buildRotationmatrix expects array of float as an input argument');
    }

    r.set(...components);

    return r;
};

exports.uvToXyz = function (u, v, h, rz = 0) {
    // add analis for extrym cases!!!!
    var dz = (0.5 - u) * Math.PI * 2;
    var dx = (0.5 - v) * Math.PI;
    var euler = new Euler(dx, 0, dz + rz, 'ZXY');
    var tv = new Vector3(0, 1, 0);
    tv.applyEuler(euler);
    tv.multiplyScalar(Math.abs(h / tv.z)); // scale up/down to h
    return tv;
}

exports.xyxToUv = function (x, y, z, rz = 0) {
    // add analis for extrym cases for v!!!
    var u;

    if (x == 0 && y == 0) {
        u = 0.5;
    } else if (x == 0 && y == 1) {
        u = 0.5;
    } else if (x == 0 && y == -1) {
        u = 0.0;
    } else if (x == -1 && y == 0) {
        u = 0.25;
    } else if (x == 1 && y == 0) {
        u = 0.75;
    } else {
        if (y > 0) {
            u = 0.5 + Math.atan(x / y) / (Math.PI * 2);
        }
        else {
            if (x > 0) {
                u = 0.5 + (Math.PI + Math.atan(x / y)) / (Math.PI * 2);
            }
            else {
                u = 0.5 + (-Math.PI + Math.atan(x / y)) / (Math.PI * 2);
            }
        }
    }

    // apply correction due to ratation
    u += rz / (Math.PI * 2);

    if (u > 1) {
        u--;
    } else if (u < 0) {
        u++;
    }

    var v = 0.5 - Math.atan(z / Math.sqrt(x * x + y * y)) / Math.PI;

    return [u, v];
}