// viewer must have interface:
// FloorPlanSync.prototype.viewerInterface
// +
// event camerastatechanged
function FloorPlanSync(...viewers) {

    // validate input, where is right place to do that ???
    for (var v of viewers) {
        var vr = PUtilities.prototype.checkRequiredFields(v, FloorPlanSync.prototype.viewerInterface);

        if (vr.isValid == false) {
            throw vr.msg;
        }
    }

    // INTERFACE
    this.Start = function () {

        reset();

        for (var v of viewers) {
            v.dispatcherDOM.addEventListener('camerastatechanged', cameraStateChangedHandler);
        }
    }

    this.Stop = function () {
        reset();
    }

    this.Dispose = function () {
        reset();
    }

    // HELPER
    function cameraStateChangedHandler(e) {
        for (var v of viewers) {
            if (e.detail.guid != v.guid) {
                v.moveToPosition(e.detail.camera.position);
            }
        }
    }

    function reset() {
        for (var v of viewers) {
            v.dispatcherDOM.removeEventListener('camerastatechanged', cameraStateChangedHandler);
        }
    }

}

FloorPlanSync.prototype.viewerInterface = ['moveToPosition', 'dispatcherDOM'];