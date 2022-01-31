exports.toFormatString = function (date, format) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthDay = date.getDate();
    return year + '-' + (month < 10 ? '0' + month : month) + '-' + (monthDay < 10 ? '0' + monthDay : monthDay);
}
const { Matrix3 } = require('three/src/math/Matrix3');
const { Vector3 } = require('three/src/math/Vector3');

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