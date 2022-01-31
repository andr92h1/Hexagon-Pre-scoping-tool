// viewer must have interface:
// VectorCapturer.prototype.viewerInterface
// +
// event positioncaptured
// evetn cursormoved
// event actionfinished
// event actioncanceled

function VectorCapturer(viewer) {

    // validate input, where is right place to do that???
    var vr1 = PUtilities.prototype.checkRequiredFields(viewer, VectorCapturer.prototype.viewerInterface);

    if (vr1.isValid == false) {
        throw vr1.msg;
    }

    // GENERAL

    var _it = null; // iterator
    var _sv = null; // scratch vertices
    var _templateFunction = null;
    var onCursorMoved = null; // init in this.Start
    var onActionFinished = null; // -//-
    var buildScratchGeometry = null; // -//-
    var context = this;

    // INTERFACE
    this.dispatcherDOM = document.createElement("div");

    this.getScratchGeometry = function () {
        if (buildScratchGeometry) {
            return buildScratchGeometry();
        } else {
            return null;
        }
    }

    // templateFunction = function(vertices, isScratch)
    // You can modify vertices as you need inside function. (isScratch = true) - will affect only on visualization
    // (isScratch = false) - will change captured vertices as result will affect on the next (isScratch = true) case.
    // You can return true during (isScratch = false) to finish capturization. 
    this.Start = function (geometryType, templateFunction = null) {

        // sanitary check
        if (onCursorMoved) {
            viewer.dispatcherDOM.removeEventListener('cursormoved', onCursorMoved);
        }

        if (onActionFinished) {
            viewer.dispatcherDOM.removeEventListener('actionfinished', onActionFinished);
        }

        viewer.dispatcherDOM.removeEventListener('actioncanceled', onActionCanceled);

        // initiate engine
        _templateFunction = templateFunction;

        if (geometryType == VectorCapturer.prototype.geometryType.lineString) {
            _it = lineStringEngine();
            onCursorMoved = onCursorMovedForLineString;
            onActionFinished = onActionFinishedForLineString;
            buildScratchGeometry = buildScratchGeometryForLineString;
        } else if (geometryType == VectorCapturer.prototype.geometryType.polygon) {
            _it = polygonEngine();
            onCursorMoved = onCursorMovedForPolygon;
            onActionFinished = onActionFinishedForPolygon;
            buildScratchGeometry = buildScratchGeometryForPolygon;
        } else {
            throw 'Unsupported geometry type:' + geometryType;
        }

        // run engine
        viewer.setCursorType('crosshair');
        _it.next();

        viewer.dispatcherDOM.addEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.addEventListener('actionfinished', onActionFinished);
        viewer.dispatcherDOM.addEventListener('actioncanceled', onActionCanceled);
    }

    this.Cancel = function () {
        cancel();
    }

    this.Dispose = function () {
        reset();
        delete this.dispatcherDOM;
    }

    // ENGINES
    // lineString
    function* lineStringEngine() {

        _sv = [];

        while (true) {
            var p = yield getPosition();
            _sv.push([p.x, p.y]);
        }
    }

    function onCursorMovedForLineString(e) {

        if (_sv && _sv.length > 0) {
            var svc = JSON.parse(JSON.stringify(_sv));
            svc.push([e.detail.position.x, e.detail.position.y]);
            viewer.drawScratchGeometry(turf.lineString(svc));
        }
    }

    function onActionFinishedForLineString(e) {

        viewer.drawScratchGeometry(null);

        if (_sv.length > 1) {
            dispatchFeatureCapturedEvent(turf.lineString(_sv));
        } else {
            dispatchCapturingCanceledEvent();
        }

        reset();
    }

    function buildScratchGeometryForLineString() {

        if (_sv && _sv.length > 0) {
            var svc = JSON.parse(JSON.stringify(_sv));

            if (svc.length == 1) {
                svc.push(JSON.parse(JSON.stringify(svc[0])));
            }

            return turf.lineString(svc).geometry;

        } else {
            return null;
        }
    }

    // polygon
    function* polygonEngine() {

        _sv = [[]];

        while (true) {
            var p = yield getPosition();

            if (_sv[0].length == 0) {
                var tmp = [p.x, p.y]; // add first and last point as a same object
                _sv[0].push(
                    JSON.parse(JSON.stringify(tmp)),
                    JSON.parse(JSON.stringify(tmp))
                );
            } else {
                _sv[0].splice(_sv[0].length - 1, 0, [p.x, p.y]);
            }

            if (_templateFunction) {
                var res = _templateFunction(_sv, false);

                if (res) {
                    setTimeout(onActionFinishedForPolygon, 0);
                }
            }
        }
    }

    function onCursorMovedForPolygon(e) {

        if (_sv && _sv[0].length > 1) {
            var svc = JSON.parse(JSON.stringify(_sv));

            svc[0].splice(_sv[0].length - 1, 0, [e.detail.position.x, e.detail.position.y]);

            // LinearRing of a Polygon must have 4 or more Positions [turf]
            if (svc[0].length == 3) {
                svc[0].splice(_sv[0].length - 1, 0, [e.detail.position.x, e.detail.position.y]);
            }

            if (_templateFunction) {
                _templateFunction(svc, true);
            }

            viewer.drawScratchGeometry(turf.polygon(svc));
        }
    }

    function onActionFinishedForPolygon(e) {

        viewer.drawScratchGeometry(null);

        if (_sv[0].length > 3) {
            dispatchFeatureCapturedEvent(turf.polygon(_sv));
        } else {
            dispatchCapturingCanceledEvent();
        }

        reset();
    }

    function buildScratchGeometryForPolygon() {

        if (_sv && _sv[0].length > 0 && _sv[0].length > 3) {

            var svc = JSON.parse(JSON.stringify(_sv));

            if (svc[0].length == 2) {
                svc[0].push(JSON.parse(JSON.stringify(svc[0])));
            }

            if (svc[0].length == 3) {
                svc[0].push(JSON.parse(JSON.stringify(svc[0])));
            }

            return turf.polygon(_sv).geometry;

        } else {
            return null;
        }
    }

    // EVENT

    function dispatchFeatureCapturedEvent(feature) {

        var event = new CustomEvent('featurecaptured', {
            detail: {
                feature: feature
            }
        });

        context.dispatcherDOM.dispatchEvent(event);
    }

    function dispatchCapturingCanceledEvent() {

        var event = new CustomEvent('capturingcanceled', {
            detail: {
                // add something if need...
            }
        });

        context.dispatcherDOM.dispatchEvent(event);
    }

    // HELPERS

    function getPosition() {
        viewer.setCursorType('crosshair');
        viewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCaptured);
        viewer.dispatcherDOM.addEventListener('positioncaptured', onPositionCaptured);
    }

    function onPositionCaptured(e) {
        viewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCaptured);
        _it.next(e.detail.position);
    }

    function onActionCanceled(e) {
        cancel();
        dispatchCapturingCanceledEvent();
    }

    function reset() {

        viewer.setCursorType('default');
        viewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCaptured);
        viewer.dispatcherDOM.removeEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.removeEventListener('actionfinished', onActionFinished);
        viewer.dispatcherDOM.removeEventListener('actioncanceled', onActionCanceled);

        if (_it) {
            _it.return();
        }

        _it = null;
        _sv = null;
        _templateFunction = null;
        onCursorMoved = null;
        onActionFinished = null;
        buildScratchGeometry = null;
    }

    function cancel() {
        viewer.drawScratchGeometry(null);
        reset();
    }

}

VectorCapturer.prototype.viewerInterface = [
    'showInfoMsg',
    'dispatcherDOM',
    'setCursorType',
    'drawScratchGeometry'
];

// https://datatracker.ietf.org/doc/html/rfc7946
VectorCapturer.prototype.geometryType = {
    lineString: 'LineString',
    polygon: 'Polygon'
}

VectorCapturer.prototype.rectangleTemplate = function (v, isScratch = false) {

    // skip (isScratch = false)
    if (v[0].length < 4) {
        return false;
    }

    // first segment capturing
    if (v[0][1][0] == v[0][2][0] && v[0][1][1] == v[0][2][1]) {
        return false;
    }

    // handle rectangle geometry
    v[0].splice(v[0].length - 1, 0, [v[0][0][0], v[0][0][1]]);

    var rp = PUtilities.prototype.relativePosition(v[0][0], v[0][1], v[0][2]);
    var dis = PUtilities.prototype.distanceFromPointToLine(v[0][0], v[0][1], v[0][2]);
    var dir = PUtilities.prototype.direction(v[0][1][0] - v[0][0][0], v[0][1][1] - v[0][0][1]);

    if (rp > 0) {
        dir -= Math.PI / 2;
    } else {
        dir += Math.PI / 2;
    }

    var dx = Math.sin(dir) * dis;
    var dy = Math.cos(dir) * dis;

    v[0][2][0] = v[0][1][0] + dx;
    v[0][2][1] = v[0][1][1] + dy;

    v[0][3][0] = v[0][0][0] + dx;
    v[0][3][1] = v[0][0][1] + dy;

    return isScratch == false;
}

VectorCapturer.prototype.bboxTemplate = function (v, isScratch = false) {

    var l = v[0].length;

    // build bbox
    if (isScratch == true || (isScratch == false && l == 3)) {

        // get bbox
        var minx = v[0][0][0];
        var miny = v[0][0][1];
        var maxx = v[0][0][0];
        var maxy = v[0][0][1];

        for (var p of v[0]) {
            minx = Math.min(minx, p[0]);
            miny = Math.min(miny, p[1]);
            maxx = Math.max(maxx, p[0]);
            maxy = Math.max(maxy, p[1]);
        }

        // contron number of vertices, for bbox we need 4 + 1 (close)
        while (v[0].length < 5) {
            v[0].splice(v[0].length - 1, 0, [v[0][0][0], v[0][0][1]]);
        }

        v[0][0][0] = minx;
        v[0][0][1] = miny;

        v[0][1][0] = minx;
        v[0][1][1] = maxy;

        v[0][2][0] = maxx;
        v[0][2][1] = maxy;

        v[0][3][0] = maxx;
        v[0][3][1] = miny;

        v[0][4][0] = minx;
        v[0][4][1] = miny;
    }

    // finish capturization ones second vertex captured
    if (isScratch == false && l == 3) {
        return true;
    }

}