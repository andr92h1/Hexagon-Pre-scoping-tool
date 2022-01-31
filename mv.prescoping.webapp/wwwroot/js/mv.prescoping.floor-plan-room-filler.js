// viewer must have interface:
// FloorPlanSync.prototype.viewerInterface
function FloorPlanRoomFiller(viewer) {

    // validate input, where is right place to do that ???
    var vr = PUtilities.prototype.checkRequiredFields(viewer, FloorPlanSync.prototype.viewerInterface);

    if (vr.isValid == false) {
        throw vr.msg;
    }

    var _groups = {};
    var _context = this;
    var _pt = 0.001;
    var _isActive = false;

    // INTERFACE

    this.styleDefault = {
        color: "green",
        fillOpacity: 0.33,
        width: 0
    }

    this.Start = function () {

        reset();
        init();
        _isActive = true;
    }

    this.Update = function (entities) {

        if (_isActive) {
            update(entities);
        }

    }

    this.Stop = function () {

        reset();
        _isActive = false;
    }

    this.Dispose = function () {

        reset();
        _isActive = false;
    }

    // HELPER

    function init() {

        // build groups
        for (var item of viewer.featureCollection.features) {

            if (typeof _groups[item.parentId] == 'undefined') {
                _groups[item.parentId] = new Room();
                _groups[item.parentId].entities = [item];
            } else {
                _groups[item.parentId].entities.push(item);
            }

        }

        // try polygonize
        for (var key in _groups) {
            var v = PUtilities.prototype.polygonize(_groups[key].entities, _pt);

            if (v != null) {
                var p = turf.polygon([v], { id: key }, { id: key });
                _groups[key].fillFeature = p;
                viewer.addFeature(p, 'id', _context.styleDefault);
            }
        }
    }

    function update(entities) {

        // identify parent ids
        var pids = new Set();

        for (var item of entities) {
            pids.add(item.parentId);
        }

        // refresh groups
        for (var pid of pids) {
            if (typeof _groups[pid] != 'undefined') {
                _groups[pid].entities = [];
            }
        }

        for (var item of viewer.featureCollection.features) {
            if (pids.has(item.parentId)) {
                if (typeof _groups[item.parentId] == 'undefined') {
                    _groups[item.parentId] = new Room();
                    _groups[item.parentId].entities = [item];
                } else {
                    _groups[item.parentId].entities.push(item);
                }
            }
        }

        // update map
        for (var pid of pids) {
            if (_groups[pid].entities.length == 0 && _groups[pid].fillFeature != null) {
                // remove completelly
                viewer.removeFeature(_groups[pid].fillFeature, 'id');
                delete _groups[pid];
            } else if (_groups[pid].entities.length != 0 && _groups[pid].fillFeature != null) {
                // update existing
                var v = PUtilities.prototype.polygonize(_groups[pid].entities, _pt);

                if (v == null) {
                    // could not build polygon - remove fill
                    viewer.removeFeature(_groups[pid].fillFeature, 'id');
                    _groups[pid].fillFeature = null;
                } else {
                    // could build polygon - update fill
                    _groups[pid].fillFeature.geometry.coordinates = [v];
                    viewer.updateFeature(_groups[pid].fillFeature, 'id', _context.styleDefault);
                }
            } else if (_groups[pid].entities.length != 0 && _groups[pid].fillFeature == null) {
                // new one
                var v = PUtilities.prototype.polygonize(_groups[pid].entities, _pt);

                if (v != null) {
                    var p = turf.polygon([v], { id: pid }, { id: pid });
                    _groups[pid].fillFeature = p;
                    viewer.addFeature(p, 'id', _context.styleDefault);
                }
            }
        }

    }

    function reset() {

        for (var key in _groups) {

            if (_groups[key].fillFeature) {
                viewer.removeFeature(_groups[key].fillFeature);
            }
        }

        _groups = {};
    }

    function Room() {
        this.entities = [];
        this.fillFeature = null;
    }
}

FloorPlanSync.prototype.viewerInterface = ['dispatcherDOM', 'addFeature', 'updateFeature', 'removeFeature'];