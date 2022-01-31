// viewer must have interface:
// FloorPlanSync.prototype.viewerInterface
// +
// event positioncaptured
// evetn cursormoved
// event actionfinished
// event actioncanceled
function LengthMeasurer(viewer) {

    // validate input, where is right place to do that ???
    var vr = PUtilities.prototype.checkRequiredFields(viewer, LengthMeasurer.prototype.viewerInterface);

    if (vr.isValid == false) {
        throw vr.msg;
    }

    var _it = null;
    var _sv = []; 

    // INTERFACE
    this.Start = function () {

        reset();

        viewer.setCursorType('crosshair');
        viewer.dispatcherDOM.addEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.addEventListener('actionfinished', onActionFinished);
        viewer.dispatcherDOM.addEventListener('actioncanceled', onActionCanceled);

        viewer.showInfoMsg('click to start measurments...');
        viewer.drawScratchGeometry(null);

        _it = lengthMeasurerEngine();
        _it.next();
    }

    this.Stop = function () {
        reset();
    }

    this.Cleanup = function () {
        cancel();
    }

    this.Dispose = function () {
        reset();
    }

    // HELPER

    function* lengthMeasurerEngine() {

        _sv = [];

        while (true) {
            var p = yield getPosition();
            _sv.push([p.x, p.y]);
        }
    }

    function onPositionCaptured(e) {
        viewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCaptured);
        _it.next(e.detail.position);
    }

    function onCursorMoved(e) {

        if (_sv && _sv.length > 0) {
            var svc = JSON.parse(JSON.stringify(_sv));
            svc.push([e.detail.position.x, e.detail.position.y]);

            update(svc);
        }
    }

    function onActionFinished(e) {

        if (_sv.length > 1) {
            var svc = JSON.parse(JSON.stringify(_sv));
            update(svc);
        } else {
            viewer.drawScratchGeometry(null);
            viewer.showInfoMsg('');
        }

        reset();
    }

    function onActionCanceled(e) {
        cancel();
    }

    function getPosition() {
        viewer.setCursorType('crosshair');
        viewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCaptured);
        viewer.dispatcherDOM.addEventListener('positioncaptured', onPositionCaptured);
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
    }

    function cancel() {
        viewer.drawScratchGeometry(null);
        viewer.showInfoMsg('');
        reset();
    }

    function update(v) {
        var f = turf.lineString(v);
        var l = getLength(f);
        viewer.drawScratchGeometry(f);
        viewer.showInfoMsg('L = ' + l.toFixed(2) + ' m.');
    }

    function getLength(geoJson) {

        var length = 0;

        turf.segmentEach(geoJson, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
            var c = currentSegment.geometry.coordinates;
            length += Math.sqrt(Math.pow(c[1][0] - c[0][0], 2) + Math.pow(c[1][1] - c[0][1], 2));
        });

        return length;
    }

}

LengthMeasurer.prototype.viewerInterface = ['showInfoMsg', 'dispatcherDOM', 'drawScratchGeometry'];