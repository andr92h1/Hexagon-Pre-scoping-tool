// viewer must have interface:
// FloorPlanMatcher.prototype.viewerInterface
// +
// event positioncaptured

function FloorPlanMatcher(masterViewer, slaveViewer) {

    // validate input, where is right place to do that???
    var vr1 = PUtilities.prototype.checkRequiredFields(masterViewer, FloorPlanMatcher.prototype.viewerInterface);

    if (vr1.isValid == false) {
        throw vr1.msg;
    }

    var vr2 = PUtilities.prototype.checkRequiredFields(slaveViewer, FloorPlanMatcher.prototype.viewerInterface);

    if (vr2.isValid == false) {
        throw vr2.msg;
    }

    var _it = null;
    var context = this;

    // INTERFACE
    this.dispatcherDOM = document.createElement("div");

    this.Start = function () {

        _it = main();
        _it.next();
    }

    this.Cancel = function () {

        if (_it) {
            _it.return();
        }

        _it = null;
    }

    // ENGINE
    function* main() {

        masterViewer.showInfoMsg('Click on position #1');
        var pm1 = yield getPositionMasterViewer();
        masterViewer.showInfoMsg('');

        slaveViewer.showInfoMsg('Click on position #1');
        var ps1 = yield getPositionSlaveViewer();
        slaveViewer.showInfoMsg('');

        masterViewer.showInfoMsg('Click on position #2');
        var pm2 = yield getPositionMasterViewer();
        masterViewer.showInfoMsg('');

        slaveViewer.showInfoMsg('Click on position #2');
        var ps2 = yield getPositionSlaveViewer()
        slaveViewer.showInfoMsg('');

        // calculate matrix
        var tm = PUtilities.prototype.calculateTransform2D(pm1, ps1, pm2, ps2);
        dispatchTransformationCalculatedEvent(tm);
    }

    // EVENT
    function dispatchTransformationCalculatedEvent(tm) {

        var event = new CustomEvent('transformationcalculated', {
            detail: {
                tk: tm.toArray()
            }
        });

        context.dispatcherDOM.dispatchEvent(event);

    }

    // HELPERS
    function getPositionMasterViewer() {

        masterViewer.setCursorType('crosshair');
        masterViewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCapturedMasterViewer);
        masterViewer.dispatcherDOM.addEventListener('positioncaptured', onPositionCapturedMasterViewer, { once: true });
    }

    function onPositionCapturedMasterViewer(e) {

        masterViewer.setCursorType('default');
        _it.next(e.detail.position);
    }

    function getPositionSlaveViewer() {

        slaveViewer.setCursorType('crosshair');
        slaveViewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCapturedSlaveViewer);
        slaveViewer.dispatcherDOM.addEventListener('positioncaptured', onPositionCapturedSlaveViewer, { once: true });
    }

    function onPositionCapturedSlaveViewer(e) {

        slaveViewer.setCursorType('default');
        _it.next(e.detail.position);
    }

}

FloorPlanMatcher.prototype.viewerInterface = ['showInfoMsg', 'setTransformationMatrix', 'getTransformationMatrix', 'dispatcherDOM', 'setCursorType'];