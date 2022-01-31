// viewer must have interface:
// FloorPlanSync.prototype.viewerInterface
// +
// event entitiespicked
// event unselectall
// event cursormoved
// enent positionleftdown
// enent positionleftup


function Layout3dProcessor(viewer) {

    // validate input, where is right place to do that ???
    var vr = PUtilities.prototype.checkRequiredFields(viewer, Layout3dProcessor.prototype.viewerInterface);

    if (vr.isValid == false) {
        throw vr.msg;
    }

    var _context = this;
    var _geoJson = null;
    var _editable = false;
    var _editing = null;
    var _selected = null;
    var _positionTolerancy = 10;
    var _imageWidth = 0;
    var _imageHeight = 0;
    var _isIgnoreNextUnselectAll = false;
    var _floorH = 1.5;
    var _ceilingH = 1.5;
    var _rawToAlignedR = new THREE.Matrix3();
    var _alignedToRawR = new THREE.Matrix3();

    // INTERFACE
    this.dispatcherDOM = document.createElement("div");

    this.Start = function (geoJson, floorH = 1.5, ceilingH = 1.5,  editable = false, positionTolerance = 10) {

        reset();

        if (viewer.currentMetadata == null) {
            throw 'Before layout3d visualization you must to visualize photo!';
        } else {
            var size = viewer.getImageSize();
            _imageWidth = size.imageWidth;
            _imageHeight = size.imageHeight;
        }

        if (geoJson.dx != null && geoJson.dy != null && geoJson.rz != null) {
            viewer.ceilingH = ceilingH;
            viewer.floorH = floorH;
        }

        _editable = editable;
        _positionTolerancy = positionTolerance;
        _floorH = floorH;
        _ceilingH = ceilingH;

        _geoJson = JSON.parse(JSON.stringify(geoJson));
        _geoJson.geometry = (layoutToGeoJson(_geoJson)).geometry;

        _rawToAlignedR = PSULIB.PANO.buildRotationMatrix(null);
        _alignedToRawR = PSULIB.PANO.buildRotationMatrix(null);

        if (_geoJson.vp) {
            try {
                var rk = JSON.parse(_geoJson.vp);
                if (Array.isArray(rk)) {

                    _rawToAlignedR = PSULIB.PANO.buildRotationMatrix([
                        parseFloat(rk[2][0]), parseFloat(rk[2][1]), parseFloat(rk[2][2]),
                        parseFloat(rk[1][0]), parseFloat(rk[1][1]), parseFloat(rk[1][2]),
                        parseFloat(rk[0][0]), parseFloat(rk[0][1]), parseFloat(rk[0][2])
                    ]);

                    _alignedToRawR = _rawToAlignedR.clone();
                    _alignedToRawR.invert();
                }
            } catch {

            }
        }

        viewer.dispatcherDOM.addEventListener('layoutpicked', onLayoutPicked);
        viewer.dispatcherDOM.addEventListener('unselectall', onUnselectAll);
        viewer.dispatcherDOM.addEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.addEventListener('positionleftdown', onPositionLeftDown);
        viewer.dispatcherDOM.addEventListener('positionleftup', onPositionLeftUp);

        viewer.addLayout(getCloneInRawCoords(_geoJson), viewer.styleDefault);
    }

    this.Stop = function () {
        reset();
    }

    this.Dispose = function () {
        reset();
        delete this.dispatcherDOM;
    }

    this.getCurrentLayout = function () {
        if (_geoJson == null) {
            return null;
        } else {
            return {
                photo: $.extend(true, {}, _geoJson),
                uv: geoJsonToLayout(_geoJson),
                floorH: _floorH,
                ceilingH: _ceilingH
            }
        }
    }

    // EVENT
    function dispatchLayout3dChanged(entity, floorH, ceilingH) {

        var uv = geoJsonToLayout(entity);

        if (uv) {
            var event = new CustomEvent('layout3dchanged', {
                detail: {
                    photo: $.extend(true, {}, entity),
                    uv: uv,
                    floorH: floorH,
                    ceilingH: ceilingH
                }
            });

            _context.dispatcherDOM.dispatchEvent(event);
        }

    }

    function dispatchLayout3dSelected(entity, floorH, ceilingH) {

        var uv = geoJsonToLayout(entity);

        if (uv) {
            var event = new CustomEvent('layout3dselected', {
                detail: {
                    photo: $.extend(true, {}, entity),
                    uv: uv,
                    floorH: floorH,
                    ceilingH: ceilingH
                }
            });

            _context.dispatcherDOM.dispatchEvent(event);
        }
    }

    function dispatchLayout3dUnselected() {
        var event = new CustomEvent('layout3dunselected', {
            detail: {
            }
        });

        _context.dispatcherDOM.dispatchEvent(event);
    }

    // HELPER
    function onLayoutPicked(e) {

        if (_editable ) { 

            if (_selected == null) { // prevent selection of the selected layout
                // _selected = e.detail.layouts[0];
                _selected = _geoJson;

                viewer.updateLayout(getCloneInRawCoords(_selected), viewer.styleLayoutForEditing);
                dispatchLayout3dSelected(_selected, _floorH, _ceilingH);
            }

        } else {
            viewer.showInfoMsg('Layout editing is disabled');
        }

    }

    function onUnselectAll(e) {

        // ignore unselect all if ware operations add/remove vertices 
        if (_isIgnoreNextUnselectAll == true) {
            _isIgnoreNextUnselectAll = false;
            return;
        }

        if (_selected != null) {
            viewer.updateLayout(getCloneInRawCoords(_selected), viewer.styleDefault);
            _selected = null;
            dispatchLayout3dUnselected();
        }

        viewer.showInfoMsg('');

    }

    function onCursorMoved(e) {

        if (_editable && _editing != null) {
            _isIgnoreNextUnselectAll = false;
            //updateLayoutVertex(_editing.entity, _editing.index, _editing.multiFeatureIndex, e.detail.position.x, e.detail.position.y, e.detail.shiftKey);
            var [ax, ay] = PSULIB.PANO.rotatePanoramicPixel(e.detail.position.x, -e.detail.position.y, _imageWidth, _imageHeight, _rawToAlignedR);
            updateLayoutVertex(_editing.entity, _editing.index, _editing.multiFeatureIndex, ax, -ay, e.detail.shiftKey);
            _geoJson.geometry = _editing.entity.geometry;
            viewer.updateLayout(getCloneInRawCoords(_geoJson), viewer.styleLayoutForEditing);
            _editing.isChanged = true;
        }

    }

    function onPositionLeftDown(e) {

        if (_editable && _selected != null) {

            var [ax, ay] = PSULIB.PANO.rotatePanoramicPixel(e.detail.position.x, -e.detail.position.y, _imageWidth, _imageHeight, _rawToAlignedR);

            if (e.detail.ctrlKey && _selected != null) {
                // add extra vertex
                _isIgnoreNextUnselectAll = true;

                var uv_layout = geoJsonToLayout(_selected);
                var xyz_footprint = JSON.parse(JSON.stringify(uv_layout));

                if (xyz_footprint) {

                    turf.coordEach(xyz_footprint, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                        //var xyz = PUtilities.prototype.uvToXyz(currentCoord[0], currentCoord[1], _floorH);
                        var xyz = PSULIB.PANO.uvToXyz(currentCoord[0], currentCoord[1], _floorH);
                        currentCoord[0] = xyz.x;
                        currentCoord[1] = xyz.y;
                        currentCoord[2] = xyz.z;
                    }, false);

                    // var xyz_cursore = PUtilities.prototype.uvToXyz(e.detail.position.x / _imageWidth, -e.detail.position.y / _imageHeight, _floorH);
                    // var xyz_cursore = PUtilities.prototype.uvToXyz(ax / _imageWidth, ay / _imageHeight, _floorH);
                    var xyz_cursore = PSULIB.PANO.uvToXyz(ax / _imageWidth, ay / _imageHeight, _floorH);
                    var p = PUtilities.prototype.getProjectionOnEntity(xyz_footprint, xyz_cursore);

                    if (p) {
                        var uv_floor = PSULIB.PANO.xyxToUv(p.geometry.coordinates[0], p.geometry.coordinates[1], _floorH);
                        var uv_ceiling = PSULIB.PANO.xyxToUv(p.geometry.coordinates[0], p.geometry.coordinates[1], _ceilingH);

                        PUtilities.prototype.addVertex(
                            uv_layout,
                            p.properties.index,
                            new THREE.Vector3(uv_floor[0], uv_floor[1], uv_floor[1] - uv_ceiling[1])
                        );

                        _selected.geometry = (layoutToGeoJson(uv_layout)).geometry;
                        _geoJson.geometry = _selected.geometry;
                        viewer.updateLayout(getCloneInRawCoords(_geoJson), viewer.styleLayoutForEditing);
                        dispatchLayout3dChanged(_selected, _floorH, _ceilingH);
                    }
                }

            } else if (e.detail.altKey && _selected != null) {
                // remove vertex
                _isIgnoreNextUnselectAll = true;

                var uv_layout = geoJsonToLayout(_selected);
                var xyz_footprint = JSON.parse(JSON.stringify(uv_layout));

                if (xyz_footprint) {
                    turf.coordEach(xyz_footprint, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                        var xyz = PUtilities.prototype.uvToXyz(currentCoord[0], currentCoord[1], _floorH);
                        var xyz = PSULIB.PANO.uvToXyz(currentCoord[0], currentCoord[1], _floorH);
                        currentCoord[0] = xyz.x;
                        currentCoord[1] = xyz.y;
                        currentCoord[2] = xyz.z;
                    }, false);

                    // var xyz_cursore = PUtilities.prototype.uvToXyz(e.detail.position.x / _imageWidth, -e.detail.position.y / _imageHeight, _floorH);
                    var xyz_cursore = PUtilities.prototype.uvToXyz(ax / _imageWidth, ay / _imageHeight, _floorH);
                    var xyz_cursore = PSULIB.PANO.uvToXyz(ax / _imageWidth, ay / _imageHeight, _floorH);

                    var result = PUtilities.prototype.getClosestVertex(xyz_footprint, xyz_cursore.x, xyz_cursore.y);

                    if (result.i != -1) {
                        var result = PUtilities.prototype.removeVertex(uv_layout, result.i);

                        if (result.isValid) {
                            _selected.geometry = (layoutToGeoJson(uv_layout)).geometry;
                            _geoJson.geometry = _selected.geometry;
                            viewer.updateLayout(getCloneInRawCoords(_geoJson), viewer.styleLayoutForEditing);
                            dispatchLayout3dChanged(_selected, _floorH, _ceilingH);
                        }
                    }
                }

            } else {
                // start vertix editing
                _editing = null;

                // var result = PUtilities.prototype.getClosestVertex(_selected, e.detail.position.x, e.detail.position.y);
                var result = PUtilities.prototype.getClosestVertex(_selected, ax, -ay);

                if (result.i != -1 && result.d < _positionTolerancy) {
                    _editing = { index: result.i, multiFeatureIndex: result.mfi, entity: _selected, isChanged: false };
                    viewer.isPanningFrozen = true;
                }

            }
        }

    }

    function onPositionLeftUp(e) {

        viewer.isPanningFrozen = false;

        if (_editable && _editing != null) {

            if (_editing.isChanged) {
                dispatchLayout3dChanged(_editing.entity, _floorH, _ceilingH);
            }

            _editing = null;
        }
    }

    function reset() {

        if (_geoJson) {
            viewer.removeLayout(getCloneInRawCoords(_geoJson));
            _geoJson = null;
        }

        _deltaH = 0;
        _isUpdateLayoutBusy = false;

        viewer.dispatcherDOM.removeEventListener('layoutpicked', onLayoutPicked);
        viewer.dispatcherDOM.removeEventListener('unselectall', onUnselectAll);
        viewer.dispatcherDOM.removeEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.removeEventListener('positionleftdown', onPositionLeftDown);
        viewer.dispatcherDOM.removeEventListener('positionleftup', onPositionLeftUp);

    }

    function geoJsonToLayout(feature) {

        var coords = [];

        turf.flattenEach(feature, function (currentFeature, featureIndex, multiFeatureIndex) {
            coords.push([
                currentFeature.geometry.coordinates[0][1][0] / _imageWidth,
                - currentFeature.geometry.coordinates[0][1][1] / _imageHeight,
                - (currentFeature.geometry.coordinates[0][1][1] - currentFeature.geometry.coordinates[0][2][1]) / _imageHeight
            ]);
        });

        if (coords.length > 0) {
            coords.unshift([coords[coords.length - 1][0], coords[coords.length - 1][1], coords[coords.length - 1][2]]); // close polygon
            return turf.polygon([coords]);
        } else {
            return null;
        }

    }

    function layoutToGeoJson(layout) {

        var multiPolygonCoordinates = []; // [[[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]]

        turf.segmentEach(layout, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
            var lc = currentSegment.geometry.coordinates;
            var coords = [];
            coords.push([lc[0][0] * _imageWidth, lc[0][1] * (-_imageHeight), 1]);
            coords.push([lc[1][0] * _imageWidth, lc[1][1] * (-_imageHeight), 1]);
            coords.push([lc[1][0] * _imageWidth, (lc[1][1] - lc[1][2]) * (-_imageHeight), 1]);
            coords.push([lc[0][0] * _imageWidth, (lc[0][1] - lc[0][2]) * (-_imageHeight), 1]);
            coords.push([lc[0][0] * _imageWidth, lc[0][1] * (-_imageHeight), 1]); // close polygon
            multiPolygonCoordinates.push([coords]);
        });

        return turf.multiPolygon(multiPolygonCoordinates);
    }

    function updateLayoutVertex(feature, index, multiFeatureIndex, x, y, isHeightChanging = false) {

        const STEP_H = 0.1;

        var old_x = feature.geometry.coordinates[multiFeatureIndex][0][index][0];
        var old_y = feature.geometry.coordinates[multiFeatureIndex][0][index][1];

        if (isHeightChanging == true) {
            // modify distance to floor or ceiling plane
            if (index == 2 || index == 3) {
                // change dist to ceiling
                // var xyz_ceiling = PUtilities.prototype.uvToXyz(old_x / _imageWidth, -old_y / _imageHeight, _ceilingH);
                var xyz_ceiling = PSULIB.PANO.uvToXyz(old_x / _imageWidth, -old_y / _imageHeight, _ceilingH);
                // var uv_ceiling = PUtilities.prototype.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _ceilingH + STEP_H);
                var uv_ceiling = PSULIB.PANO.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _ceilingH + STEP_H);
                var delta_z = (uv_ceiling[1] * (-_imageHeight) - old_y); // calculate how DELTA_H along Z affects to the v

                // update H
                var delta_h = STEP_H * (delta_z * (y - old_y));

                // apply modification if ceiling is above the floor after update
                if (_ceilingH + delta_h > _floorH) {
                    // update all points on the ceiling
                    turf.flattenEach(feature, function (currentFeature, featureIndex, multiFeatureIndex) {
                        for (var i of [2, 3]) {
                            // var xyz_tmp = PUtilities.prototype.uvToXyz(currentFeature.geometry.coordinates[0][i][0] / _imageWidth, - currentFeature.geometry.coordinates[0][i][1] / _imageHeight, _ceilingH);
                            var xyz_tmp = PSULIB.PANO.uvToXyz(currentFeature.geometry.coordinates[0][i][0] / _imageWidth, - currentFeature.geometry.coordinates[0][i][1] / _imageHeight, _ceilingH);
                            // var uv_tmp = PUtilities.prototype.xyxToUv(xyz_tmp.x, xyz_tmp.y, _ceilingH + delta_h);
                            var uv_tmp = PSULIB.PANO.xyxToUv(xyz_tmp.x, xyz_tmp.y, _ceilingH + delta_h);
                            currentFeature.geometry.coordinates[0][i][1] = -uv_tmp[1] * _imageHeight;
                        }
                    });

                    _ceilingH += delta_h;
                }

            } else {
                // change dist to floor
                // var xyz_ceiling = PUtilities.prototype.uvToXyz(old_x / _imageWidth, -old_y / _imageHeight, _floorH);
                var xyz_ceiling = PSULIB.PANO.uvToXyz(old_x / _imageWidth, -old_y / _imageHeight, _floorH);
                // var uv_ceiling = PUtilities.prototype.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _floorH + STEP_H);
                var uv_ceiling = PSULIB.PANO.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _floorH + STEP_H);
                var delta_z = (uv_ceiling[1] * (-_imageHeight) - old_y); // calculate how DELTA_H along Z affects to the v

                // update H
                var delta_h = STEP_H * (delta_z * (y - old_y));

                // apply modification if floor is under the ceiling after update
                if (_floorH + delta_h < _ceilingH) {
                    // update all points on the ceiling
                    turf.flattenEach(feature, function (currentFeature, featureIndex, multiFeatureIndex) {
                        for (var i of [0, 1, 4]) {
                            // var xyz_tmp = PUtilities.prototype.uvToXyz(currentFeature.geometry.coordinates[0][i][0] / _imageWidth, - currentFeature.geometry.coordinates[0][i][1] / _imageHeight, _floorH);
                            var xyz_tmp = PSULIB.PANO.uvToXyz(currentFeature.geometry.coordinates[0][i][0] / _imageWidth, - currentFeature.geometry.coordinates[0][i][1] / _imageHeight, _floorH);
                            // var uv_tmp = PUtilities.prototype.xyxToUv(xyz_tmp.x, xyz_tmp.y, _floorH + delta_h);
                            var uv_tmp = PSULIB.PANO.xyxToUv(xyz_tmp.x, xyz_tmp.y, _floorH + delta_h);
                            currentFeature.geometry.coordinates[0][i][1] = -uv_tmp[1] * _imageHeight;
                        }
                    });

                    _floorH += delta_h;
                }

            }

        } else {
            // modify layout by floor or ceiling plane
            feature.geometry.coordinates[multiFeatureIndex][0][index][0] = x;
            feature.geometry.coordinates[multiFeatureIndex][0][index][1] = y;

            // move points with same position
            turf.coordEach(feature, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                if (currentCoord[0] == old_x && currentCoord[1] == old_y) {
                    currentCoord[0] = x;
                    currentCoord[1] = y;
                }
            }, false);

            // handle movement of corresponded points (floor-ceiling)
            var old_cor_x, old_cor_y, new_cor_y;

            if (index == 2 || index == 3) {
                // move floor points accordingly
                // var xyz_ceiling = PUtilities.prototype.uvToXyz(x / _imageWidth, -y / _imageHeight, _ceilingH);
                var xyz_ceiling = PSULIB.PANO.uvToXyz(x / _imageWidth, -y / _imageHeight, _ceilingH);
                //var uv_floor = PUtilities.prototype.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _floorH);
                var uv_floor = PSULIB.PANO.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _floorH);
                new_cor_y = - uv_floor[1] * _imageHeight;

                cor_index = index == 2 ? 1 : 0;
                old_cor_x = feature.geometry.coordinates[multiFeatureIndex][0][cor_index][0];
                old_cor_y = feature.geometry.coordinates[multiFeatureIndex][0][cor_index][1];
                feature.geometry.coordinates[multiFeatureIndex][0][cor_index][0] = x;
                feature.geometry.coordinates[multiFeatureIndex][0][cor_index][1] = new_cor_y;
            } else {
                // move ceiling points accordingly
                // var xyz_ceiling = PUtilities.prototype.uvToXyz(x / _imageWidth, -y / _imageHeight, _floorH);
                var xyz_ceiling = PSULIB.PANO.uvToXyz(x / _imageWidth, -y / _imageHeight, _floorH);
                // var uv_floor = PUtilities.prototype.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _ceilingH);
                var uv_floor = PSULIB.PANO.xyxToUv(xyz_ceiling.x, xyz_ceiling.y, _ceilingH);
                new_cor_y = - uv_floor[1] * _imageHeight;

                cor_index = index == 1 ? 2 : 3;
                old_cor_x = feature.geometry.coordinates[multiFeatureIndex][0][cor_index][0];
                old_cor_y = feature.geometry.coordinates[multiFeatureIndex][0][cor_index][1];
                feature.geometry.coordinates[multiFeatureIndex][0][cor_index][0] = x;
                feature.geometry.coordinates[multiFeatureIndex][0][cor_index][1] = new_cor_y;
            }

            turf.coordEach(feature, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                if (currentCoord[0] == old_cor_x && currentCoord[1] == old_cor_y) {
                    currentCoord[0] = x;
                    currentCoord[1] = new_cor_y;
                }
            }, false);
        }

    }

    function getCloneInRawCoords(feature) {

        var clone = JSON.parse(JSON.stringify(feature));

        turf.coordEach(clone, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
            var [x, y] = PSULIB.PANO.rotatePanoramicPixel(currentCoord[0], -currentCoord[1], _imageWidth, _imageHeight, _alignedToRawR);
            currentCoord[0] = x;
            currentCoord[1] = -y;
        }, false);

        return clone;
    }
}

Layout3dProcessor.prototype.viewerInterface = ['dispatcherDOM', 'currentMetadata', 'getImageSize', 'styleLayoutForEditing', 'styleLayoutDefault', 'isPanningFrozen', 'addLayout', 'removeLayout', 'updateLayout', 'showInfoMsg'];

Layout3dProcessor.prototype.layoutToFootpring = function (feature, h, rz = 0) {

    var footprint = JSON.parse(JSON.stringify(feature));

    if (footprint) {

        turf.coordEach(footprint, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
            // var xyz = PUtilities.prototype.uvToXyz(currentCoord[0], currentCoord[1], h, rz);
            var xyz = PSULIB.PANO.uvToXyz(currentCoord[0], currentCoord[1], h, rz);
            currentCoord[0] = xyz.x;
            currentCoord[1] = xyz.y;
            currentCoord[2] = xyz.z;
        }, false);

        return footprint;

    } else {
        return null;
    }
}