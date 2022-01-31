$(document).ready(function () {

    FloorPlanViewer.prototype.PATH_PREFIX = PATH_PREFIX;

    const GET_FLOOR_PLAN = PATH_PREFIX + '/api/Floorplans/';
    const GET_ENTITY = PATH_PREFIX + '/api/Entities/';
    const GET_PHOTOS = PATH_PREFIX + '/api/Photos/'
    const GET_ANNOTATION = PATH_PREFIX + '/api/Annotations/'

    // build first floorplan-viewer
    var shootTypeMetadata1 = {
        "Shoots": [
            {
                "Date": "2021-06-01",
                "PhotoCount": 38
            },
            {
                "Date": "2021-06-07",
                "PhotoCount": 38
            }
        ],
        "FloorplanImage": "https://mv.cf.multivista.com/64692/floorplans/probation-office-l1.gif",
        "FloorplanUID": "E41104ED-15BF-4422-A7ED-7B112423DD28",
        "FloorplanName": "Probation Office - Level 1",
        "Name": "Interior Progression Photos",
        "ID": "A55C3A28-8438-472B-9CBD-5483EC19ED90"
    }
    var floorPlanViewerContainer1 = $("#viewer-container-1");
    var floorPlanViewer1 = new FloorPlanViewer(floorPlanViewerContainer1);
    loadFloorplan(floorPlanViewer1, shootTypeMetadata1, "2021-06-07");

    var walls = [];

    $(floorPlanViewer1.dispatcherDOM).on('entitiespicked', function (e) {

        console.log('entitiespicked');

        // remove all walls from photo
        for (var i = 0; i < walls.length; i++) {
            photoViewer.removeLayout(walls[i]);
        }

        walls = [];

        // put walls to the photo
        if (photoViewer.currentMetadata != null) {

            var md = photoViewer.currentMetadata;
            var rz = (Math.PI * parseFloat(md.HotspotTheta)) / 180;
            walls = e.detail.entities;

            for (var entity of e.detail.entities) {

                // build wall multiPolygon 
                var mc = []; // [[[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]]

                turf.segmentEach(entity, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
                    var lc = currentSegment.geometry.coordinates;
                    var coords = [];
                    coords.push([lc[0][0], lc[0][1], photoViewer.floorH]);
                    coords.push([lc[1][0], lc[1][1], photoViewer.floorH]); // you need to set real elevation of the floor & ceiling
                    coords.push([lc[1][0], lc[1][1], photoViewer.ceilingH]);
                    coords.push([lc[0][0], lc[0][1], photoViewer.ceilingH]);
                    coords.push([lc[0][0], lc[0][1], photoViewer.floorH]); // close polygon
                    mc.push([coords]);
                });

                var f = JSON.parse(JSON.stringify(entity));
                f.geometry = turf.multiPolygon(mc).geometry;

                // use photo position as origin
                var photoPos = new THREE.Vector3(parseFloat(md.HotspotX), - parseFloat(md.HotspotY), 0);
                photoPos.applyMatrix4(floorPlanViewer1.getTransformationMatrix());

                turf.coordEach(f, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                    currentCoord[0] -= photoPos.x;
                    currentCoord[1] -= photoPos.y;
                }, false);

                // convert XYZ to pixels
                var size = photoViewer.getImageSize();

                turf.coordEach(f, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                    var uv_tmp = PSULIB.PANO.xyxToUv(currentCoord[0], currentCoord[1], currentCoord[2], rz);
                    currentCoord[0] = uv_tmp[0] * size.imageWidth;
                    currentCoord[1] = -uv_tmp[1] * size.imageHeight;
                    currentCoord[2] = 5;
                }, false);

                // draw wall feature
                photoViewer.addLayout(f, photoViewer.styleDefault);

            }
        }

    });

    $(floorPlanViewer1.dispatcherDOM).on('unselectall', function (e) {

        console.log('unselectall');

        // remove all walls from photo
        for (var i = 0; i < walls.length; i++) {
            photoViewer.removeLayout(walls[i]);
        }

        walls = [];

    });

    //$(floorPlanViewer1.dispatcherDOM).on('photospicked', function (e) {
    //    console.log('photospicked');
    //    console.log(e.detail);
    //});

    // build second floorplan viewer
    //var shootTypeMetadata2 = {
    //    "Shoots": [
    //        {
    //            "Date": "2021-02-22",
    //            "PhotoCount": 32
    //        },
    //        {
    //            "Date": "2021-03-02",
    //            "PhotoCount": 29
    //        }
    //    ],
    //    "FloorplanImage": "https://mv.cf.multivista.com/64692/floorplans/probation-office-l1.gif",
    //    "FloorplanUID": "B13313D7-325D-4840-91C1-27E35F6685FD",
    //    "FloorplanName": "Probation Office - Level 1",
    //    "Name": "MEP Exact-Built™ Photos",
    //    "ID": "248B8DF7-CAAA-4C3B-A4A7-1B10A54155D8"
    //}
    var floorPlanViewerContainer2 = $("#viewer-container-2");
    // var floorPlanViewer2 = new FloorPlanViewer(floorPlanViewerContainer2);
    // loadFloorplan(floorPlanViewer2, shootTypeMetadata2, "2021-02-22");

    var _floorplan2Info = null; 

    //var matcher = new FloorPlanMatcher(floorPlanViewer1, floorPlanViewer2); // call if need to start floorplans match

    //$(matcher.dispatcherDOM).on('transformationcalculated', function (event) { // will trigger when transform calculated

    //    var tm_adjustment = (new THREE.Matrix4()).fromArray(event.detail.tk);  
    //    var tm = floorPlanViewer2.getTransformationMatrix();
    //    tm.premultiply(tm_adjustment);

    //    // try to save updated value
    //    _floorplan2Info.transform = tm.toArray().join(';');

    //    $.ajax({
    //        url: GET_FLOOR_PLAN + shootTypeMetadata2.FloorplanUID,
    //        method: 'PUT',
    //        data: JSON.stringify(_floorplan2Info),
    //        contentType: 'application/json'
    //    })
    //    .done(
    //        function (data) {
    //            floorPlanViewer2.setTransformationMatrix(tm.toArray());
    //        }
    //    ).fail(
    //        function (error) {
    //            alert('Something wrong during saving...');
    //        }
    //    );

    //});

    var photoViewer = new PhotoViewer(floorPlanViewerContainer2);

    var layout3dProcessor = new Layout3dProcessor(photoViewer);

    $(layout3dProcessor.dispatcherDOM).on('layout3dchanged', function (e) {
        console.log('layout3dchanged', e.detail);
        visualizeFootprint(e.detail);
    });

    $(layout3dProcessor.dispatcherDOM).on('layout3dselected', function (e) {
        console.log('layout3dselected', e.detail);
        visualizeFootprint(e.detail);
    });

    $(layout3dProcessor.dispatcherDOM).on('layout3dunselected', function (e) {
        console.log('layout3dunselected', e.detail);
        visualizeFootprint(null);
    });

    function visualizeFootprint(detail) {
        if (detail) {
            var md = photoViewer.currentMetadata;
            var fp = Layout3dProcessor.prototype.layoutToFootpring(detail.uv, detail.ceilingH, - (Math.PI * parseFloat(md.HotspotTheta)) / 180);
            var photoPos = new THREE.Vector3(parseFloat(md.HotspotX), - parseFloat(md.HotspotY), 0);
            photoPos.applyMatrix4(floorPlanViewer1.getTransformationMatrix());

            // apply photo position offset
            turf.coordEach(fp, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                currentCoord[0] += photoPos.x;
                currentCoord[1] += photoPos.y;
                currentCoord[2] = 5;
            }, false);

            floorPlanViewer1.drawScratchGeometry(fp.geometry);
        } else {
            floorPlanViewer1.drawScratchGeometry(null);
        }
    }

    var photoCapturer = new VectorCapturer(photoViewer);

    $(photoCapturer.dispatcherDOM).on('featurecaptured', function (event) {

        PUtilities.prototype.invertY(event.detail.feature.geometry); // invert Y to keep raster coord system

        var obj = {
            Code: 64692,
            PhotoId: photoViewer.currentMetadata.ID,
            ClassName: 'NONE',
            Type: 0,
            Geometry: event.detail.feature.geometry,
        };

        $.ajax({
            url: GET_ANNOTATION,
            method: 'POST',
            data: JSON.stringify(obj),
            contentType: 'application/json'
        })
            .done(
                function (data) {
                    console.log(data);
                    PUtilities.prototype.invertY(data.geometry); // invert Y to keep raster coord system
                    photoViewer.addEntities([data], photoViewer.styleDefault);
                }
            ).fail(
                function (error) {
                    alert('Something wrong during annotations receiving...');
                }
            );

    });

    var photoModifier = new VectorModifier(photoViewer);

    var annotations = [];

    $(photoModifier.dispatcherDOM).on('entitiessetchanged', function (event) {
        annotations = event.detail.entities;
    });

    photoModifier.Start(15);

    var scaler = new FloorPlanScaler(floorPlanViewer1);

    var lengthMeasurer = new LengthMeasurer(floorPlanViewer1);

    $(scaler.dispatcherDOM).on('transformationcalculated', function (e) {

        var tm_adjustment = (new THREE.Matrix4()).fromArray(event.detail.tk);
        var tm = floorPlanViewer2.getTransformationMatrix();
        tm.premultiply(tm_adjustment);

        // try to save updated value
        _floorplan2Info.transform = tm.toArray().join(';');

        $.ajax({
            url: GET_FLOOR_PLAN + shootTypeMetadata2.FloorplanUID,
            method: 'PUT',
            data: JSON.stringify(_floorplan2Info),
            contentType: 'application/json'
        })
        .done(
            function (data) {

                floorPlanViewer2.setTransformationMatrix(tm.toArray());

            }
        ).fail(
            function (error) {
                alert('Something wrong during saving...');
            }
        );
    });

    //var floorPlanSync = new FloorPlanSync(floorPlanViewer1, floorPlanViewer2);
    //floorPlanSync.Start();

    var capruter = new VectorCapturer(floorPlanViewer1);
    $(capruter.dispatcherDOM).on('featurecaptured', function (event) {

        modifier.Start();

        var entity = {
            Name: "OFFICE 1C124 W",
            Geometry:  event.detail.feature.geometry,
            TypeId: 5,
            ParentId: 9,
            Code: 64692
        };

        $.ajax({
            url: GET_ENTITY,
            method: 'POST',
            data: JSON.stringify(entity),
            contentType: 'application/json'
        })
        .done(
            function (data) {
                floorPlanViewer1.addEntities([data]);
                roomFiller.Update([data]);
            }
        ).fail(
            function (error) {
                alert('Something wrong during saving...');
            }
        );


    });

    $(capruter.dispatcherDOM).on('capturingcanceled', function (event) {

        console.log('capturingcanceled');

    });

    var modifier = new VectorModifier(floorPlanViewer1);
    modifier.Start();

    var roomFiller = new FloorPlanRoomFiller(floorPlanViewer1);

    $(modifier.dispatcherDOM).on('entitiessetchanged', function (event) {

        if (event.detail.entities.length == 0) {
            snapper.Stop();
        } else {
            snapper.Start(0.5, Math.PI / 18);
        }

        // console.log(event.detail.entities);
    });

    $(modifier.dispatcherDOM).on('entitieschanged', function (event) {
        console.log('entitieschanged');
        console.log(event.detail.entities);
        roomFiller.Update(event.detail.entities);
    });

    $(modifier.dispatcherDOM).on('entitiesremoved', function (event) {
        console.log('entitiesremoved');
        console.log(event.detail.entities);
        roomFiller.Update(event.detail.entities);
    });

    $(floorPlanViewer1.dispatcherDOM).on('photospicked', function (event) {
        console.log('photospicked');
        console.log(event.detail.photos);

        if (photoViewer.currentMetadata != null) {
            floorPlanViewer1.setPhotosSelection([photoViewer.currentMetadata], false);
        }

        photoViewer.showPhoto(event.detail.photos[0]);
        floorPlanViewer1.setPhotosSelection(event.detail.photos, true);
    });

    var snapper = new VectorSnapper(floorPlanViewer1, capruter, modifier);

    // general
    function loadPhotos(viewer, metadata, date) {
        $.ajax({
            url: 'https://mds.multivista.com/index.cfm?fuseaction=aAPI.getPhotos&ShootTypeID=' + metadata.ID + '&Date=' + date,
            headers: {
                "Authorization": "Basic " + btoa('multiviewer@multivista.com' + ":" + 'Leica123*')
            }
        })
        .done(
            function (data) {
                viewer.removeAllPhotos();
                viewer.addPhotos(data);
            }
        ).fail(
            function (error) {
                alert('Oooppsss...');
            }
        );
    }

    function loadFloorplan(viewer, metadata, date) {
        $.ajax({
            url: GET_FLOOR_PLAN + metadata.ID,
        })
        .done(
            function (data) {

                if (date == "2021-02-22") {
                    _floorplan2Info = data; // hardcoded for viewer # 2!!!!
                }

                if (data.transform != null) {
                    viewer.showFloorPlan(metadata, data.transform.split(';'));
                } else {
                    viewer.showFloorPlan(metadata, null);
                }

                loadPhotos(viewer, metadata, date);
            }
        ).fail(
            function (error) {
                viewer.showFloorPlan(metadata, null);
                loadPhotos(viewer, metadata, date);
            }
        );
    }

    $('body').on('keydown', function (event) {

        event.preventDefault();

        switch (event.keyCode) {
            case 27:
                // ESC
                //capruter.Cancel();
                //snapper.Start();
                break;
            default:
                break;
        }

        return false;
    });

    $('#get-entity-type').click(function () {
        $.ajax({
            url: '/api/EntityTypes',
            method: 'GET'
        })
            .done(
                function (data) {
                    var t = 1;
                }
            ).fail(
                function (error) {
                    alert('Oooppsss...');
                }
            );
    });

    $('#post-entity-type').click(function () {
        var obj = { name: 'my first et' };
        $.ajax({
            url: '/api/EntityTypes',
            method: 'POST',
            data: JSON.stringify(obj),
            contentType: 'application/json'
        })
            .done(
                function (data) {
                    var t = 1;
                }
            ).fail(
                function (error) {
                    alert('Oooppsss...');
                }
            );
    });

    $('#post-entity').click(function () {
        var obj = { Name: 'my entity child...', TypeId: 1, ParentId: 3 };
        $.ajax({
            url: '/api/Entities',
            method: 'POST',
            data: JSON.stringify(obj),
            contentType: 'application/json'
        })
        .done(
            function (data) {
                var t = 1;
            }
        ).fail(
            function (error) {
                alert('Oooppsss...');
            }
        );
    });

    $('#start-adjustment').click(function () {
        matcher.Cancel();
        matcher.Start();
    });

    $('#start-scale').click(function (e) {

    });

    $('#start-linestring-capturing').click(function () {
        modifier.Stop();
        capruter.Cancel();
        capruter.Start(VectorCapturer.prototype.geometryType.lineString);
        snapper.Start(0.5, Math.PI / 36);
    });

    $('#start-polygon-capturing').click(function () {
        modifier.Stop();
        capruter.Cancel();
        capruter.Start(VectorCapturer.prototype.geometryType.polygon, VectorCapturer.prototype.rectangleTemplate);
        //capruter.Start(VectorCapturer.prototype.geometryType.polygon);
        snapper.Start(0.5, Math.PI / 18);
    });

    $('#dispose-viewer').click(function () {
        floorPlanViewer1.dispose();
    });

    $('#delete-entity').click(function (e) {
        floorPlanViewer1.removeEntities(entities);
    });

    $('#delete-all-photos').click(function (e) {
        floorPlanViewer1.removeAllPhotos();
    });

    $('#switch-photos').click(function (e) {
        loadPhotos(floorPlanViewer1, shootTypeMetadata1, "2021-06-01");
    });

    $('#modify-add').click(function (e) {
        modifier.Add(entities);
    });

    $('#modify-remove').click(function (e) {
        modifier.Remove(entities);
    });

    $('#show-layout3d').click(function (e) {

        if (photoViewer.currentMetadata == null || photos.length == 0) {
            alert('Can not show layout, something wrong...');
            return;
        }

        var f = photos.find(e => e.id == photoViewer.currentMetadata.ID);

        if (f == null || f.data == null) {
            alert('Photo does not have layout for visualization...');
            return;
        }

        f.type = 'Feature'; // turfable

        var layout = JSON.parse(f.data);
        var vertices = [];

        for (var i = 0; i < layout.uv.length; i += 2) {

            var p_ceiling = layout.uv[i];
            var p_floor = layout.uv[i + 1];

            if (p_ceiling[0] < 0.001) {
                continue; // skip noise
            }

            vertices.push([p_floor[0], p_floor[1], p_floor[1] - p_ceiling[1]]);
        }

        vertices.push(vertices[0]);
        f.geometry = turf.getGeom(turf.polygon([vertices]));
        layout3dProcessor.Start(f, parseFloat(layout.z1), parseFloat(layout.z0), true);

    });

    $('#hide-layout3d').click(function (e) {
        layout3dProcessor.Stop();
    });

    $('#show-filling').click(function (e) {
        roomFiller.Start();
    });

    $('#hide-filling').click(function (e) {
        roomFiller.Stop();
    });

    $('#start-measurment').click(function (e) {
        lengthMeasurer.Start();
    });

    $('#cleanup-measurment').click(function (e) {
        lengthMeasurer.Cleanup();
    });

    $('#get-annotations').click(function (e) {
        $.ajax({
            url: GET_ANNOTATION,
            data: { photoId: 182710604 }
        })
        .done(
            function (data) {
                console.log(data);
                if (photoViewer.currentMetadata) {

                    // drop Y to negative, because of raster orientation
                    for (var entity of data) {
                        PUtilities.prototype.invertY(entity.geometry);
                    }

                    photoViewer.addEntities(data, photoViewer.styleDefault);
                }
            }
        ).fail(
            function (error) {
                alert('Something wrong during annotations receiving...');
            }
        );
    });

    $('#add-annotation').click(function (e) {

        photoModifier.Stop();
        photoCapturer.Cancel();

        var res = prompt('0 - start polygon, 1 - start bbox:', '0');

        if (res == '1') {
            photoCapturer.Start(photoCapturer.geometryType.polygon, VectorCapturer.prototype.bboxTemplate);
        } else {
            photoCapturer.Start(photoCapturer.geometryType.polygon);
        }

    });

    $('#remove-annotations').click(function (e) {

        if (annotations.length) {
            photoViewer.removeEntities(annotations);
            annotations = [];
        } else {
            photoViewer.removeAllEntities();
        }

    });

    var annotationProcessor = new AnnotationClassificationProcessor(photoViewer, $('#tools-container'));
    var multiClassDetails = {
        "endpointName": "image-classification-2021-08-13-08-36-15-360",
        "type": "classification",
        "tiling": {
            "width": 256,
            "height": 256,
            "overlapX": 0,
            "overlapY": 0
        },
        "classes": [
            {
                "id": 0,
                "alias": "0.0.",
                "name": "No_class"
            },
            {
                "id": 1,
                "alias": "1.1.",
                "name": "Framing - steel studs"
            },
            {
                "id": 2,
                "alias": "1.2.",
                "name": "Framing - wood studs"
            },
            {
                "id": 3,
                "alias": "1.3.",
                "name": "Framing - CMU wall"
            },
            {
                "id": 4,
                "alias": "1.4.",
                "name": "Framing - Steel Blocking"
            },
            {
                "id": 5,
                "alias": "1.5.",
                "name": "Framing - Wood Blocking"
            },
            {
                "id": 6,
                "alias": "1.6.",
                "name": "Framing: Metal Ceiling framing"
            },
            {
                "id": 7,
                "alias": "2.1.",
                "name": "Drywall - green"
            },
            {
                "id": 8,
                "alias": "2.2.",
                "name": "Drywall - Purple"
            },
            {
                "id": 9,
                "alias": "2.3.",
                "name": "Drywall - Gray.White"
            },
            {
                "id": 10,
                "alias": "2.4.",
                "name": "Drywall - Yellow"
            },
            {
                "id": 11,
                "alias": "3.1.",
                "name": "Conduits black"
            },
            {
                "id": 12,
                "alias": "3.2.",
                "name": "Conduits - Yellow"
            },
            {
                "id": 13,
                "alias": "3.3.",
                "name": "Conduits - Blue"
            },
            {
                "id": 14,
                "alias": "3.4.",
                "name": "Conduits - Red"
            },
            {
                "id": 15,
                "alias": "3.5.",
                "name": "Conduits - Metal"
            },
            {
                "id": 16,
                "alias": "3.6.",
                "name": "Conduits - Metal Encased - Green"
            },
            {
                "id": 17,
                "alias": "3.7.",
                "name": "Conduits - Metal Encased - Metal"
            },
            {
                "id": 18,
                "alias": "3.8.",
                "name": "Wiring - White"
            },
            {
                "id": 19,
                "alias": "3.9.",
                "name": "Wiring - Yellow"
            },
            {
                "id": 20,
                "alias": "3.10.",
                "name": "Wiring - Gray"
            },
            {
                "id": 21,
                "alias": "3.11.",
                "name": "Wiring - Orange"
            },
            {
                "id": 22,
                "alias": "3.12.",
                "name": "Wiring - Black"
            },
            {
                "id": 23,
                "alias": "3.13.",
                "name": "Wiring - Blue - Ethernet Cable"
            },
            {
                "id": 24,
                "alias": "3.14.",
                "name": "Electrical – White Electrical Conduit"
            },
            {
                "id": 25,
                "alias": "3.15.",
                "name": "Conduits - Grey"
            },
            {
                "id": 26,
                "alias": "3.16.",
                "name": "Conduits - Green"
            },
            {
                "id": 27,
                "alias": "3.17.",
                "name": "Conduits - White"
            },
            {
                "id": 28,
                "alias": "3.18.",
                "name": "Conduits - Purple"
            },
            {
                "id": 29,
                "alias": "3.19.",
                "name": "Wiring - Red"
            },
            {
                "id": 30,
                "alias": "3.20.",
                "name": "Wiring - Blue"
            },
            {
                "id": 31,
                "alias": "3.21.",
                "name": "Wiring - Green"
            },
            {
                "id": 32,
                "alias": "3.22.",
                "name": "Conduits - Orange"
            },
            {
                "id": 33,
                "alias": "3.23.",
                "name": "Conduits - Cyan"
            },
            {
                "id": 34,
                "alias": "3.24.",
                "name": "Wiring - Brown"
            },
            {
                "id": 35,
                "alias": "4.1.",
                "name": "Plumbing Pipe Copper"
            },
            {
                "id": 36,
                "alias": "4.2.",
                "name": "Plumbing Pipe - white PVC"
            },
            {
                "id": 37,
                "alias": "4.3.",
                "name": "Plumbing pipe - black"
            },
            {
                "id": 38,
                "alias": "4.4.",
                "name": "Plumbing pipe - Blue plastic Pex tubing"
            },
            {
                "id": 39,
                "alias": "4.5.",
                "name": "Plumbing pipe - Red plastic Pex tubing"
            },
            {
                "id": 40,
                "alias": "4.6.",
                "name": "Plumbing pipe - Clear plastic Pex tubing"
            },
            {
                "id": 41,
                "alias": "4.7.",
                "name": "Plumbing pipe - Insulation Pex tubing"
            },
            {
                "id": 42,
                "alias": "4.8.",
                "name": "Plumbing - Black Tube – Plumbing Sanitary Line"
            },
            {
                "id": 43,
                "alias": "4.9.",
                "name": "Plumbing Pipe - Grey PVC"
            },
            {
                "id": 44,
                "alias": "4.10.",
                "name": "Plumbing: White PEX Tubing"
            },
            {
                "id": 45,
                "alias": "4.11.",
                "name": "Plumbing: Blue PEX Tubing"
            },
            {
                "id": 46,
                "alias": "4.12.",
                "name": "Plumbing pipe - Copper pipe Insulation"
            },
            {
                "id": 47,
                "alias": "4.13.",
                "name": "Plumbing - Copper Pex Tubing"
            },
            {
                "id": 48,
                "alias": "4.14.",
                "name": "Plumbing - Black cast iron pipe"
            },
            {
                "id": 49,
                "alias": "4.15.",
                "name": "Plumbing: Red PEX Tubing"
            },
            {
                "id": 50,
                "alias": "5.1.",
                "name": "Celing - Square Ductwork"
            },
            {
                "id": 51,
                "alias": "5.2.",
                "name": "Celing - Round Ductwork"
            },
            {
                "id": 52,
                "alias": "5.3.",
                "name": "Mechanical - Clothes Dryer Vent line"
            }
        ]
    };

    //{
    //    '1.1.': {
    //        'displayName': '1.1. Framing - steel studs',
    //        'description': 'Framing - steel studs'
    //    },
    //    '1.2.': {
    //        'displayName': '1.2. Framing - wood studs',
    //        'description': 'Framing - wood studs'
    //    },
    //    '1.3.': {
    //        'displayName': '1.3. Framing - CMU wall',
    //        'description': 'Framing - CMU wall'
    //    }
    //}

    $('#multi-class-start').click(function (e) {
        annotationProcessor.Start(multiClassDetails);
    });

    $(annotationProcessor.dispatcherDOM).on('multiclassmode', (e) => {
        // stop manual selection of the annotations
        photoModifier.Stop();
    });

    $(annotationProcessor.dispatcherDOM).on('multiclasschanged', (e) => {
        const a = JSON.parse(JSON.stringify(event.detail.annotation));
        PUtilities.prototype.invertY(a.geometry); // invert Y to keep raster coord system

        $.ajax({
            url: GET_ANNOTATION + a.id,
            method: 'PUT',
            data: JSON.stringify(a),
            contentType: 'application/json'
        })
            .done(
                function (data) {
                    console.log(data);
                }
            ).fail(
                function (error) {
                    alert('Something wrong during annotation updating!!!');
                }
            );
    });

    var entities = [];

    $.ajax({
        url: GET_ENTITY,
        data: { TypeId: 5 }
    })
    .done(
        function (data) {
            entities = data;
            floorPlanViewer1.addEntities(entities);
        }
    ).fail(
        function (error) {
            alert('Something wrong entities receiving...');
        }
    );

    var photos = [];

    $.ajax({
        url: GET_PHOTOS
    })
    .done(
        function (data) {
            photos = data;
        }
    ).fail(
        function (error) {
            alert('Something wrong during photos receiving...');
        }
    );

});