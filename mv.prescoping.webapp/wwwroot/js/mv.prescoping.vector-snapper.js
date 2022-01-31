// viewer must have interface:
// VectorCapturer.prototype.viewerInterface
// +
// event beforepositioncaptured
// evetn beforecursormoved

function VectorSnapper(viewer, capturer, modifier) {
    // validate input, where is right place to do that ???
    var vrv = PUtilities.prototype.checkRequiredFields(viewer, VectorSnapper.prototype.viewerInterface);

    if (vrv.isValid == false) {
        throw vrv.msg;
    }

    if (capturer) {
        var vrc = PUtilities.prototype.checkRequiredFields(capturer, VectorSnapper.prototype.capturerInterface);

        if (vrc.isValid == false) {
            throw vrc.msg;
        }
    }

    if (modifier) {
        var vrm = PUtilities.prototype.checkRequiredFields(modifier, VectorSnapper.prototype.modifierInterface);

        if (vrm.isValid == false) {
            throw vrm.msg;
        }
    }

    const _PI_2 = Math.PI * 2;
    var _positionTolerancy;
    var _directionTolerancy;
    var context = this;

    // INTERFACE
    this.relevantDirForSnapping = [-Math.PI / 2, Math.PI / 2];

    this.absoluteDirForSnapping = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

    this.Start = function (positionTolerancy = 0, directionTolerancy = 0) {
        _positionTolerancy = positionTolerancy;
        _directionTolerancy = directionTolerancy;
        viewer.dispatcherDOM.addEventListener('beforepositioncaptured', onBeforePositionCaptured);
        viewer.dispatcherDOM.addEventListener('beforecursormoved', onBeforeCursorMoved);
    }

    this.Stop = function () {
        reset();
    }

    this.Dispose = function () {
        reset();
    }

    // HELPER
    function onBeforePositionCaptured(e) {
        snappingHandler(e.detail.position);
    }

    function onBeforeCursorMoved(e) {
        snappingHandler(e.detail.position);
    }

    function snappingHandler(vector3) {

        // primitive... we will improve later
        var isSnapped = false;

        if (_positionTolerancy > 0) {

            var editingEntities = modifier ? modifier.getEditingFeatures() : [];

            turf.coordEach(viewer.featureCollection, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {

                // prevent self snapping
                var id = viewer.featureCollection.features[featureIndex].id;
                var sf = editingEntities.filter(value => value.entity.id == id);

                if (sf.length == 0) {
                    if (Math.sqrt(Math.pow(vector3.x - currentCoord[0], 2) + Math.pow(vector3.y - currentCoord[1], 2)) < _positionTolerancy) {
                        vector3.x = currentCoord[0];
                        vector3.y = currentCoord[1];
                        isSnapped = true;
                        return false;
                    }
                }

            }, false);
        }

        if (isSnapped == false && _directionTolerancy > 0 && capturer) {
            var geom = capturer.getScratchGeometry();

            if (geom != null) {

                var sv = PUtilities.prototype.geoJsonToVector3Array(geom);
                var gt = turf.getType(geom);
                var p1 = null;
                var p2 = null;

                if (gt == 'LineString') {
                    p1 = sv[sv.length - 1];
                    p2 = sv[sv.length - 2];
                } else if (gt == 'Polygon') {
                    var l = sv[0].length;
                    p1 = sv[0][l - 2];
                    p2 = sv[0][l - 3];
                }

                if (p1 != null && p2 != null) {
                    // snap to absolute position
                    var vectorToCursor = new THREE.Vector3(vector3.x - p1.x, vector3.y - p1.y, 0);
                    var dirToCursor = PUtilities.prototype.direction(vectorToCursor.x, vectorToCursor.y);

                    for (var dir of context.absoluteDirForSnapping) {
                        var diff = Math.abs(dirToCursor - dir);

                        if (diff < _directionTolerancy) {
                            var snappingVector = PUtilities.prototype.dirToVector3(dir);
                            vectorToCursor.projectOnVector(snappingVector);
                            vector3.x = p1.x + vectorToCursor.x;
                            vector3.y = p1.y + vectorToCursor.y;
                            isSnapped = true;
                        }
                    }

                    // snap to relative position
                    if (isSnapped == false) {

                        var vectorLastSegment = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, 0);
                        var dirLastSegment = PUtilities.prototype.direction(vectorLastSegment.x, vectorLastSegment.y);

                        for (var dir of context.relevantDirForSnapping) {
                            var tmpdir = dirLastSegment + dir;

                            if (tmpdir > _PI_2) {
                                tmpdir -= _PI_2;
                            }

                            if (tmpdir < 0) {
                                tmpdir += _PI_2;
                            }
                             
                            var diff = Math.abs(dirToCursor - tmpdir);

                            if (diff < _directionTolerancy) {
                                var snappingVector = PUtilities.prototype.dirToVector3(tmpdir);
                                vectorToCursor.projectOnVector(snappingVector);
                                vector3.x = p1.x + vectorToCursor.x;
                                vector3.y = p1.y + vectorToCursor.y;
                                console.log('snap to rel dir: ' + dir);
                                isSnapped = true;
                            }
                        }
                    }

                }

            }
        }

    }

    function reset() {
        viewer.dispatcherDOM.removeEventListener('beforepositioncaptured', onBeforePositionCaptured);
        viewer.dispatcherDOM.removeEventListener('beforecursormoved', onBeforeCursorMoved);
    }

}

VectorSnapper.prototype.viewerInterface = ['featureCollection'];
VectorSnapper.prototype.capturerInterface = ['getScratchGeometry'];
VectorSnapper.prototype.modifierInterface = ['getEditingFeatures'];