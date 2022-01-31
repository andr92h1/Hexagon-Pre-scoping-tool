// viewer must have interface:
// FloorPlanMatcher.prototype.viewerInterface
// +
// event positioncaptured

function FloorPlanScaler(viewer) {

    // validate input, where is right place to do that???
    var vr = PUtilities.prototype.checkRequiredFields(viewer, FloorPlanScaler.prototype.viewerInterface);

    if (vr.isValid == false) {
        throw vr.msg;
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

        viewer.showInfoMsg('Click on position #1');
        var p1 = yield getPosition();
        viewer.showInfoMsg('');

        viewer.showInfoMsg('Click on position #2');
        var p2 = yield getPosition();
        viewer.showInfoMsg('');

        var distanceStr = prompt('Distance between positions in meters?');
        var distance = parseFloat(distanceStr);

        if (isNaN(distance) == true || distance <= 0) {
            alert('Incorrect distance value: ' + distance);
            context.Cancel();
        } else {
            // calculate matrix
            var tm = PUtilities.prototype.calculateTransformScaleOnly(p1, p2, distance);
            dispatchTransformationCalculatedEvent(tm);
        }

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
    function getPosition() {

        viewer.setCursorType('crosshair');
        viewer.dispatcherDOM.removeEventListener('positioncaptured', onPositionCaptured);
        viewer.dispatcherDOM.addEventListener('positioncaptured', onPositionCaptured, { once: true });
    }

    function onPositionCaptured(e) {

        viewer.setCursorType('default');
        _it.next(e.detail.position);
    }

}

FloorPlanScaler.prototype.viewerInterface = ['showInfoMsg', 'setCursorType'];