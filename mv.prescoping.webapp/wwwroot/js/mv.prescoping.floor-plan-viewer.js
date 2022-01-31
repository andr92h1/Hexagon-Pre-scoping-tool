function FloorPlanViewer(containerJquery) {

    const DEFAULT_SCRATCH_COLOR = 'red';
    const DEFAULT_ENTITY_COLOR = 'green';
    const DEFAULT_ENTITY_WIDTH = 0.25;
    const DEFAULT_ENTITY_NODE_RADIUS = 0.25;
    const DEFAULT_ENTITY_FILL_OPACITY = 0.5;
    const PHOTO_POSITION_LABEL_SIZE = 15;
    const PHOTO_POSITION_Z_OFFSET = 2;

    const PROXY_DATA_URL = FloorPlanViewer.prototype.PATH_PREFIX + '/Proxy/Data/';
    const FONT_3D_PATH = FloorPlanViewer.prototype.PATH_PREFIX + '/font/gentilis_regular.typeface.json';
    const PHOTO_ICON_PATH = FloorPlanViewer.prototype.PATH_PREFIX + '/icon/n_orange_360.gif';

    var UPDATE_REQUIRED = true;
    var TARGET_FPS = 60;

    var _infoBoxJquery = null;
    var _tmpQuaternion = new THREE.Quaternion();
    var _tmpRaycaster = new THREE.Raycaster();
    var _tmpVector2 = new THREE.Vector2();

    var camera, scene, renderer;
    var isUserInteracting, onPointerDownPointerX, onPointerDownPointerY, pointerLastPositionX, pointerLastPositionY, rasterCursorePositionX, rasterCursorePositionY;
    var lastClientX, lastClientY;
    var requestAnimationFrameId = null;
    var prevRenderingTime = new Date();
    var imageHeight = -1;
    var imageWidth = -1;
    var transformationMatrix = new THREE.Matrix4();
    var font3d = null;
    var fontSize = 20;
    var selectedObject = null;
    var tileLoadedTimestamp = null;

    var capturingShapeType = null;
    var capturingShapeVertices = [];
    var capturingMesh = null;
    var scratchMesh = null;

    this.featureCollection = turf.featureCollection([]);
    this.dispatcherDOM = containerJquery[0];
    this.guid = null;

    var viewerContext = this;

    // GENERAL

    function init() {
        camera = new THREE.OrthographicCamera(containerJquery.width() / -2, containerJquery.width() / 2, containerJquery.height() / 2, containerJquery.height() / -2, -100, +100);
        camera.position.z = 50;
        camera.zoom = 0.5;
        camera.updateProjectionMatrix();

        scene = new THREE.Scene();
        viewerContext.guid = scene.uuid;

        renderer = new THREE.WebGLRenderer();
        renderer.autoClear = true;
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(containerJquery.width(), containerJquery.height());
        containerJquery.append(renderer.domElement);

        renderer.domElement.oncontextmenu = function (e) {
            e.preventDefault();
            return false;
        };

        $("#loading-animation").on('contextmenu', function (e) {
            e.preventDefault();
            return false;
        });


        containerJquery.on('mouseenter', this, onContainerMouseenter);
        containerJquery.on('mouseleave', this, onContainerMouseleave);
        containerJquery.on('keydown', this, onContainerKeyDown);
        containerJquery.on('mousedown', this, onContainerMouseDonw);
        containerJquery.on('mousemove', this, onContainerMouseMove);
        containerJquery.on('mouseup', this, onContainerMouseUp);
        containerJquery.on('mousewheel', onContainerMouseWheel);
        containerJquery.resize(onContainerResize);

        var fontLoader = new THREE.FontLoader();
        fontLoader.load(FONT_3D_PATH, function (response) {
            font3d = response;
        });

        // add info msg element
        _infoBoxJquery = $('<div class="viewer-info-box"></div>');
        containerJquery.append(_infoBoxJquery);

        this.UPDATE_REQUIRED = true;
    }

    function render() {

        // check time
        var curDate = new Date();
        var diff = curDate - prevRenderingTime;

        if (diff < 1000 / TARGET_FPS) {
            requestAnimationFrameId = requestAnimationFrame(render);
            return;
        } else {
            prevRenderingTime = curDate;
        }

        // check if rendering required
        if (UPDATE_REQUIRED == false) {
            requestAnimationFrameId = requestAnimationFrame(render);
            return;
        }

        requestAnimationFrameId = requestAnimationFrame(render);
        renderer.render(scene, camera);
        UPDATE_REQUIRED = false;
    }

    // INTERFACE

    this.currentMetadata = null;

    this.isPanningFrozen = false;

    this.styleForEditing = {
        color: "magenta",
        width: 0.25,
        node: {
            radius: 0.25
        }
    }

    this.styleDefault = {
        color: "green",
        width: 0.25
    }

    this.setCursorType = function (cssCursorType) {
        // 'crosshair', 'default'
        containerJquery.css('cursor', cssCursorType);
    }

    this.showFloorPlan = function (metadata, tk, forceCentration = true) {
        // clean up
        this.cleanupAll();

        // update transform
        transformationMatrix = new THREE.Matrix4();

        if (tk) {
            updateTransformationMatrix(tk)
        }

        // validate metadata
        var vr = PUtilities.prototype.checkRequiredFields(metadata, FloorPlanViewer.prototype.floorPlanInterface);

        if (vr.isValid === false) {
            alert('An error occurred while floor plan rendering. ' + vr.msg);
            return;
        }

        // update metadata
        viewerContext.currentMetadata = metadata;

        var loader = new THREE.TextureLoader();
        loader.crossOrigin = '';

        var texturePath = metadata.FloorplanImageURL;

        // use proxy if needed
        if (window.location.host.indexOf('localhost') != -1) {
            texturePath = PROXY_DATA_URL + '?url=' + metadata.FloorplanImageURL;
        }

        loader.load(texturePath,
            function (texture) {
                // update metadata
                imageWidth = texture.image.width;
                imageHeight = texture.image.height;

                // put background on the screen
                var geometry = new THREE.PlaneGeometry(imageWidth, imageHeight);
                geometry.translate(imageWidth / 2, - imageHeight / 2, -1);
                var material = new THREE.MeshBasicMaterial({ map: texture });
                var mesh = new THREE.Mesh(geometry, material);
                mesh.userData = metadata;
                mesh.userData.isTransformationApplicable = true;
                setTransformationFromMatrix(mesh, transformationMatrix);

                scene.add(mesh);

                if (forceCentration) {
                    // move camera to the center of the geometry
                    mesh.geometry.computeBoundingSphere();
                    var c = mesh.geometry.boundingSphere.center.clone();
                    var cw = mesh.localToWorld(c);
                    camera.position.x = cw.x;
                    camera.position.y = cw.y;
                }

                dispatchTextureLoadedEvent();

                UPDATE_REQUIRED = true;
            }
        );

    }

    this.addPhotos = function (photos) {

        $.each(photos, function (key, metadata) {

            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(metadata, PhotoViewer.prototype.photoInterface);

            if (vr.isValid === false) {
                alert('An error occurred while rendering of the photo position. ' + vr.msg);
                return false;
            }

            // build object 3D
            var mesh = photoMetadataTo3DObject(metadata);
            mesh.userData.isTransformationApplicable = true;
            setTransformationFromMatrix(mesh, transformationMatrix);
            mesh.visible = getPhotoPositionVisibility(metadata);
            scene.add(mesh);
        });

        UPDATE_REQUIRED = true;
    }

    this.setPhotosSelection = function (photos, isSelected) {

        var scale = isSelected ? 2 : 1;

        for (var item of photos) {

            var obj = getPhoto3dObject(item);

            if (obj) {

                for (var c of obj.children) {
                    c.scale.x = scale;
                    c.scale.y = scale;
                    c.scale.z = scale;
                }
            }
        }

        UPDATE_REQUIRED = true;
    }

    this.removeAllPhotos = function () {

        for (var i = 0; i < scene.children.length; i++) {

            var obj = scene.children[i];

            var pvr = PUtilities.prototype.checkRequiredFields(obj.userData, PhotoViewer.prototype.photoInterface);

            if (pvr.isValid === true) {
                doDisposeMesh(obj);
                scene.remove(obj);
                i--;
            }
        }

        UPDATE_REQUIRED = true;
    }

    this.addEntities = function (entities, style) {

        $.each(entities, function (key, metadata) {

            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(metadata, FloorPlanViewer.prototype.entityInterface);

            if (vr.isValid === false) {
                alert('An error occurred while rendering of the entity. ' + vr.msg);
                return false;
            }

            if (metadata.geometry == null) {
                return;
            }

            // build object 3D
            var obj = viewerContext.addFeature(metadata, 'id', style);
            obj.visible = getEntityVisibility(metadata);

            // add feature into collection
            viewerContext.featureCollection.features.push(metadata);

        });

        UPDATE_REQUIRED = true;

    }

    this.dispose = function () {

        containerJquery.off('mousedown');
        containerJquery.off('mousemove');
        containerJquery.off('mouseup');
        containerJquery.off('mousewheel');
        containerJquery.off('resize');

        // remove info box elem
        if (_infoBoxJquery) {
            _infoBoxJquery.remove();
        }

        // cleanup sceen
        this.cleanupAll();

        // dispose three
        renderer.dispose();
        $(renderer.domElement).remove();
    }

    this.removeEntities = function (entities) {

        for (var item of entities) {
            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(item, FloorPlanViewer.prototype.entityInterface);

            if (vr.isValid === false) {
                alert('An error occurred while removing an entity. ' + vr.msg);
                return false;
            }

            // remove from the scene
            viewerContext.removeFeature(item, 'id');

            // remove from feature collection
            for (var i = 0; i < this.featureCollection.features.length; i++) {
                if (item.id == this.featureCollection.features[i].id) {
                    this.featureCollection.features.splice(i, 1);
                    break;
                }
            }
        }

        UPDATE_REQUIRED = true;
    }

    this.updateEntities = function (entities, style = {}) {

        for (var item of entities) {
            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(item, FloorPlanViewer.prototype.entityInterface);

            if (vr.isValid === false) {
                alert('An error occurred while rendering of the entity. ' + vr.msg);
                return false;
            }

            if (item.geometry == null) {
                alert('Geometry has NULL value!');
                return false;
            }

            viewerContext.updateFeature(item, 'id', style);

            // update feature in feature collection
            for (var i = 0; i < this.featureCollection.features.length; i++) {
                if (item.id == this.featureCollection.features[i].id) {
                    this.featureCollection.features[i] = item;
                    break;
                }
            }
        }

        UPDATE_REQUIRED = true;
    }

    this.cleanupAll = function () {

        for (var i = 0; i < scene.children.length; i++) {
            var obj = scene.children[i];
            doDisposeMesh(obj);
            scene.remove(obj);
            i--;
        }

        this.featureCollection = turf.featureCollection([]);

    }

    this.showInfoMsg = function (msg) {
        _infoBoxJquery.text(msg);
    }

    this.setTransformationMatrix = function (tk) {

        updateTransformationMatrix(tk);

        for (var obj of scene.children) {
            if (obj.userData.isTransformationApplicable) {
                setTransformationFromMatrix(obj, transformationMatrix);
            }
        }

        UPDATE_REQUIRED = true;
    }

    this.getTransformationMatrix = function () {
        return transformationMatrix;
    }

    this.moveToPosition = function (vector3) {
        camera.position.copy(vector3);
        UPDATE_REQUIRED = true;
    }

    this.drawScratchGeometry = function (geoJson, style = {}) {

        if (geoJson) {

            if (!style.color) {
                style.color = DEFAULT_SCRATCH_COLOR;
            }

            var geomType = turf.getType(geoJson);
            var vertices = PUtilities.prototype.geoJsonToVector3Array(geoJson);

            if (geomType == 'LineString' || geomType == 'Polygon') {

                var geom = new THREE.BufferGeometry().setFromPoints(vertices);
                geom.computeBoundingSphere();

                if (scratchMesh == null) {
                    scratchMesh = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: style.color }));
                    scene.add(scratchMesh);
                } else {
                    scratchMesh.geometry = geom;
                }

            } else {
                throw 'Floorplan viewer [' + this.guid + '] unsupported geometry type: ' + geomType;
            }

        } else {

            if (scratchMesh) {
                doDisposeMesh(scratchMesh);
                scene.remove(scratchMesh);
                scratchMesh = null;
            }
        }

        UPDATE_REQUIRED = true;
    }

    this.addFeature = function (feature, idColumnName = 'id', style = {}) {

        // turfable obj
        if (typeof feature.type == 'undefined') {
            feature.type = 'Feature'; 
        }

        var mesh = PUtilities.prototype.featureTo3DObject(feature, style);
        scene.add(mesh);
        UPDATE_REQUIRED = true;
        return mesh;
    }

    this.updateFeature = function (feature, idColumnName = 'id', style = {}) {

        // turfable obj
        if (typeof feature.type == 'undefined') {
            feature.type = 'Feature';
        }

        var obj = getFeature3DObject(feature, idColumnName);

        if (obj == null) {
            return null;
        }

        var tmpGrp = PUtilities.prototype.featureTo3DObject(feature, style);

        if (tmpGrp == null) {
            return null;
        }

        for (var i = 0; i < obj.children.length; i++) {
            var tmp = obj.children[i];
            doDisposeMesh(tmp);
            obj.remove(tmp);
            i--;
        }

        while (tmpGrp.children.length) {
            obj.add(tmpGrp.children[0]);
        }

        obj.userData = feature;
        tmpGrp = null;
        UPDATE_REQUIRED = true;
        return obj;
    }

    this.removeFeature = function (feature, idColumnName = 'id') {

        // remove feature
        var obj = getFeature3DObject(feature, idColumnName);

        if (obj) {
            doDisposeMesh(obj);
            scene.remove(obj);
        }

        UPDATE_REQUIRED = true;
    }

    // EVENT HANDLERS

    function onContainerMouseenter(event) {
        containerJquery.focus();
    }

    function onContainerMouseleave(event) {
        containerJquery.blur();
        isUserInteracting = false;
    }

    function onContainerKeyDown(event) {
        switch (event.keyCode) {
            case 27: //escape
                dispatchActionCanceledEvent();
                break;
            default:
                // do something...
                break;
        }
    }

    function onContainerResize() {
        refreshCameraSettings();
    }

    function onContainerMouseWheel(event) {

        event.preventDefault();

        var offsetX = event.offsetX != undefined ? event.offsetX : event.originalEvent.changedTouches[0].clientX - event.currentTarget.offsetTop;
        var offsetY = event.offsetY != undefined ? event.offsetY : event.originalEvent.changedTouches[0].clientY - event.currentTarget.offsetLeft;

        var delta = event.originalEvent.deltaY || event.originalEvent.detail || event.originalEvent.wheelDelta;
        processZoom(delta, offsetX, offsetY);

        dispatchCameraStateChangedEvent();

        UPDATE_REQUIRED = true;

    }

    function onContainerMouseUp(event) {

        event.preventDefault();

        var offsetY = event.offsetY != undefined ? event.offsetY : event.originalEvent.changedTouches[0].clientY - ($(window).height() - event.currentTarget.offsetHeight);
        var offsetX = event.offsetX != undefined ? event.offsetX : event.originalEvent.changedTouches[0].clientX - ($(window).width() - event.currentTarget.offsetWidth);
        rasterCursorePositionX = camera.position.x + (offsetX - containerJquery.width() / 2) / camera.zoom;
        rasterCursorePositionY = camera.position.y + (containerJquery.height() / 2 - offsetY) / camera.zoom;

        if (event.button == 0) {
            isUserInteracting = false;

            dispatchPositionLeftUp(new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0));

            if (Math.abs(event.clientX - onPointerDownPointerX) < 10 && Math.abs(event.clientY - onPointerDownPointerY) < 10) {
                dispatchPositionCapturedEvent(new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0));

                _tmpVector2.x = (event.offsetX / containerJquery.width()) * 2 - 1;
                _tmpVector2.y = -(event.offsetY / containerJquery.height()) * 2 + 1;
                _tmpRaycaster.setFromCamera(_tmpVector2, camera);

                var intersects = _tmpRaycaster.intersectObjects(scene.children, true);
                var entities = [];
                var photos = [];

                for (var item of intersects) {

                    var grp = item.object.parent;

                    if (grp instanceof THREE.Group == false) {
                        continue;
                    }

                    var pvr = PUtilities.prototype.checkRequiredFields(grp.userData, PhotoViewer.prototype.photoInterface);

                    if (pvr.isValid === true) {
                        photos.push(grp.userData);
                        continue;
                    }

                    var evr = PUtilities.prototype.checkRequiredFields(grp.userData, FloorPlanViewer.prototype.entityInterface);

                    if (evr.isValid === true) {
                        entities.push(grp.userData);
                        continue;
                    }
                }

                if (photos.length != 0) {
                    dispatchPhotosPicked(photos);
                }

                if (entities.length != 0) {
                    dispatchEntitiesPicked(entities, event.shiftKey);
                }

                if (entities.length == 0 && photos.length == 0) {
                    dispatchUnselectAll();
                }

            }

        } else if (event.button == 2) {

            if (Math.abs(event.clientX - onPointerDownPointerX) < 10 && Math.abs(event.clientY - onPointerDownPointerY) < 10) {
                dispatchActionFinishedEvent(new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0));
            }

        }
    }

    function onContainerMouseDonw(event) {

        event.preventDefault();

        var offsetY = event.offsetY != undefined ? event.offsetY : event.originalEvent.changedTouches[0].clientY - ($(window).height() - event.currentTarget.offsetHeight);
        var offsetX = event.offsetX != undefined ? event.offsetX : event.originalEvent.changedTouches[0].clientX - ($(window).width() - event.currentTarget.offsetWidth);
        rasterCursorePositionX = camera.position.x + (offsetX - containerJquery.width() / 2) / camera.zoom;
        rasterCursorePositionY = camera.position.y + (containerJquery.height() / 2 - offsetY) / camera.zoom;

        if (event.button == 0) {

            isUserInteracting = true;

            dispatchPositionLeftDown(
                new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0),
                event.shiftKey,
                event.ctrlKey,
                event.altKey
            );

        }
        else if (event.button == 2) {

        }

        onPointerDownPointerX = event.clientX;
        onPointerDownPointerY = event.clientY;
        pointerLastPositionX = event.clientX;
        pointerLastPositionY = event.clientY;
    }

    function onContainerMouseMove(event) {

        var offsetY = event.offsetY != undefined ? event.offsetY : event.originalEvent.changedTouches[0].clientY - ($(window).height() - event.currentTarget.offsetHeight);
        var offsetX = event.offsetX != undefined ? event.offsetX : event.originalEvent.changedTouches[0].clientX - ($(window).width() - event.currentTarget.offsetWidth);
        rasterCursorePositionX = camera.position.x + (offsetX - containerJquery.width() / 2) / camera.zoom;
        rasterCursorePositionY = camera.position.y + (containerJquery.height() / 2 - offsetY) / camera.zoom;

        if (isUserInteracting === true && viewerContext.isPanningFrozen == false) {

            var mouseMovementDirX = pointerLastPositionX - event.clientX;
            var mouseMovementDirY = event.clientY - pointerLastPositionY;

            camera.position.x = camera.position.x + mouseMovementDirX / camera.zoom;
            camera.position.y = camera.position.y + mouseMovementDirY / camera.zoom;

            pointerLastPositionX = event.clientX;
            pointerLastPositionY = event.clientY;

            dispatchCameraStateChangedEvent();

        } else {

            //if (capturingShapeType == Viewer.prototype.SHAPE_TYPE.POLYGON && capturingShapeVertices.length >= 3) {
            //    capturingShapeVertices[capturingShapeVertices.length - 2].x = rasterCursorePositionX;
            //    capturingShapeVertices[capturingShapeVertices.length - 2].y = rasterCursorePositionY;

            //    updateScratchFeature();
            //}

        }

        dispatchCursorMovedEvent(new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0));

        lastClientX = event.clientX;
        lastClientY = event.clientY;

        UPDATE_REQUIRED = true;
    }

    function processZoom(zoomDirection, zoomAboutX, zoomAboutY) {

        // remember cursore position before zoom
        var rasterCursorePositionXBefore = camera.position.x + (zoomAboutX - containerJquery.width() / 2) / camera.zoom;
        var rasterCursorePositionYBefore = camera.position.y + (containerJquery.height() / 2 - zoomAboutY) / camera.zoom;

        // calculate zoom
        if (zoomDirection > 0) {
            camera.zoom -= camera.zoom / 4;
            camera.updateProjectionMatrix();
        }
        else {
            camera.zoom += camera.zoom;
            camera.updateProjectionMatrix();
        }

        // move screen to previous cursore position
        var rasterCursorePositionXAfter = camera.position.x + (zoomAboutX - containerJquery.width() / 2) / camera.zoom;
        var rasterCursorePositionYAfter = camera.position.y + (containerJquery.height() / 2 - zoomAboutY) / camera.zoom;

        camera.position.x += rasterCursorePositionXBefore - rasterCursorePositionXAfter;
        camera.position.y += rasterCursorePositionYBefore - rasterCursorePositionYAfter;
        UPDATE_REQUIRED = true;
    }

    // EVENT DISPATCHERS

    function dispatchCameraStateChangedEvent() {

        var event = buildEvent('camerastatechanged', { camera: camera });
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchTextureLoadedEvent() {

        var event = buildEvent('textureloaded');
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchPositionCapturedEvent(vector3) {

        var detail = { position: vector3 };

        var beforeEvent = buildEvent('beforepositioncaptured', detail);
        containerJquery[0].dispatchEvent(beforeEvent);

        var event = buildEvent('positioncaptured', detail);
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchCursorMovedEvent(vector3) {

        var detail = { position: vector3 };

        var beforeEvent = buildEvent('beforecursormoved', detail);
        containerJquery[0].dispatchEvent(beforeEvent);

        var event = buildEvent('cursormoved', { position: vector3 });
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchPositionLeftDown(vector3, shiftKey = false, ctrlKey = false, altKey = false) {

        var detail = {
            position: vector3,
            shiftKey: shiftKey,
            ctrlKey: ctrlKey,
            altKey: altKey
        };

        var event = buildEvent('positionleftdown', detail);
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchPositionLeftUp(vector3) {
        var detail = { position: vector3 };

        var event = buildEvent('positionleftup', detail);
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchActionFinishedEvent(vector3) {

        var event = buildEvent('actionfinished', { position: vector3 });
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchActionCanceledEvent() {

        var event = buildEvent('actioncanceled');
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchEntitiesPicked(entities, shiftKey = false) {

        var event = buildEvent('entitiespicked', { entities: entities, shiftKey: shiftKey });
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchPhotosPicked(photos) {

        var event = buildEvent('photospicked', { photos: photos });
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchUnselectAll() {

        var event = buildEvent('unselectall');
        containerJquery[0].dispatchEvent(event);
    }

    function buildEvent(eventName, detail = {}) {

        detail.guid = viewerContext.guid;

        var event = new CustomEvent(eventName, {
            detail: detail
        });

        return event;
    }

    // HELPERS

    function getFeature3DObject(feature, idColumnName = 'id') {

        for (var obj of scene.children) {

            if (typeof obj.userData != 'undefined' && obj.userData[idColumnName] == feature[idColumnName]) {
                return obj;
            }
        }

        // null if not found
        return null;
    }

    function getEntity3DObject(entity) {

        for (var obj of scene.children) {

            var vr = PUtilities.prototype.checkRequiredFields(obj.userData, FloorPlanViewer.prototype.entityInterface);

            if (vr.isValid === false) {
                continue;
            }

            if (typeof obj.userData != 'undefined' && obj.userData.id == entity.id) {
                return obj;
            }
        }

        // null if not found
        return null;
    }

    function getPhoto3dObject(photo) {

        for (var obj of scene.children) {

            var vr = PUtilities.prototype.checkRequiredFields(obj.userData, PhotoViewer.prototype.photoInterface);

            if (vr.isValid === false) {
                continue;
            }

            if (typeof obj.userData != 'undefined' && obj.userData.ID == photo.ID) {
                return obj;
            }
        }

        // null if not found
        return null;
    }

    function updateTransformationMatrix(tk) {
        if (Array.isArray(tk) && tk.length == 16) {
            tk = tk.map(e => parseFloat(e));
            transformationMatrix.fromArray(tk);
        } else {
            throw "Incorrect transformation matrix components!"
        }
    }

    function setTransformationFromMatrix(obj, tm) {
        tm.decompose(obj.position, obj.quaternion, obj.scale)
        obj.updateMatrix();
        obj.updateMatrixWorld();
    }

    function refreshCameraSettings() {

        var canvasWith = containerJquery.width();
        var canvasHeight = containerJquery.height();

        $(renderer.domElement).width(canvasWith);
        $(renderer.domElement).height(canvasHeight);

        camera.aspect = canvasWith / canvasHeight;
        camera.left = canvasWith / -2;
        camera.right = canvasWith / 2;
        camera.bottom = canvasHeight / -2;
        camera.top = canvasHeight / 2;
        renderer.setSize(canvasWith, canvasHeight);
        camera.updateProjectionMatrix();
        dispatchCameraStateChangedEvent();
    }

    function doDisposeMesh(obj) {
        if (obj !== null) {
            for (var i = 0; i < obj.children.length; i++) {
                doDisposeMesh(obj.children[i]);
            }
            if (obj.geometry) {
                doDisposeGeometry(obj.geometry);
            }
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    for (var i = 0; i < obj.material.length; i++) {
                        doDisposeMaterial(obj.material[i]);
                    }
                } else {
                    doDisposeMaterial(obj.material);
                }
            }
        }
    }

    function doDisposeMaterial(material) {

        if (material.map) {
            material.map.dispose();
            material.map = undefined;
        }

        if (material.__webglShader && material.__webglShader.uniforms && material.__webglShader.uniforms.tDiffuse) {
            material.__webglShader.uniforms.tDiffuse.value.dispose();
            material.__webglShader.uniforms.tDiffuse.value = undefined;
        }

        material.dispose();
        material = undefined;
        return undefined;
    }

    function doDisposeGeometry(geom) {
        geom.dispose();
        geom = undefined;
        return undefined;
    }

    function getPhotoPositionVisibility(metadata) {
        return true;
    }

    function getEntityVisibility(metadata) {
        return true;
    }

    function photoMetadataTo3DObject(metadata) {

        var group = new THREE.Group();

        var texture = new THREE.TextureLoader().load(PHOTO_ICON_PATH);
        var geom = new THREE.PlaneGeometry(PHOTO_POSITION_LABEL_SIZE, PHOTO_POSITION_LABEL_SIZE);
        var material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 1.0, color: 0xFFFFFF });
        var mesh = new THREE.Mesh(geom, material);

        mesh.translateX(parseFloat(metadata.HotspotX));
        mesh.translateY(-parseFloat(metadata.HotspotY)); // reverse Y because of raster coords
        mesh.translateZ(PHOTO_POSITION_Z_OFFSET);

        _tmpQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), - Math.PI * parseFloat(metadata.HotspotTheta) / 180).normalize();
        mesh.quaternion.copy(_tmpQuaternion);

        group.add(mesh);
        group.userData = metadata;

        return group;
    }

    //function metadataTo3DObject(metadata, style = {}) {

    //    var entityColor = DEFAULT_ENTITY_COLOR;
    //    var entityWidth = DEFAULT_ENTITY_WIDTH;

    //    if (typeof style.color != 'undefined') {
    //        entityColor = style.color;
    //    }

    //    if (typeof style.width != 'undefined') {
    //        entityWidth = style.width;
    //    }

    //    var geomType = turf.getType(metadata);
    //    var vertices = PUtilities.prototype.geoJsonToVector3Array(metadata);

    //    var group = new THREE.Group();

    //    if (geomType == 'LineString' || geomType == 'Polygon') {

    //        if (entityWidth == 0) {
    //            var geom = new THREE.BufferGeometry().setFromPoints(vertices);
    //            geom.computeBoundingSphere();
    //            var mesh = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: entityColor }));
    //            group.add(mesh);
    //        } else {
    //            var meshLine = new MeshLine();
    //            meshLine.setPoints(vertices);
    //            var mesh = new THREE.Mesh(meshLine, new MeshLineMaterial({ color: entityColor, lineWidth: entityWidth }));
    //            mesh.raycast = MeshLineRaycast; // raycast support
    //            group.add(mesh);
    //        }

    //        if (style.node) {

    //            var entityNodeRadius = DEFAULT_ENTITY_NODE_RADIUS;

    //            if (typeof style.node.radius != 'undefined') {
    //                entityNodeRadius = style.node.radius;
    //            }

    //            for (var v of vertices) {
    //                var nodeGeom = new THREE.SphereGeometry(entityNodeRadius, 5, 5);
    //                var nodeMesh = new THREE.Mesh(nodeGeom, new THREE.MeshBasicMaterial({ color: entityColor }));
    //                nodeMesh.translateX(v.x);
    //                nodeMesh.translateY(v.y);
    //                nodeMesh.translateZ(v.z);
    //                group.add(nodeMesh);
    //            }
    //        }

    //        if (geomType == 'Polygon') {

    //            var entityFillOpacity = DEFAULT_ENTITY_FILL_OPACITY;

    //            if (typeof style.fillOpacity != 'undefined') {
    //                entityFillOpacity = style.fillOpacity;
    //            }

    //            var triangles = THREE.ShapeUtils.triangulateShape(vertices, []);

    //            if (triangles.length > 0) {
    //                var position = new Float32Array(triangles.length * 9);
    //                positionIndex = 0;

    //                for (var i = 0; i < triangles.length; i++) {

    //                    var p0 = vertices[triangles[i][0]];
    //                    var p1 = vertices[triangles[i][1]];
    //                    var p2 = vertices[triangles[i][2]];

    //                    position[positionIndex + 0] = p0.x;
    //                    position[positionIndex + 1] = p0.y;
    //                    position[positionIndex + 2] = p0.z;

    //                    position[positionIndex + 3] = p1.x;
    //                    position[positionIndex + 4] = p1.y;
    //                    position[positionIndex + 5] = p1.z;

    //                    position[positionIndex + 6] = p2.x;
    //                    position[positionIndex + 7] = p2.y;
    //                    position[positionIndex + 8] = p2.z;

    //                    positionIndex += 9;
    //                }

    //                var fillGeometry = new THREE.BufferGeometry();
    //                fillGeometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    //                fillGeometry.computeVertexNormals();
    //                var fillMesh = new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({ color: entityColor, transparent: true, opacity: entityFillOpacity }));
    //                group.add(fillMesh);
    //            }
    //        }

    //    } else {
    //        throw 'Floorplan viewer [' + this.guid + '] unsupported geometry type: ' + geomType;
    //    }

    //    group.userData = metadata;
    //    return group;
    //}

    init();
    render();

}

FloorPlanViewer.prototype.PATH_PREFIX = '';

FloorPlanViewer.prototype.floorPlanInterface = ['FloorplanImageURL', 'FloorplanUID'];

FloorPlanViewer.prototype.entityInterface = ['id', 'geometry', 'parentId'];
