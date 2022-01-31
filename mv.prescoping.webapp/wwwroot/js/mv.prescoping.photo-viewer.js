function PhotoViewer(containerJquery) {

    const DEFAULT_LAYOUT_COLOR = 'green';
    const DEFAULT_LAYOUT_WIDTH = 5;
    const DEFAULT_LAYOUT_NODE_RADIUS = 5;
    const DEFAULT_FLOOR_H = -1.75;
    const DEFAULT_CEILING_H = 1.75;
    const PROXY_DATA_URL = FloorPlanViewer.prototype.PATH_PREFIX + '/Proxy/Data/';
    const FONT_3D_PATH = FloorPlanViewer.prototype.PATH_PREFIX + '/font/gentilis_regular.typeface.json';
    const DEFAULT_FILTER = { classNames: null, labels: null, confidentLevelMin: 0.0, confidentLevelMax: 1.0 };

    var UPDATE_REQUIRED = true;
    var TARGET_FPS = 60;

    var camera, scene, renderer;
    var isUserInteracting, onPointerDownPointerX, pointerLastPositionX, pointerLastPositionY, onPointerDownPointerY ,rasterCursorePositionX, rasterCursorePositionY;
    var lastClientX, lastClientY;
    var requestAnimationFrameId = null;
    var prevRenderingTime = new Date();
    var imageWidth, imageHeight;

    var viewerContext = this;

    var _infoBoxJquery = null;
    var _waitingBoxJquery = null;
    var _tmpRaycaster = new THREE.Raycaster();
    var _tmpVector2 = new THREE.Vector2();
    var scratchGroup = null;
    var _filter = JSON.parse(JSON.stringify(DEFAULT_FILTER));

    // INTERFACE

    this.guid = null;

    this.dispatcherDOM = containerJquery[0];

    this.featureCollection = turf.featureCollection([]);

    this.isPanningFrozen = false;

    this.currentMetadata = null;

    this.getImageSize = function () {

        if (this.currentMetadata == null) {
            return null;
        } else {
            return { imageWidth, imageHeight }
        }

    }

    this.floorH = DEFAULT_FLOOR_H;

    this.ceilingH = DEFAULT_CEILING_H;

    this.styleForEditing = {
        color: "magenta",
        width: 5,
        node: {
            radius: 5
        },
        label: {
            size: 25
        }
    }

    this.styleDefault = {
        color: "red",
        width: 5,
        node: {
            radius: 5
        },
        label: {
            size: 25
        }
    }

    this.styleLayoutForEditing = {
        color: "magenta",
        width: 5,
        node: {
            radius: 10
        }
    }

    this.styleLayoutDefault = {
        color: "red",
        width: 5,
        node: {
            radius: 5
        }
    }

    this.styleScratch = {
        color: "red",
        width: 0
    }

    this.getDefaultFilter = function () {
        return JSON.parse(JSON.stringify(DEFAULT_FILTER));
    }

    this.setCursorType = function (cssCursorType) {
        // 'crosshair', 'default'
        containerJquery.css('cursor', cssCursorType);
    }

    this.showInfoMsg = function (msg) {
        _infoBoxJquery.text(msg);
    }

    this.showPhoto = function (metadata) {

        _waitingBoxJquery.show();

        // clean up
        this.cleanupAll();

        // set default flor and ceiling height
        this.floorH = DEFAULT_FLOOR_H;
        this.ceilingH = DEFAULT_CEILING_H;

        // validate metadata
        var vr = PUtilities.prototype.checkRequiredFields(metadata, PhotoViewer.prototype.photoInterface);

        if (vr.isValid === false) {
            alert('An error occurred while photo rendering. ' + vr.msg);
            return;
        }

        // update metadata
        this.currentMetadata = metadata;

        imageWidth = parseInt(metadata.Width);
        imageHeight = parseInt(metadata.Height);

        var loader = new THREE.TextureLoader();
        loader.crossOrigin = '';

        var texturePath = metadata.UnalteredURL;

        // use proxy if needed
        if (window.location.host.indexOf('localhost') != -1) {
            texturePath = PROXY_DATA_URL + '?url=' + metadata.UnalteredURL;
        }

        loader.load(texturePath,
            function (texture) {
                // update metadata
                //imageWidth = texture.image.width;
                //imageHeight = texture.image.height;

                // put background on the screen
                var geometry = new THREE.PlaneGeometry(imageWidth, imageHeight);
                geometry.translate(imageWidth / 2, - imageHeight / 2, -1);
                var material = new THREE.MeshBasicMaterial({ map: texture });
                var mesh = new THREE.Mesh(geometry, material);
                mesh.userData = metadata;

                scene.add(mesh);

                // move camera to the center of the geometry
                mesh.geometry.computeBoundingSphere();
                var c = mesh.geometry.boundingSphere.center.clone();
                var cw = mesh.localToWorld(c);
                camera.position.x = cw.x;
                camera.position.y = cw.y;

                dispatchTextureLoadedEvent();

                _waitingBoxJquery.hide();

                UPDATE_REQUIRED = true;
            }
        );

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

        if (_waitingBoxJquery) {
            _waitingBoxJquery.remove();
        }

        // cleanup sceen
        this.cleanupAll();

        // dispose three
        renderer.dispose();
        $(renderer.domElement).remove();
    }

    this.cleanupAll = function () {

        for (var i = 0; i < scene.children.length; i++) {
            var obj = scene.children[i];
            doDisposeMesh(obj);
            scene.remove(obj);
            i--;
        }

        viewerContext.featureCollection = turf.featureCollection([]);

    }

    this.addLayout = function (feature, style) {

        if (this.currentMetadata == null) {
            return;
        }

        var mesh = layoutTo3DObject(feature, style);
        mesh.visible = getLayoutVisibility(feature);
        scene.add(mesh);

        viewerContext.featureCollection.features.push(feature);

        UPDATE_REQUIRED = true;

    }

    this.addFloor = function (feature, style) { }

    this.removeLayout = function (feature) {

        var obj = get3DObjectByUserDataId(feature);

        if (obj) {
            doDisposeMesh(obj);
            scene.remove(obj);
        }

        // remove from feature collection
        for (var i = 0; i < viewerContext.featureCollection.features.length; i++) {
            if (feature.id == viewerContext.featureCollection.features[i].id) {
                viewerContext.featureCollection.features.splice(i, 1);
                i--;
            }
        }

        UPDATE_REQUIRED = true;

    }

    this.updateLayout = function (feature, style) {

        // turfable obj
        if (typeof feature.type == 'undefined') {
            feature.type = 'Feature';
        }

        var obj = getLayout3DObject(feature);

        if (obj == null) {
            return null;
        }

        var tmpGrp = layoutTo3DObject(feature, style);

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

        // update feature in collection
        for (var i = 0; i < viewerContext.featureCollection.features.length; i++) {
            if (viewerContext.featureCollection.features[i].id == feature.id) {
                viewerContext.featureCollection.features[i] = feature;
            }
        }

        obj.userData = feature;
        tmpGrp = null;
        UPDATE_REQUIRED = true;
        return obj;

    }

    this.addEntities = function (entities, style) {

        $.each(entities, function (key, metadata) {

            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(metadata, PhotoViewer.prototype.annotationInterface);

            if (vr.isValid === false) {
                alert('An error occurred while rendering of the annotation. ' + vr.msg);
                return false;
            }

            // turfable
            if (typeof metadata.type == 'undefined') {
                metadata.type = 'Feature';
            }

            // add font to the style
            addFontToStyle(style);

            // build 3d object
            var mesh = PUtilities.prototype.featureTo3DObject(metadata, style, getAnnotationLabel(metadata));
            mesh.visible = getAnnotationVisibility(metadata);
            scene.add(mesh);

            // add feature into collection
            viewerContext.featureCollection.features.push(metadata);

        });

        UPDATE_REQUIRED = true;
    }

    this.setEntitiesFilter = function (filter) {

        if (filter) {
            if (typeof filter.classNames != 'undefined') {
                _filter.classNames = filter.classNames;
            }

            if (typeof filter.labels != 'undefined') {
                _filter.labels = filter.labels;
            }

            if (typeof filter.confidentLevelMin != 'undefined') {
                _filter.confidentLevelMin = parseFloat(filter.confidentLevelMin);
            }

            if (typeof filter.confidentLevelMax != 'undefined') {
                _filter.confidentLevelMax = parseFloat(filter.confidentLevelMax);
            }
        }

        for (var item of this.featureCollection.features) {
            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(item, PhotoViewer.prototype.annotationInterface);

            if (vr.isValid === false) {
                continue;
            }

            // get 3D object
            var obj = getAnnotation3DObject(item);

            if (obj == null) {
                continue;
            }

            // set visibility
            obj.visible = getAnnotationVisibility(item);
        }

        UPDATE_REQUIRED = true;

    }

    this.updateEntities = function (entities, style, label = null) {

        for (var item of entities) {
            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(item, PhotoViewer.prototype.annotationInterface);

            if (vr.isValid === false) {
                alert('An error occurred while rendering of the annotation. ' + vr.msg);
                return false;
            }

            if (item.geometry == null) {
                alert('Geometry has NULL value!');
                return false;
            }

            // turfable obj
            if (typeof item.type == 'undefined') {
                item.type = 'Feature';
            }

            var obj = getAnnotation3DObject(item);

            if (obj == null) {
                return null;
            }

            // add font to the style
            addFontToStyle(style);

            // build object 3d
            var tmpGrp = PUtilities.prototype.featureTo3DObject(item, style, label !== null ? label : getAnnotationLabel(item));

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

            obj.userData = item;
            tmpGrp = null;

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

    this.removeEntities = function (entities) {

        for (var item of entities) {
            // validate metadata
            var vr = PUtilities.prototype.checkRequiredFields(item, PhotoViewer.prototype.annotationInterface);

            if (vr.isValid === false) {
                alert('An error occurred while removing an annotation. ' + vr.msg);
                return false;
            }

            // remove from the scene
            var obj = getAnnotation3DObject(item);

            if (obj) {
                doDisposeMesh(obj);
                scene.remove(obj);
            }

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

    this.removeAllEntities = function () {

        // get all entities on the scene
        var entities = [];

        for (var obj of scene.children) {
            var vr = PUtilities.prototype.checkRequiredFields(obj.userData, PhotoViewer.prototype.annotationInterface);

            if (vr.isValid === true) {
                entities.push(obj.userData);
            }
        }

        viewerContext.removeEntities(entities);

        UPDATE_REQUIRED = true;

    }

    this.drawScratchGeometry = function (geoJson, style = null) {

        if (geoJson) {

            if (style == null) {
                style = viewerContext.styleScratch;
            }

            var tmpGrp = PUtilities.prototype.featureTo3DObject(geoJson, style);

            if (tmpGrp == null) {
                return null;
            }

            if (scratchGroup) {

                for (var i = 0; i < scratchGroup.children.length; i++) {
                    var tmp = scratchGroup.children[i];
                    doDisposeMesh(tmp);
                    scratchGroup.remove(tmp);
                    i--;
                }

                while (tmpGrp.children.length) {
                    scratchGroup.add(tmpGrp.children[0]);
                }

                scratchGroup.userData = geoJson;
                tmpGrp = null;

            } else {

                scratchGroup = tmpGrp;
                scratchGroup.userData = geoJson;
                scene.add(scratchGroup);
            }

        } else {

            if (scratchGroup) {
                doDisposeMesh(scratchGroup);
                scene.remove(scratchGroup);
                scratchGroup = null;
            }
        }

        UPDATE_REQUIRED = true;
    }

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

        _waitingBoxJquery = $("<div class='viewer-waiting-animation'></div>");
        containerJquery.append(_waitingBoxJquery);
        _waitingBoxJquery.hide();

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

    // EVENT HANDLERS
    function onContainerMouseenter(event) {
        containerJquery.focus();
    }

    function onContainerMouseleave(event) {
        containerJquery.blur();
        isUserInteracting = false;
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
                var layouts = [];
                var entities = []; // annotation is entity for the photo viewer

                for (var item of intersects) {

                    var grp = item.object.parent;

                    if (grp instanceof THREE.Group == false) {
                        continue;
                    }

                    // layout case
                    var lvr = PUtilities.prototype.checkRequiredFields(grp.userData, PhotoViewer.prototype.layoutInterface);

                    if (lvr.isValid === true) {

                        var tmpl = layouts.find(e => e.id == grp.userData.id);

                        if (tmpl) {
                            continue;
                        }

                        layouts.push(grp.userData);
                        continue;
                    }

                    // annotation case
                    var avr = PUtilities.prototype.checkRequiredFields(grp.userData, PhotoViewer.prototype.annotationInterface);

                    if (avr.isValid === true) {

                        var tmpa = entities.find(e => e.id == grp.userData.id);

                        if (tmpa) {
                            continue;
                        }

                        entities.push(grp.userData);
                        continue;
                    }
                }

                if (layouts.length != 0) {
                    dispatchLayoutPicked(layouts, event.shiftKey);
                }

                if (entities.length != 0) {
                    dispatchEntitiesPicked(entities, event.shiftKey);
                }

                if (layouts.length == 0 && entities.length == 0) {
                    dispatchUnselectAll();
                }

            }

        } else if (event.button == 2) {

            dispatchPositionRightUp(new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0));

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

            dispatchPositionRightDown(
                new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0),
                event.shiftKey,
                event.ctrlKey,
                event.altKey
            );

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

        }

        dispatchCursorMovedEvent(
            new THREE.Vector3(rasterCursorePositionX, rasterCursorePositionY, 0),
            event.shiftKey,
            event.ctrlKey,
            event.altKey
        );

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

    function dispatchCursorMovedEvent(vector3, shiftKey = false, ctrlKey = false, altKey = false) {

        var detail = {
            position: vector3,
            shiftKey: shiftKey,
            ctrlKey: ctrlKey,
            altKey: altKey
        };

        var beforeEvent = buildEvent('beforecursormoved', detail);
        containerJquery[0].dispatchEvent(beforeEvent);

        var event = buildEvent('cursormoved', detail);
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

    function dispatchPositionRightDown(vector3, shiftKey = false, ctrlKey = false, altKey = false) {

        var detail = {
            position: vector3,
            shiftKey: shiftKey,
            ctrlKey: ctrlKey,
            altKey: altKey
        };

        var event = buildEvent('positionrightdown', detail);
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchPositionRightUp(vector3) {
        var detail = { position: vector3 };

        var event = buildEvent('positionrightup', detail);
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchActionFinishedEvent(vector3) {

        var event = buildEvent('actionfinished', { position: vector3 });
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchLayoutPicked(layouts, shiftKey = false) {

        var event = buildEvent('layoutpicked', { layouts: layouts, shiftKey: shiftKey });
        containerJquery[0].dispatchEvent(event);
    }

    function dispatchEntitiesPicked(entities, shiftKey = false) {

        var event = buildEvent('entitiespicked', { entities: entities, shiftKey: shiftKey });
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

    function addFontToStyle(style) {
        if (!style) {
            style = {};
        }

        if (!style.label) {
            style.label = {};
        }

        if (!style.label.font) {
            style.label.font = font3d;
        }
    }

    function getLayout3DObject(layout) {

        for (var obj of scene.children) {

            var vr = PUtilities.prototype.checkRequiredFields(obj.userData, PhotoViewer.prototype.layoutInterface);

            if (vr.isValid === false) {
                continue;
            }

            if (typeof obj.userData != 'undefined' && obj.userData.id == layout.id) {
                return obj;
            }
        }

        // null if not found
        return null;
    }

    function get3DObjectByUserDataId(feature) {

        for (var obj of scene.children) {

            if (typeof obj.userData != 'undefined' && obj.userData.id == feature.id) {
                return obj;
            }
        }

        // null if not found
        return null;
    }

    function getAnnotation3DObject(annotation) {

        for (var obj of scene.children) {

            var vr = PUtilities.prototype.checkRequiredFields(obj.userData, PhotoViewer.prototype.annotationInterface);

            if (vr.isValid === false) {
                continue;
            }

            if (typeof obj.userData != 'undefined' && obj.userData.id == annotation.id) {
                return obj;
            }
        }

        // null if not found
        return null;
    }

    function layoutTo3DObject(geoJson, style) {

        var layoutColor = DEFAULT_LAYOUT_COLOR;
        var layoutWidth = DEFAULT_LAYOUT_WIDTH;
        var layoutNodeRadius = DEFAULT_LAYOUT_NODE_RADIUS;

        if (typeof style.color != 'undefined') {
            layoutColor = style.color;
        }

        if (typeof style.width != 'undefined') {
            layoutWidth = style.width;
        }

        if (typeof style.node.radius != 'undefined') {
            layoutNodeRadius = style.node.radius;
        }

        var group = new THREE.Group();

        turf.flattenEach(geoJson, function (currentFeature, featureIndex, multiFeatureIndex) {
            // segment-wise drawing
            var vertices = PUtilities.prototype.geoJsonToVector3Array(currentFeature);
            var parts = [];

            // build wall polygon
            if (vertices[1].x > vertices[0].x || vertices[0].x - vertices[1].x < imageWidth / 2) { // hack for the small columns - vertices[0].x - vertices[1].x < imageWidth / 2
                // face daes not cross edge of the image
                pvertices = [];
                pvertices.push(...projectLine3d(vertices[0].clone(), vertices[1].clone(), viewerContext.floorH, 0.1));
                pvertices.push(...projectLine3d(vertices[2].clone(), vertices[3].clone(), viewerContext.ceilingH, 0.1));
                pvertices.push(vertices[0].clone());

                for (var v of pvertices) {
                    v.z = 1;
                }

                parts.push(pvertices);

            } else {
                // face crosses edge of the image
                var floor = projectLine3d(vertices[0].clone(), vertices[1].clone(), viewerContext.floorH, 0.1);
                var ceiling = projectLine3d(vertices[3].clone(), vertices[2].clone(), viewerContext.ceilingH, 0.1);

                var fp1 = [];
                var fp2 = [];
                var cp1 = [];
                var cp2 = [];

                if (floor.length > 2) {
                    for (var i = 0; i < floor.length; i++) {
                        if (fp2.length > 0 || (i > 0 && floor[i].x < floor[i - 1].x)) {
                            fp2.push(floor[i]);
                        } else {
                            fp1.push(floor[i]);
                        }
                    }

                    fp1.push(new THREE.Vector3(imageWidth, fp1[fp1.length - 1].y, fp1[fp1.length - 1].z)); // add edge point
                    fp2.unshift(new THREE.Vector3(0, fp2[0].y, fp2[0].z)); // add edge point

                } else {
                    fp1.push(floor[0]);
                    fp1.push(new THREE.Vector3(imageWidth, floor[0].y, floor[0].z)); // add edge point

                    fp2.push(new THREE.Vector3(0, floor[1].y, floor[1].z)); // add edge point
                    fp2.push(floor[1]);
                }

                if (ceiling.length > 2) {
                    for (var i = 0; i < ceiling.length; i++) {
                        if (cp2.length > 0 || (i > 0 && ceiling[i].x < ceiling[i - 1].x)) {
                            cp2.push(ceiling[i]);
                        } else {
                            cp1.push(ceiling[i]);
                        }
                    }

                    cp1.push(new THREE.Vector3(imageWidth, cp1[cp1.length - 1].y, cp1[cp1.length - 1].z)); // add edge point
                    cp2.unshift(new THREE.Vector3(0, cp2[0].y, cp2[0].z)); // add edge point

                } else {
                    cp1.push(ceiling[0]);
                    cp1.push(new THREE.Vector3(imageWidth, ceiling[0].y, ceiling[0].z)); // add edge point

                    cp2.push(new THREE.Vector3(0, ceiling[1].y, ceiling[1].z)); // add edge point
                    cp2.push(ceiling[1]);
                }

                // build polygons
                cp1.reverse();
                fp1.push(...cp1);
                fp1.push(fp1[0].clone());

                for (var v of fp1) {
                    v.z = 1;
                }

                parts.push(fp1);

                cp2.reverse();
                fp2.push(...cp2);
                fp2.push(fp2[0].clone());

                for (var v of fp2) {
                    v.z = 1;
                }

                parts.push(fp2);
            }

            for (var v of vertices) {
                v.z = 1;
            }

            // build Object3D
            for (var item of parts) {
                // draw geometry
                if (layoutWidth == 1) {
                    var geom = new THREE.BufferGeometry().setFromPoints(item);
                    geom.computeBoundingSphere();
                    var mesh = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: layoutColor }));
                    group.add(mesh);
                } else {
                    var meshLine = new MeshLine();
                    meshLine.setPoints(item);
                    var mesh = new THREE.Mesh(meshLine, new MeshLineMaterial({ color: layoutColor, lineWidth: layoutWidth }));
                    mesh.raycast = MeshLineRaycast; // raycast support
                    group.add(mesh);
                }
            }

            if (style.node) {

                for (var v of vertices) {
                    var nodeGeom = new THREE.SphereGeometry(layoutNodeRadius, 5, 5);
                    var nodeMesh = new THREE.Mesh(nodeGeom, new THREE.MeshBasicMaterial({ color: layoutColor }));
                    nodeMesh.translateX(v.x);
                    nodeMesh.translateY(v.y);
                    nodeMesh.translateZ(v.z);
                    group.add(nodeMesh);
                }

            }
        });

        group.userData = geoJson;
        return group;

    }

    function projectLine3d(v1, v2, h = 1.5, step = 0.1) {

        // var xyz1 = PUtilities.prototype.uvToXyz(Math.abs(v1.x / imageWidth), Math.abs(v1.y / imageHeight), h);
        var xyz1 = PSULIB.PANO.uvToXyz(Math.abs(v1.x / imageWidth), Math.abs(v1.y / imageHeight), h);
        // var xyz2 = PUtilities.prototype.uvToXyz(Math.abs(v2.x / imageWidth), Math.abs(v2.y / imageHeight), h);
        var xyz2 = PSULIB.PANO.uvToXyz(Math.abs(v2.x / imageWidth), Math.abs(v2.y / imageHeight), h);

        var dir = new THREE.Vector3(xyz2.x - xyz1.x, xyz2.y - xyz1.y, xyz2.z - xyz1.z);
        var l = dir.length();
        dir.normalize();

        var d = step;
        var pvs = [];
        pvs.push(v1.clone());

        while (d < l) {
            var tpxyz = new THREE.Vector3(xyz1.x + dir.x * d, xyz1.y + dir.y * d, xyz1.z + dir.z * d);
            var tpuv = PSULIB.PANO.xyxToUv(tpxyz.x, tpxyz.y, tpxyz.z);
            pvs.push(new THREE.Vector3(tpuv[0] * imageWidth, tpuv[1] * imageHeight * (-1), v1.z));
            d += step;
        }

        pvs.push(v2.clone());
        return pvs;
    }

    function getLayoutVisibility(geoJson) {
        return true;
    }

    function getAnnotationVisibility(annotation) {

        if (typeof _filter.classNames != 'undefined' && Array.isArray(_filter.classNames) == true && _filter.classNames.indexOf(annotation.className) == -1) {
            return false;
        }

        if (typeof _filter.labels != 'undefined' && Array.isArray(_filter.labels) == true && _filter.labels.indexOf(annotation.label) == -1) {
            return false;
        }

        if (typeof _filter.confidentLevelMin != 'undefined') {
            var _confidentLevelMin = parseFloat(_filter.confidentLevelMin);

            if (isNaN(_confidentLevelMin) == false && annotation.confidentLevel < _confidentLevelMin && _confidentLevelMin != 0) {
                return false;
            }
        }

        if (typeof _filter.confidentLevelMax != 'undefined') {
            var _confidentLevelMax = parseFloat(_filter.confidentLevelMax);

            if (isNaN(_confidentLevelMax) == false && annotation.confidentLevel > _confidentLevelMax) {
                return false;
            }
        }

        return true;
    }

    function getAnnotationLabel(annotation) {
        return annotation.className;
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

    init();
    render();
}

PhotoViewer.prototype.PATH_PREFIX = '';

PhotoViewer.prototype.photoInterface = ['PhotoID', 'UnalteredURL', 'Height', 'Width', 'HotspotX', 'HotspotY', 'HotspotTheta'];

PhotoViewer.prototype.layoutInterface = ['id', 'data', 'dx', 'dy', 'dz', 'rz', 'url'];

PhotoViewer.prototype.entityInterface = ['id', 'geometry', 'parentId'];

PhotoViewer.prototype.annotationInterface = ['id', 'geometry', 'className', 'confidentLevel'];

PhotoViewer.prototype.defaultFilter = { classNames: null, labels: null, confidentLevelMin: 0.0, confidentLevelMax: 1.0 };