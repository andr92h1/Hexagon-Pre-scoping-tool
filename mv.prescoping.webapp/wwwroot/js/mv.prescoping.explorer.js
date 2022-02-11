
$(document).ready(function () {
    const POSITION_TOLERANCY = 0.5;
    const ENTITIES_URL = PATH_PREFIX + 'api/Entities';
    const STAGES_URL = PATH_PREFIX + 'api/Stages';
    const STAGE_TYPES_URL = PATH_PREFIX + 'api/StageTypes';
    const FLOORPLANS_URL = PATH_PREFIX + 'api/Floorplans';
    const PHOTOS_URL = PATH_PREFIX + 'api/Photos';
    const ANNOTATIONS_URL = PATH_PREFIX + 'api/Annotations';
    const JQX_THEME = 'material';
    const NONE_STAGE_TYPE_NAME = 'FOR ALL';
    const CAPTURER_TEMPLATE = {
        'NONE': 1,
        'RECT': 2
    }

    FloorPlanViewer.prototype.PATH_PREFIX = PATH_PREFIX;

    var NOTIFICATION_TYPE = {
        INFO: 'info',
        WARNING: 'warning',
        SUCCESS: 'success',
        ERROR: 'error',
        MAIL: 'mail',
        TIME: 'time'
    };

    var mainViewer = null;
    var mainViewerModifier = null;
    var vectorCapturer = null;
    var vectorSnapper = null;
    var roomFiller = null;
    var photoViewer = null;
    var layout3dProcessor = null;
    var lengthMeasurer = null;
    var predictionProcessor = null;
    var availableProjects = [];
    var availableStageTypes = [];
    var selectedProject = null;
    var selectedProjectEntities = [];

    var isViewerForceUpdate = false;

    var selectedFloor = null;
    var selectedFloorPhotos = null;
    var loadedShootTypes = [];

    var curPhotoAnnotations = [];
    var curPhotoLayoutItems = [];

    var layoutValidationQueue = [];

    $('#navbar-notifications-popover').jqxPopover({ selector: $('#navbar-notifications'), theme: JQX_THEME });
    $('#navbar-notifications-content').show();

    var layout = [{
        type: 'layoutGroup',
        orientation: 'horizontal',
        items: [
            {
                type: 'tabbedGroup',
                width: '80%',
                minWidth: 400,
                allowPin: false,
                allowUnpin: false,
                items: [{
                    type: 'layoutPanel',
                    title: 'Viewer',
                    contentContainer: 'ViewerPanel'
                }]
            }, {
                type: 'tabbedGroup',
                width: '20%',
                minWidth: 300,
                allowPin: false,
                allowUnpin: false,
                items: [
                    {
                        type: 'layoutPanel',
                        title: 'Project explorer',
                        contentContainer: 'ProjectExplorerPanel'
                    },
                    {
                        type: 'layoutPanel',
                        title: 'Prediction explorer',
                        contentContainer: 'PredictionExplorerPanel'
                    }
                ]
            }
        ]
    }];

    $('body').on('keydown', function (e) {
        switch (e.keyCode) {
            case 27:
                if (mainViewer && lengthMeasurer) {
                    lengthMeasurer.Cleanup();
                }

                break;
            case 65:
                if (e.altKey && mainViewer) {
                    adjustLayout();
                }

                break;
            case 77:
                if (e.altKey && mainViewer) {
                    if (lengthMeasurer == null) {
                        lengthMeasurer = new LengthMeasurer(mainViewer);
                    }

                    lengthMeasurer.Start();
                }

                break;
            case 80:
                if (e.altKey) {
                    if (selectedFloorPhotos != null && selectedFloorPhotos.length > 0) {
                        //showInitPredictionWindow();
                    }
                }

                break;
            case 83:
                if (e.altKey && curPhotoAnnotations.length > 0) {
                    showAnnotationsFilterWindow();
                }

                break;
        }
    });

    $('#notificationWindow').jqxNotification({
        width: 300,
        position: 'bottom-right',
        opacity: 0.9,
        autoOpen: false,
        autoClose: true,
        animationOpenDelay: 800,
        autoCloseDelay: 3000,
        theme: JQX_THEME
    });

    $('#mainLayout').on('create', function () {
        mainViewer = new FloorPlanViewer($('#viewerContainer'));

        //$(mainViewer.dispatcherDOM).on('entitiespicked', function (e) {
        //    onVectorFeaturesSelected(e.detail.entities);
        //});

        $(mainViewer.dispatcherDOM).on('unselectall', function (e) {
            //console.log('unselectall');
        });
    });

    $('#mainLayout').jqxLayout({
        width: '100%',
        height: '100%',
        layout: layout,
        theme: JQX_THEME
    });

    $('#projectsDropDown').jqxDropDownList({
        source: [],
        width: '95%',
        height: 30,
        displayMember: 'name',
        valueMember: 'code',
        autoDropDownHeight: true,
        disabled: true,
        theme: JQX_THEME,
        renderer: function (index, label, value) {
            return '<div><div style="font-weight:bold">' + label + '</div><div style="padding-left:10px">' + value + '</div></div>';
        }
    });

    $('#projectsDropDown').on('change', function (event) {
        if (event.args) {
            var item = event.args.item;
            var value = item.value;

            if (value == 'Create new project') {
                showAddProjectWindow();
            } else {
                $('#projectExplorerLoadingAnimation').show();
                $('#projectExplorerTree').jqxTree('clear');

                cleanSelectedEntityDetails();

                if (mainViewerModifier) {
                    mainViewerModifier.Dispose();
                    mainViewerModifier = null;
                }

                if (layout3dProcessor != null) {
                    layout3dProcessor.Dispose();
                    layout3dProcessor = null;
                }

                if (photoViewer != null) {
                    disposePhotoViewer();
                }

                if (vectorSnapper != null) {
                    vectorSnapper.Dispose();
                    vectorSnapper = null;
                }

                if (vectorCapturer != null) {
                    vectorCapturer.Dispose();
                    vectorCapturer = null;
                }

                if (lengthMeasurer != null) {
                    lengthMeasurer.Dispose();
                    lengthMeasurer = null;
                }

                if (mainViewer != null) {
                    mainViewer.dispose();
                    mainViewer = null;
                }

                mainViewer = new FloorPlanViewer($('#viewerContainer'));

                vectorCapturer = new VectorCapturer(mainViewer);

                vectorSnapper = new VectorSnapper(mainViewer, vectorCapturer);
                vectorSnapper.Start(POSITION_TOLERANCY, Math.PI / 36);

                $(mainViewer.dispatcherDOM).on('photospicked', function (event) {
                    if (photoViewer) {
                        if (photoViewer.currentMetadata != null) {
                            mainViewer.setPhotosSelection([photoViewer.currentMetadata], false);
                        }

                        photoViewer.showPhoto(event.detail.photos[0]);
                        mainViewer.setPhotosSelection(event.detail.photos, true);

                        clearReprojectedLayout();

                        loadLayout(event.detail.photos[0].PhotoID);
                        loadAnnotations(event.detail.photos[0].PhotoID);
                    }
                });

                mainViewerModifier = new VectorModifier(mainViewer);
                mainViewerModifier.Start();

                $(mainViewerModifier.dispatcherDOM).on('entitiessetchanged', function (e) {
                    onVectorFeaturesSelected(e.detail.isUserAction, e.detail.entities);
                });

                $(mainViewerModifier.dispatcherDOM).on('entitieschanged', function (event) {
                    onVectorFeaturesModified(event.detail.entities);

                    if (roomFiller != null) {
                        roomFiller.Update(event.detail.entities);
                    }
                });

                $(mainViewerModifier.dispatcherDOM).on('entitiesremoved', function (event) {
                    onVectorFeatureRemoved(event.detail.entities);

                    if (roomFiller != null) {
                        roomFiller.Update(event.detail.entities);
                    }
                });

                selectedProject = null;
                selectedProjectEntities = [];
                selectedFloor = null;
                selectedFloorPhotos = null;
                loadedShootTypes = [];

                curPhotoAnnotations = [];

                layoutValidationQueue = [];

                selectedProject = availableProjects.find(function (e) { return e.code == value });
                if (selectedProject != null) {
                    $.ajax({
                        url: 'https://mds.multivista.com/index.cfm?fuseaction=aAPI.getShootTypes&ProjectUID=' + selectedProject.details,
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader("Authorization", "Basic " + btoa('multiviewer@multivista.com:Leica123*'));
                        }
                    }).done(function (data) {
                        if (data.success == true && data.data && data.data.length > 0) {
                            showNotification('Shoot types loaded successfully', NOTIFICATION_TYPE.SUCCESS);

                            loadedShootTypes = data.data.filter(function (e) { return e.FloorplanImageURL != '' && e.Name != '' });;

                            // get project entities
                            $.ajax({
                                url: ENTITIES_URL,
                                data: { 'code': selectedProject.code }
                            }).done(function (data) {
                                showNotification('Project data loaded successfully', NOTIFICATION_TYPE.SUCCESS);

                                selectedProjectEntities = data;
                                buildProjectTree();
                            }).fail(function (error) {
                                showNotification('Unable to get projects items', NOTIFICATION_TYPE.ERROR);
                            });

                            // get layouts for validation
                            $.ajax({
                                url: PHOTOS_URL,
                                data: { 'code': selectedProject.code, 'status': 'Layout extracted' }
                            }).done(function (data) {
                                layoutValidationQueue = data;

                                $('#navbar-notifications-content').empty();
                                $('#navbar-notifications-content').append('<ul id="navbar-notifications-list"></ul>');

                                var notificationItem = $('<li id="navbar-notifications-layout-validation">You have ' + data.length + ' layouts for validation</li>');

                                $('#navbar-notifications-content').find('ul').append(notificationItem);

                                notificationItem.on('click', function () {
                                    $('#navbar-notifications-popover').jqxPopover('close');
                                    showLayoutValidationWindow();
                                });

                                showNotification('Layout validation queue loaded successfully', NOTIFICATION_TYPE.SUCCESS);
                            }).fail(function (error) {
                                showNotification('Unable to get projects items', NOTIFICATION_TYPE.ERROR);
                            });
                        } else {
                            alert('Unable to get shoot types');
                        }

                        $('#projectExplorerLoadingAnimation').hide();
                    }).fail(function (error) {
                        showNotification('Unable to load shoot types list', NOTIFICATION_TYPE.ERROR);
                        $('#projectExplorerLoadingAnimation').hide();
                    });
                }
            }
        }
    });

    $('#predictionDropDown').jqxDropDownList({
        source: [],
        width: '95%',
        height: 30,
        autoDropDownHeight: true,
        disabled: true,
        theme: JQX_THEME
    });

    $('#predictionDropDown').on('change', function (event) {
        if (event.args) {
            var item = event.args.item;
            var value = item.value;
            var stageType = availableStageTypes.find((s) => { return s.name == value });

            if (!photoViewer) {
                showNotification('You should have any photo on the screen to strat modification of the predictions', NOTIFICATION_TYPE.ERROR);
                return;
            }

            if (predictionProcessor != null) {
                predictionProcessor.Dispose && predictionProcessor.Dispose();
                predictionProcessor = null;
            }

            if (stageType) {
                var stageDetails = stageType.details ? JSON.parse(stageType.details) : null;

                if (stageDetails) {
                    if (stageDetails.type == PUtilities.prototype.PREDICTION_TYPES.CLASSIFICATION) {
                        predictionProcessor = new AnnotationClassificationProcessor(photoViewer, $('#predictionExplorerContainer'));

                        $(predictionProcessor.dispatcherDOM).on('multiclasschanged', function (event) {
                            const a = JSON.parse(JSON.stringify(event.detail.annotation));
                            PUtilities.prototype.invertY(a.geometry); // invert Y to keep raster coord system

                            $.ajax({
                                url: ANNOTATIONS_URL + '/' + a.id,
                                method: 'PUT',
                                data: JSON.stringify(a),
                                contentType: 'application/json'
                            })
                                .done(
                                    function (data) {
                                        showNotification('Annotation update successfully', NOTIFICATION_TYPE.SUCCESS);
                                    }
                                ).fail(
                                    function (error) {
                                        showNotification('Error during annotation update', NOTIFICATION_TYPE.ERROR);
                                    }
                                );
                        });

                        predictionProcessor.Start(stageDetails);
                    } else {
                        showNotification('There is no engine for the prediction type: ' + stageDetails.type, NOTIFICATION_TYPE.ERROR);
                    }
                }
            } else {
                predictionProcessor = new AnnotationGeneralProcessor(photoViewer, $('#predictionExplorerContainer'));
                predictionProcessor.Start();
            }
        }
    });

    $('#projectExplorerLoadingAnimation').parent().css('overflow-y', 'scroll');

    resetSplitter();

    function resetSplitter() {
        $('#viewerSplitter').jqxSplitter('expand');
        $('#viewerSplitter').jqxSplitter({
            width: '100%',
            height: '100%',
            showSplitBar: false,
            panels: [{ size: 500 }, { collapsed: true }]
        });
    }

    function loadProjects() {
        $.ajax({
            url: ENTITIES_URL,
            data: { typeId: 1 }
        }).done(function (data) {
            showNotification('Projects list loaded successfully', NOTIFICATION_TYPE.SUCCESS);

            var source = [{ name: 'New...', code: 'Create new project' }];

            for (var porject of data) {
                source.push({ name: porject.name, code: porject.code });
            }

            $('#projectsDropDown').jqxDropDownList('source', source);
            $('#projectsDropDown').jqxDropDownList('disabled', false);

            availableProjects = data;
        }).fail(function (error) {
            showNotification('Unable to load projects list', NOTIFICATION_TYPE.ERROR);
        });
    }

    function loadStageTypes() {
        getAvailableStageTypes(
            function (data) {
                showNotification('Stage types list loaded successfully', NOTIFICATION_TYPE.SUCCESS);

                var source = [NONE_STAGE_TYPE_NAME];
                var filteredTypes = [];

                for (var stageType of data) {
                    if (stageType.isActive == true) {
                        source.push(stageType.name);
                        filteredTypes.push(stageType);
                    }

                }

                $('#predictionDropDown').jqxDropDownList('source', source);
                $('#predictionDropDown').jqxDropDownList('disabled', false);

                availableStageTypes = filteredTypes;
            },
            function (error) {
                showNotification('Unable to load stage types list', NOTIFICATION_TYPE.ERROR);
            }
        );
    }

    function buildProjectTree() {
        $('#projectExplorerTree').show();

        var filteredData = selectedProjectEntities.filter(function (e) { return e.parentId != null });

        var source =
        {
            datatype: 'json',
            datafields: [
                { name: 'id' },
                { name: 'parentId' },
                { name: 'code' },
                { name: 'name' },
                { name: 'typeId' }
            ],
            id: 'id',
            localdata: filteredData
        };

        var dataAdapter = new $.jqx.dataAdapter(source);

        dataAdapter.dataBind();

        var records = dataAdapter.getRecordsHierarchy('id', 'parentId', 'items', [{ name: 'name', map: 'label' }]);
        $('#projectExplorerTree').jqxTree({ source: records, width: '95%', height: '100%', theme: JQX_THEME });
        $('#projectExplorerTree').jqxTree('selectItem', null);
        $('#projectExplorerTree').on('select', function (event) {
            var args = event.args;
            var item = $('#projectExplorerTree').jqxTree('getItem', args.element);
            loadStages(item.id);

            mainViewerModifier.RemoveAll();
            reprojectVectorToImage([]);

            var projectEntity = selectedProjectEntities.find(function (e) { return e.id == item.id });

            if (projectEntity != null && projectEntity.typeId > 2) {
                var floorObject;

                switch (projectEntity.typeId) {
                    case 3:
                        floorObject = projectEntity;
                        break;
                    case 4:
                        var roomWalls = selectedProjectEntities.filter(function (e) { return e.parentId == projectEntity.id && e.typeId == 5 });
                        mainViewerModifier.Add(roomWalls);
                        reprojectVectorToImage(roomWalls);

                        var roomFloor = selectedProjectEntities.find(function (e) { return e.parentId == projectEntity.id && e.typeId == 6 });

                        if (roomFloor != null) {
                            reprojectFloorCeilingToImage(roomFloor, true, false);
                        }

                        var roomCeiling = selectedProjectEntities.find(function (e) { return e.parentId == projectEntity.id && e.typeId == 7 });

                        if (roomCeiling != null) {
                            reprojectFloorCeilingToImage(roomCeiling, false, false);
                        }

                        floorObject = selectedProjectEntities.find(function (e) { return e.id == projectEntity.parentId });
                        break;
                    case 5:
                        mainViewerModifier.Add([projectEntity]);
                        reprojectVectorToImage([projectEntity]);
                        var room = selectedProjectEntities.find(function (e) { return e.id == projectEntity.parentId });
                        floorObject = selectedProjectEntities.find(function (e) { return e.id == room.parentId });
                        break;
                    case 6:
                    case 7:
                        var room = selectedProjectEntities.find(function (e) { return e.id == projectEntity.parentId });
                        var roomWalls = selectedProjectEntities.filter(function (e) { return e.parentId == room.id && e.typeId == 5 });

                        if (roomWalls.length > 0) {
                            var poly = PUtilities.prototype.polygonize(roomWalls, 0.001);

                            if (poly != null) {
                                mainViewerModifier.Add(roomWalls);
                                reprojectFloorCeilingToImage(projectEntity, projectEntity.typeId == 6, true);

                                floorObject = selectedProjectEntities.find(function (e) { return e.id == room.parentId });
                            }
                        }

                        break;
                }

                if (isViewerForceUpdate === true || (floorObject && selectedFloor != floorObject)) {
                    isViewerForceUpdate = false;
                    selectedFloor = floorObject;
                    disposePhotoViewer();
                    initFloorplanViewer();
                }
            }
        });

        var contextMenu = $('#contextMenu').jqxMenu({ width: '120px', autoOpenPopup: false, mode: 'popup', theme: JQX_THEME });

        $('#projectExplorerTree').on('mousedown', function (event) {
            if (isRightClick(event)) {

                contextMenu.jqxMenu('close');

                $('#contextMenuItemAddBuilding').hide();
                $('#contextMenuItemAddFloor').hide();
                $('#contextMenuItemAddFloorplan').hide();
                $('#contextMenuItemAddRoom').hide();
                $('#contextMenuItemAddWall').hide();
                $('#contextMenuItemAddWallRect').hide();

                var menuNotEmpty = false;
                var target = $(event.target).parents('li:first')[0];

                if (target) {
                    $('#projectExplorerTree').jqxTree('selectItem', target);
                    var itemClicked = $('#projectExplorerTree').jqxTree('getItem', target);
                    var entityClicked = selectedProjectEntities.find(function (e) { return e.id == itemClicked.id });

                    if (entityClicked != null) {
                        switch (entityClicked.typeId) {
                            case 2:
                                $('#contextMenuItemAddFloor').show();
                                menuNotEmpty = true;
                                break;
                            case 3:
                                $('#contextMenuItemAddFloorplan').show();
                                $('#contextMenuItemAddRoom').show();
                                menuNotEmpty = true;
                                break;
                            case 4:
                                $('#contextMenuItemAddWall').show();
                                $('#contextMenuItemAddWallRect').show();
                                menuNotEmpty = true;
                                break;
                            case 5:
                                $('#contextMenuItemAddWall').show();
                                $('#contextMenuItemAddWallRect').show();
                                menuNotEmpty = true;
                                break;
                        }
                    }
                } else {
                    $('#contextMenuItemAddBuilding').show();
                    menuNotEmpty = true;
                }

                if (menuNotEmpty) {
                    var scrollTop = $(window).scrollTop();
                    var scrollLeft = $(window).scrollLeft();
                    contextMenu.jqxMenu('open', parseInt(event.clientX) + 5 + scrollLeft, parseInt(event.clientY) + 5 + scrollTop);
                }

                return false;
            }
        });

        $('#contextMenu').on('itemclick', function (event) {
            var item = $.trim($(event.args).text());

            if (item == 'Add building') {
                showAddBuildingWindow();
            } else {
                var selectedTreeItem = $('#projectExplorerTree').jqxTree('getSelectedItem');
                if (selectedTreeItem != null) {
                    var selectedProjectItem = selectedProjectEntities.find(function (e) { return e.id == selectedTreeItem.id });

                    if (selectedProjectItem != null) {
                        switch (item) {
                            case 'Add floorplan':
                                showAddFloorplanWindow(selectedProjectItem);
                                break;
                            case 'Add floor':
                                if (selectedProjectItem.typeId == 2) {
                                    showAddFloorWindow(selectedProjectItem);
                                }
                                break;
                            case 'Add room':
                                if (selectedProjectItem.typeId == 3) {
                                    showAddRoomWindow(selectedProjectItem);
                                }
                                break;
                            case 'Add wall':
                                if (selectedProjectItem.typeId == 4) {
                                    initWallCapturer(selectedProjectItem, CAPTURER_TEMPLATE.NONE);
                                }
                                break;
                            case 'Add wall (rectangular)':
                                if (selectedProjectItem.typeId == 4) {
                                    initWallCapturer(selectedProjectItem, CAPTURER_TEMPLATE.RECT);
                                }
                                break;
                            case 'Delete':
                                if (confirm('Are you shure you want to delete ' + selectedProjectItem.name + '?')) {
                                    deleteEntity(
                                        selectedProjectItem.id,
                                        function () {
                                            var itemIndex = selectedProjectEntities.indexOf(selectedProjectItem);

                                            if (itemIndex != -1) {
                                                selectedProjectEntities.splice(itemIndex, 1);
                                            }

                                            var viewerItemsToRemove = [];

                                            var getChildProjectItems = function (parentId) {
                                                return selectedProjectEntities.filter(function (e) { return e.parentId == parentId });
                                            }

                                            switch (selectedProjectItem.typeId) {
                                                case 1:
                                                    for (var building of getChildProjectItems(selectedProjectItem.id)) {
                                                        for (var floor of getChildProjectItems(building.id)) {
                                                            for (var room of getChildProjectItems(floor.id)) {
                                                                viewerItemsToRemove = viewerItemsToRemove.concat(getChildProjectItems(room.id));
                                                            }
                                                        }
                                                    }
                                                    break;
                                                case 2:
                                                    for (var floor of getChildProjectItems(selectedProjectItem.id)) {
                                                        for (var room of getChildProjectItems(floor.id)) {
                                                            viewerItemsToRemove = viewerItemsToRemove.concat(getChildProjectItems(room.id));
                                                        }
                                                    }

                                                    break;
                                                case 3:
                                                    for (var room of getChildProjectItems(selectedProjectItem.id)) {
                                                        viewerItemsToRemove = viewerItemsToRemove.concat(getChildProjectItems(room.id));
                                                    }
                                                    break;
                                                case 4:
                                                    viewerItemsToRemove = getChildProjectItems(selectedProjectItem.id);
                                                    break;
                                                case 5:
                                                    viewerItemsToRemove = [selectedProjectItem];
                                                    break;
                                            }

                                            if (viewerItemsToRemove.length > 0) {
                                                for (var item of viewerItemsToRemove) {
                                                    var itemIndex = selectedProjectEntities.indexOf(item);

                                                    if (itemIndex != -1) {
                                                        selectedProjectEntities.splice(itemIndex, 1);
                                                    }
                                                }

                                                mainViewer.removeEntities(viewerItemsToRemove);

                                                if (roomFiller != null) {
                                                    roomFiller.Update(viewerItemsToRemove);
                                                }
                                            }

                                            $('#projectExplorerTree').jqxTree('removeItem', selectedTreeItem);

                                            cleanSelectedEntityDetails();

                                            showNotification('Project item(s) deleted successfully', NOTIFICATION_TYPE.SUCCESS);
                                        },
                                        function (error) {
                                            alert('Unable to delete project item');
                                        }
                                    );
                                }
                                break;
                        }
                    }
                }
            }
        });

        $(document).on('contextmenu', function (e) {
            if ($(e.target).attr('id') === 'projectExplorerTree' || $(e.target).parents('.jqx-tree').length > 0) {
                return false;
            }
            return true;
        });
    }

    function initFloorplanViewer() {
        $('#shootTypeSelector').off('change');
        $('#shootTypeSelector').jqxDropDownList('clear');

        $('#shootDateSelector').off('change');
        $('#shootDateSelector').jqxDropDownList('clear');

        mainViewer.cleanupAll();

        selectedFloorPhotos = null;

        loadAttachedFloorFloorplans(
            selectedFloor.id,
            function (data) {
                if (data.length > 0) {
                    showNotification('Floorplans loaded successfully', NOTIFICATION_TYPE.SUCCESS);

                    var defaultFloorplan = data.find(function (e) { return e.isMaster == true });

                    if (defaultFloorplan == null) {
                        defaultFloorplan = data[0];
                    }

                    if (defaultFloorplan != null) {
                        //$('#shootTypeSelector').off('change');
                        //$('#shootTypeSelector').jqxDropDownList('clear');

                        var source =
                        {
                            datatype: 'json',
                            datafields: [
                                { name: 'name' },
                                { name: 'id' }
                            ],
                            localdata: data
                        };
                        var dataAdapter = new $.jqx.dataAdapter(source);

                        $('#shootTypeSelector').show();
                        $('#shootTypeSelector').jqxDropDownList({
                            source: dataAdapter,
                            displayMember: 'name',
                            valueMember: 'id',
                            width: 250,
                            height: 30
                        });

                        if (data.length < 10) {
                            $('#shootTypeSelector').jqxDropDownList('autoDropDownHeight', true);
                        } else {
                            $('#shootTypeSelector').jqxDropDownList('autoDropDownHeight', false);
                        }

                        $('#shootTypeSelector').on('change', function (event) {
                            //$('#shootDateSelector').off('change');
                            //$('#shootDateSelector').jqxDropDownList('clear');

                            if (event.args) {
                                var item = event.args.item;
                                var value = item.value;

                                var selectedFloorplan = data.find(function (e) { return e.id == value });
                                var metadata = loadedShootTypes.find(function (e) { return e.ShootTypeUID == value });

                                if (selectedFloorplan.transform != null) {
                                    mainViewer.showFloorPlan(metadata, selectedFloorplan.transform.split(';'));
                                } else {
                                    mainViewer.showFloorPlan(metadata, null);
                                }

                                var rooms = selectedProjectEntities.filter(function (e) { return e.typeId == 4 && e.parentId == selectedFloor.id });
                                var walls = [];

                                if (rooms.length) {
                                    for (var room of rooms) {
                                        var curRoomWalls = selectedProjectEntities.filter(function (e) { return e.parentId == room.id && e.typeId == 5 });
                                        walls = walls.concat(curRoomWalls);
                                    }
                                }

                                if (walls.length > 0) {
                                    mainViewer.addEntities(walls);

                                    roomFiller = new FloorPlanRoomFiller(mainViewer);
                                    roomFiller.Start();
                                }

                                var source =
                                {
                                    datatype: 'json',
                                    datafields: [
                                        { name: 'Date' }
                                    ],
                                    localdata: metadata.Shoots
                                };
                                var dataAdapter = new $.jqx.dataAdapter(source);

                                $('#shootDateSelector').show();
                                $('#shootDateSelector').jqxDropDownList({
                                    source: dataAdapter,
                                    displayMember: 'Date',
                                    valueMember: 'Date',
                                    width: 250,
                                    height: 30
                                });

                                if (metadata.Shoots.length < 10) {
                                    $('#shootDateSelector').jqxDropDownList('autoDropDownHeight', true);
                                } else {
                                    $('#shootDateSelector').jqxDropDownList('autoDropDownHeight', false);
                                }

                                $('#shootDateSelector').on('change', function (event) {
                                    if (event.args) {
                                        var item = event.args.item;
                                        var value = item.value;

                                        loadPhotos(metadata, value);
                                        initPhotoViewer();
                                    }
                                });
                            }
                        });

                        $('#shootTypeSelector').jqxDropDownList('selectedIndex', data.indexOf(defaultFloorplan));
                    } else {
                        showNotification('Error loading default floorplan', NOTIFICATION_TYPE.ERROR);
                    }
                } else {
                    $('#shootTypeSelector').hide();
                    $('#shootDateSelector').hide();
                }
            },
            function (error) {
                showNotification('Unable to load floorplans', NOTIFICATION_TYPE.ERROR);
            }
        );
    }

    function loadStages(entityId) {
        $.ajax({
            url: STAGES_URL,
            data: { entityId: entityId }
        }).done(function (data) {
            if ($('#projectExplorerStages').length == 0) {
                $('<div id="projectExplorerStages"></div>').insertAfter('#projectExplorerTree');
            }

            if ($('#projectExplorerStageDetails').length != 0) {
                $('#projectExplorerStageDetails').remove();
            }

            var source =
            {
                datatype: 'json',
                datafields: [
                    { name: 'code', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'details', type: 'int' },
                    { name: 'entityId', type: 'string' },
                    { name: 'isPlanned', type: 'string' },
                    { name: 'validFrom', type: 'string' },
                    { name: 'validTo', type: 'string' },
                    { name: 'timestamp', type: 'string' },
                    { name: 'typeId', type: 'string' },
                    { name: 'value', type: 'string' },
                    { name: 'id', type: 'string' }
                ],
                id: 'id',
                localdata: data
            };

            var dataAdapter = new $.jqx.dataAdapter(source);

            var dateCellRenderer = function (row, columnfield, value, defaulthtml, columnproperties, rowdata) {
                var cellContent = $(defaulthtml);
                cellContent.text(value.split('T')[0])
                return cellContent.prop('outerHTML');
            }

            $('#projectExplorerStages').jqxGrid(
                {
                    width: '95%',
                    source: dataAdapter,
                    columnsresize: true,
                    autoheight: true,
                    columns: [
                        //{ text: 'code', datafield: 'code' },
                        //{ text: 'details', datafield: 'details' }, // hide, will be rendered bellow
                        //{ text: 'Entity ID', datafield: 'entityId' }, // hide
                        {
                            text: 'Source', datafield: 'isPlanned', cellsrenderer: function (row, columnfield, value, defaulthtml, columnproperties, rowdata) {
                                var cellContent = $(defaulthtml);

                                if (value == true) {
                                    cellContent.text('Planned');
                                }
                                else {
                                    cellContent.text('Actual');
                                }

                                return cellContent.prop('outerHTML');
                            }
                        },
                        {
                            text: 'Type', datafield: 'typeId', cellsrenderer: function (row, columnfield, value, defaulthtml, columnproperties, rowdata) {
                                var stageType = availableStageTypes.find(function (e) { return e.id == value });

                                if (stageType == null) {
                                    return defaulthtml;
                                }

                                var cellContent = $(defaulthtml);
                                cellContent.text(stageType.name);

                                return cellContent.prop('outerHTML');
                            }
                        },
                        { text: 'Start', datafield: 'validFrom', cellsrenderer: dateCellRenderer },
                        { text: 'End', datafield: 'validTo', cellsrenderer: dateCellRenderer },
                        { text: 'Created', datafield: 'timestamp', cellsrenderer: dateCellRenderer },
                        { text: 'Description', datafield: 'description' },
                        { text: 'Value', datafield: 'value' },
                        //{ text: 'id', datafield: 'id' } //hide
                    ],
                    theme: JQX_THEME,
                    showToolbar: true,
                    toolbarHeight: 35,
                    renderToolbar: function (toolBar) {
                        var toTheme = function (className) {
                            if (JQX_THEME == "") return className;
                            return className + " " + className + "-" + JQX_THEME;
                        }
                        var container = $("<div style='overflow: hidden; position: relative; height: 100%; width: 100%;'></div>");
                        var buttonTemplate = "<div style='float: left; padding: 3px; margin: 2px;'><div style='margin: 4px; width: 16px; height: 16px;'></div></div>";
                        var addButton = $(buttonTemplate);
                        var deleteButton = $(buttonTemplate);
                        var qcButton = $(buttonTemplate);
                        container.append(addButton);
                        container.append(deleteButton);
                        container.append(qcButton);
                        toolBar.append(container);
                        addButton.jqxButton({ cursor: "pointer", enableDefault: false, height: 25, width: 25 });
                        addButton.find('div:first').addClass(toTheme('jqx-icon-plus'));
                        deleteButton.jqxButton({ cursor: "pointer", enableDefault: false, height: 25, width: 25 });
                        deleteButton.find('div:first').addClass(toTheme('jqx-icon-delete'));
                        qcButton.jqxButton({ cursor: "pointer", enableDefault: false, height: 25, width: 25 });
                        qcButton.find('div:first').addClass(toTheme('jqx-icon-edit'));
                        addButton.on('click', function () {
                            var selectedTreeItem = $('#projectExplorerTree').jqxTree('getSelectedItem');
                            if (selectedTreeItem) {
                                var selectedProjectItem = selectedProjectEntities.find(function (e) { return e.id == selectedTreeItem.id });

                                if (selectedProjectItem != null) {
                                    showAddStageWindow(selectedProjectItem);
                                }
                            }
                        });
                        deleteButton.on('click', function () {
                            if (!deleteButton.jqxButton('disabled')) {
                                var selectedRowIndex = $("#projectExplorerStages").jqxGrid('getselectedrowindex');

                                if (selectedRowIndex != -1) {
                                    var selectedRow = $("#projectExplorerStages").jqxGrid('getrowdata', selectedRowIndex);

                                    $.ajax({
                                        url: STAGES_URL + '/' + selectedRow.id,
                                        method: 'DELETE'
                                    }).done(function () {
                                        $("#projectExplorerStages").jqxGrid('deleteRow', selectedRow.uid);

                                        showNotification('Stage deleted successfully', NOTIFICATION_TYPE.SUCCESS);
                                    }).fail(function (error) {
                                        alert('Unable to delete stage');
                                    });
                                }
                            }
                        });
                        qcButton.on('click', function () {
                            var selectedRowIndex = $("#projectExplorerStages").jqxGrid('getselectedrowindex');

                            if (selectedRowIndex != -1) {
                                var selectedRow = $("#projectExplorerStages").jqxGrid('getrowdata', selectedRowIndex);
                                if (selectedRow && selectedRow.isPlanned == false) {

                                  

                                                showQcWindow();
                                            

                                }

                            }

                        });
                    }

                }
            );

            $('#projectExplorerStages').off('rowselect');
            $('#projectExplorerStages').on('rowselect', function (event) {
                if ($('#projectExplorerStageDetails').length != 0) {
                    $('#projectExplorerStageDetails').remove();
                }

                if (event.args.row.isPlanned == false) {
                    $('<div id="projectExplorerStageDetails"><div id="predictionsListLoadingAnimations"></div></div>').insertAfter('#projectExplorerStages');

                    $.ajax({
                        url: ANNOTATIONS_URL,
                        data: { stageId: event.args.row.id }
                    }).done(function (data) {
                        $('#predictionsListLoadingAnimations').remove();

                        if (data.length > 0) {
                            var source =
                            {
                                datatype: 'json',
                                datafields: [
                                    { name: 'changeHistory', type: 'string' },
                                    { name: 'className', type: 'string' },
                                    { name: 'code', type: 'string' },
                                    { name: 'confidentLevel', type: 'string' },
                                    { name: 'details', type: 'string' },
                                    { name: 'geometry', type: 'string' },
                                    { name: 'id', type: 'string' },
                                    { name: 'isClassChanged', type: 'string' },
                                    { name: 'isDeleted', type: 'string' },
                                    { name: 'isGeometryChanged', type: 'string' },
                                    { name: 'isPassedValidation', type: 'string' },
                                    { name: 'label', type: 'string' },
                                    { name: 'photoId', type: 'string' },
                                    { name: 'source', type: 'string' },
                                    { name: 'stageId', type: 'string' }
                                ],
                                id: 'id',
                                localdata: data
                            };

                            var dataAdapter = new $.jqx.dataAdapter(source);

                            $('#projectExplorerStageDetails').jqxGrid(
                                {
                                    width: '95%',
                                    source: dataAdapter,
                                    columnsresize: true,
                                    autoheight: true,
                                    pageable: true,
                                    columns: [
                                        { text: 'Class', datafield: 'className' },
                                        { text: 'Confident level', datafield: 'confidentLevel' },
                                        { text: 'Label', datafield: 'label' },
                                        { text: 'Details', datafield: 'details' },
                                        {
                                            text: 'Source', datafield: 'source', cellsrenderer: function (row, columnfield, value, defaulthtml, columnproperties, rowdata) {
                                                var cellContent = $(defaulthtml);

                                                if (value == 1) {
                                                    cellContent.text('AI');
                                                }
                                                else {
                                                    cellContent.text('Manual');
                                                }

                                                return cellContent.prop('outerHTML');
                                            }
                                        }
                                    ],
                                    theme: JQX_THEME
                                }
                            );
                        }
                    }).fail(function (error) {
                        $('#predictionsListLoadingAnimations').remove();

                        alert('Unable to get stages list');
                    });


                    //var editor = ace.edit('projectExplorerStageDetails', { mode: 'ace/mode/json' });
                    //editor.session.setUseWrapMode(true);
                    //editor.session.setValue(JSON.stringify({ name: 'Item 1', count: 100, isReserved: true }, null, '\t'));
                    //editor.setReadOnly(true);
                }
            });
        }).fail(function (error) {
            alert('Unable to get stages list');
        });
    }

    function loadLayout(photoId) {
        if (photoViewer && photoId) {
            $.ajax({
                url: PHOTOS_URL + '/' + photoId
            }).done(function (data) {
                if (data && data.data && data.data != '') {
                    try {
                        var layout = JSON.parse(data.data);
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

                        data.geometry = turf.getGeom(turf.polygon([vertices]));
                        data.type = 'Feature';

                        layout3dProcessor.Start(data, parseFloat(layout.z1), parseFloat(layout.z0), true);
                    } catch (e) {
                        showNotification('Unable to load layout', NOTIFICATION_TYPE.ERROR);
                    }
                } else {
                    showNotification('Layout was not extracted for selected photo', NOTIFICATION_TYPE.INFO);
                }
            }).fail(function (error) {
                if (error.status == 404) {
                    showNotification('Photo data was not found', NOTIFICATION_TYPE.ERROR);
                } else {
                    showNotification('Unable to load layout', NOTIFICATION_TYPE.ERROR);
                }
            });
        }
    }

    function loadAnnotations(photoId) {
        curPhotoAnnotations = [];

        if (photoViewer && photoId) {
            $.ajax({
                url: ANNOTATIONS_URL,
                data: { photoId: photoId }
            }).done(function (data) {
                if (data.length > 0) {
                    curPhotoAnnotations = data;

                    for (var annotation of data) {
                        PUtilities.prototype.invertY(annotation.geometry);
                    }

                    photoViewer.addEntities(data, photoViewer.styleDefault);
                }

                if (predictionProcessor && predictionProcessor.Refresh) {
                    predictionProcessor.Refresh();
                }

            }).fail(function (error) {
                showNotification('Unable to load annotations', NOTIFICATION_TYPE.ERROR);
            });
        }
    }

    function filterAnnotations(classname, confidenceLevelLimit) {
        if (photoViewer && curPhotoAnnotations.length > 0) {
            photoViewer.removeAllEntities();

            var features = curPhotoAnnotations.filter(function (e) {
                return !classname && !confidenceLevelLimit || !classname && e.confidentLevel > confidenceLevelLimit || !confidenceLevelLimit && e.className == classname || e.confidentLevel > confidenceLevelLimit && e.className == classname;
            });

            photoViewer.addEntities(features, photoViewer.styleDefault);
        }
    }

    function getReprojectedLayout(layout) {
        if (!layout && layout3dProcessor == null) {
            return null;
        }

        if (!layout) {
            layout = layout3dProcessor.getCurrentLayout();
        }

        if (layout == null) {
            return null;
        }

        if (!photoViewer || !photoViewer.currentMetadata) {
            return null;
        }

        var md = photoViewer.currentMetadata;
        var ht = layout.photo.rz ? parseFloat(md.HotspotTheta) + layout.photo.rz : parseFloat(md.HotspotTheta);
        var fp = Layout3dProcessor.prototype.layoutToFootpring(layout.uv, layout.floorH, - (Math.PI * ht) / 180);
        var photoPos = new THREE.Vector3(parseFloat(md.HotspotX), - parseFloat(md.HotspotY), 0);
        photoPos.applyMatrix4(mainViewer.getTransformationMatrix());

        if (layout.photo.dx) {
            photoPos.x += layout.photo.dx;
        }

        if (layout.photo.dy) {
            photoPos.y += layout.photo.dy;
        }

        // apply photo position offset
        turf.coordEach(fp, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
            currentCoord[0] += photoPos.x;
            currentCoord[1] += photoPos.y;
            currentCoord[2] = 5;
        }, false);

        return fp;
    }

    function getAvailableStageTypes(onSuccess, onError) {
        $.ajax({
            url: STAGE_TYPES_URL
        }).done(function (data) {
            onSuccess(data);
        }).fail(function (error) {
            onError(error);
        });
    }

    function loadPhotos(metadata, date) {
        mainViewer.removeAllPhotos();

        $.ajax({
            url: 'https://mds.multivista.com/index.cfm?fuseaction=aAPI.getPhotos&ShootTypeUID=' + metadata.ShootTypeUID + '&ProjectUID=' + selectedProject.details + '&Date=' + date,
            headers: {
                "Authorization": "Basic " + btoa('multiviewer@multivista.com' + ":" + 'Leica123*')
            }
        })
            .done(
                function (data) {
                    for (var i = 0; i < data.data.length; i++) {
                        data.data[i].PhotoID = parseInt(data.data[i].PhotoID.replace('P', ''));
                    }

                    selectedFloorPhotos = [];
                    mainViewer.addPhotos(data.data);
                }
            ).fail(
                function (error) {
                    showNotification('Unable to load shoots', NOTIFICATION_TYPE.ERROR);
                }
            );
    }

    function loadAttachedProjectFloorplans(projectCode, onSuccess, onError) {
        $.ajax({
            url: FLOORPLANS_URL,
            data: { code: projectCode }
        }).done(function (data) {
            onSuccess(data);
        }).fail(function (error) {
            onError(error);
        });
    }

    function loadAttachedFloorFloorplans(floorId, onSuccess, onError) {
        $.ajax({
            url: FLOORPLANS_URL,
            data: { entityId: floorId }
        }).done(function (data) {
            onSuccess(data);
        }).fail(function (error) {
            onError(error);
        });
    }

    function initWallCapturer(parentRoom, template) {
        if (mainViewerModifier) {
            mainViewerModifier.Stop();
        }

        $(vectorCapturer.dispatcherDOM).one('featurecaptured', function (event) {
            $(vectorCapturer.dispatcherDOM).off('capturingcanceled');

            if (mainViewerModifier) {
                mainViewerModifier.Start();
            }

            var walls;

            if (template == CAPTURER_TEMPLATE.NONE) {
                walls = [event.detail.feature];
            } else {
                walls = turf.lineSegment(event.detail.feature).features;
            }

            var processAddWalls = function (wallIndex) {
                var entity = {
                    Name: parentRoom.name + ' W',
                    Geometry: walls[wallIndex].geometry,
                    TypeId: 5,
                    ParentId: parentRoom.id,
                    Code: parentRoom.code
                };

                addNewEntity(
                    entity,
                    function (data) {
                        selectedProjectEntities.push(data);
                        mainViewer.addEntities([data]);
                        data.label = data.name;

                        if (roomFiller != null) {
                            roomFiller.Update([data]);
                        }

                        var treeItems = $('#projectExplorerTree').jqxTree('getItems');
                        var newFloorParent = treeItems.find(function (e) { return e.id == data.parentId });
                        var newFloorParentElement = newFloorParent.element;
                        $('#projectExplorerTree').jqxTree('addTo', data, newFloorParentElement);

                        if (wallIndex < walls.length - 1) {
                            processAddWalls(++wallIndex);
                        }
                    },
                    function (error) {
                        showNotification('Unable to save wall', NOTIFICATION_TYPE.ERROR);
                    }
                );
            }

            processAddWalls(0);
        });

        $(vectorCapturer.dispatcherDOM).one('capturingcanceled', function (event) {
            $(vectorCapturer.dispatcherDOM).off('featurecaptured');

            if (mainViewerModifier) {
                mainViewerModifier.Start();
            }
        });

        vectorCapturer.Cancel();

        if (template == CAPTURER_TEMPLATE.NONE) {
            vectorCapturer.Start(VectorCapturer.prototype.geometryType.lineString);
        } else {
            vectorCapturer.Start(VectorCapturer.prototype.geometryType.polygon, VectorCapturer.prototype.rectangleTemplate);
        }
    }

    function initPhotoViewer() {
        if (!photoViewer) {
            $('#viewerSplitter').jqxSplitter({ showSplitBar: true });
            $('#viewerSplitter').jqxSplitter('expand');

            photoViewer = new PhotoViewer($('#photoViewerContainer'));

            layout3dProcessor = new Layout3dProcessor(photoViewer);

            $(layout3dProcessor.dispatcherDOM).on('layout3dchanged', function (e) {
                var reprojectedLayout = getReprojectedLayout(e.detail);
                mainViewer.drawScratchGeometry(reprojectedLayout.geometry);

                var updatedLayout = {
                    z0: e.detail.ceilingH,
                    z1: e.detail.floorH,
                    uv: []
                }

                turf.coordEach(e.detail.uv, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                    updatedLayout.uv.push([currentCoord[0], currentCoord[1] - currentCoord[2]]);
                    updatedLayout.uv.push([currentCoord[0], currentCoord[1]]);
                }, true);

                e.detail.photo.data = JSON.stringify(updatedLayout);

                updatePhoto(e.detail.photo.id, e.detail.photo);
            });

            $(layout3dProcessor.dispatcherDOM).on('layout3dselected', function (e) {
                var reprojectedLayout = getReprojectedLayout(e.detail);
                mainViewer.drawScratchGeometry(reprojectedLayout.geometry);
            });

            $(layout3dProcessor.dispatcherDOM).on('layout3dunselected', function (e) {
                mainViewer.drawScratchGeometry(null);
            });

            // $('#predictionDropDown').jqxDropDownList('val', NONE_STAGE_TYPE_NAME);
        }
    }

    function initPrediction(predictionType, classFilter) {
        var data = {
            'token': 'bmvWIMplJbyhoBVZ6DlVx94A',
            'images': []
        }

        for (var photo of selectedFloorPhotos) {
            data.images.push({
                'predictorType': predictionType,
                'imgId': photo.ID,
                'imgUrl': photo.UnalteredURL,
                'projCode': selectedProject.code,
                'classFilter': classFilter
            });
        }

        $.ajax({
            url: PATH_PREFIX + 'proxy/prediction',
            method: 'POST',
            data: JSON.stringify(data)
        }).done(
            function (data) {
                var responce = JSON.parse(data);
                showNotification(responce.Message, NOTIFICATION_TYPE.SUCCESS);
            }
        ).fail(
            function (error) {
                if (error.responseText && error.responseText != '') {
                    var responce = JSON.parse(error.responseText);
                    showNotification(responce.Message, NOTIFICATION_TYPE.ERROR);
                } else {
                    showNotification('Unable to submit data for predictions', NOTIFICATION_TYPE.ERROR);
                }
            }
        );
    }

    function disposePhotoViewer() {
        if (photoViewer) {
            if (predictionProcessor && predictionProcessor.Dispose) {
                predictionProcessor.Dispose();
                predictionProcessor = null;
            }

            photoViewer.dispose();
            photoViewer = null;

            resetSplitter();
        }
    }

    function addNewEntity(entity, onSuccess, onError) {
        $.ajax({
            url: ENTITIES_URL,
            method: 'POST',
            data: JSON.stringify(entity),
            contentType: 'application/json'
        }).done(function (data) {
            onSuccess(data);
        }).fail(function (error) {
            onError(error);
        });
    }

    function deleteEntity(entityId, onSuccess, onError) {
        $.ajax({
            url: ENTITIES_URL + '/' + entityId,
            method: 'DELETE'
        }).done(function () {
            onSuccess();
        }).fail(function (error) {
            onError(error);
        });
    }

    function uploadFloorplan(floorplan, onSuccess, onError) {
        $.ajax({
            url: FLOORPLANS_URL,
            method: 'POST',
            data: JSON.stringify(floorplan),
            contentType: 'application/json'
        }).done(function (data) {
            onSuccess(data);
        }).fail(function (error) {
            onError(error);
        });
    }

    function updatePhoto(photoId, photo) {
        $.ajax({
            url: PHOTOS_URL + '/' + photoId,
            method: 'PUT',
            data: JSON.stringify(photo),
            contentType: 'application/json'
        }).done(function (data) {
            showNotification('Photo updated successfully', NOTIFICATION_TYPE.SUCCESS);
        }).fail(function (error) {
            showNotification('Unable to update photo', NOTIFICATION_TYPE.ERROR);
        });
    }

    function adjustLayout() {
        if (layout3dProcessor == null) {
            return;
        }

        // get reprojected layout
        var layoutGeometry = getReprojectedLayout();

        if (layoutGeometry == null) {
            showNotification('Layout adjustment error: Unable to get layout', NOTIFICATION_TYPE.ERROR);
            return;
        }

        // get camera position
        var md = photoViewer.currentMetadata;
        var photoPos = new THREE.Vector3(parseFloat(md.HotspotX), - parseFloat(md.HotspotY), 0);
        photoPos.applyMatrix4(mainViewer.getTransformationMatrix());
        var photoPoint = turf.point([photoPos.x, photoPos.y]);

        // find room
        var selectedFloorRooms = selectedProjectEntities.filter(x => x.parentId == selectedFloor.id);

        var targetFeature = null;

        for (room of selectedFloorRooms) {
            var walls = selectedProjectEntities.filter(x => x.parentId == room.id);

            var poly = PUtilities.prototype.polygonize(walls, 0.001);
            var polygon = turf.polygon([poly]);

            if (turf.booleanPointInPolygon(photoPoint, polygon)) {
                targetFeature = polygon;
                break;
            }
        }

        if (targetFeature == null) {
            showNotification('Layout adjustment error: Unable find target room', NOTIFICATION_TYPE.ERROR);
            return;
        }

        var sourcePolygon = turf.toWgs84(layoutGeometry);
        var targetPolygon = turf.toWgs84(targetFeature);
        var photoPointWGS = turf.toWgs84(photoPoint)

        // get scale factor
        var sourceArea = turf.area(sourcePolygon);
        var targetArea = turf.area(targetPolygon);

        var scaleFactor = Math.sqrt(targetArea / sourceArea);

        // apply scaling
        sourcePolygon = turf.transformScale(sourcePolygon, scaleFactor, { origin: photoPointWGS.geometry.coordinates });

        // get translate
        var sourceCenter = turf.centerOfMass(sourcePolygon);
        var targetCenter = turf.centerOfMass(targetPolygon);

        // apply translate
        var translateDistance = turf.distance(sourceCenter, targetCenter);
        var translateAngle = turf.bearing(sourceCenter, targetCenter);
        sourcePolygon = turf.transformTranslate(sourcePolygon, translateDistance, translateAngle);

        // calculate rotation
        var requiredRotation = 0;
        var minDifArea = Number.MAX_VALUE;

        sourceCenter = turf.centerOfMass(sourcePolygon);

        for (var i = -45; i < 46; i += 1) {
            var options = { pivot: sourceCenter.geometry.coordinates };
            var rotatedSource = turf.transformRotate(sourcePolygon, i, options);

            var difference = turf.difference(targetPolygon, rotatedSource);
            var diffArea = turf.area(difference);

            //console.log('Angle: ' + i + ' Dif area: ' + diffArea)

            if (diffArea < minDifArea) {
                minDifArea = diffArea;
                requiredRotation = i;
            }
        }

        var angleRad = translateAngle * (Math.PI / 180);

        // save changes
        var origLayout = layout3dProcessor.getCurrentLayout();
        var photo = origLayout.photo;

        if (photo.dx == null) {
            photo.dx = 0;
        }

        if (photo.dy == null) {
            photo.dy = 0;
        }

        if (photo.rz == null) {
            photo.rz = 0;
        }

        photo.dx += 1000 * translateDistance * Math.sin(angleRad);
        photo.dy += 1000 * translateDistance * Math.cos(angleRad);
        photo.rz += requiredRotation;

        var data = JSON.parse(photo.data);
        data.z0 *= scaleFactor;
        data.z1 *= scaleFactor;

        photo.data = JSON.stringify(data);

        updatePhoto(photo.id, photo);

        // visualize adjusted geometry
        var rotatedPoly = turf.transformRotate(sourcePolygon, requiredRotation, { pivot: sourceCenter.geometry.coordinates });
        rotatedPolyMercator = turf.toMercator(rotatedPoly);

        mainViewer.drawScratchGeometry(rotatedPolyMercator.geometry);
    }

    function showAnnotationsFilterWindow(classNames) {
        var annotationsFilterWindow = `
                        <div id="annotationsFilterWindow" style="display:none">
                            <div id="annotationsFilterWindowHeader">
                                <span>Filter annotations</span>
                            </div>
                            <div id="annotationsFilterWindowContent" style="overflow: hidden">
                                <div id="annotationClassDropDown"></div>
                                <div id="annotationConfLevelDropDown"></div>
                                <input type="button" value="Apply" id="applyFilter">
                                <input type="button" value="Cancel" id="newEntityCancel">
                            </div>
                        </div>
                    `

        $(annotationsFilterWindow).insertAfter('#mainLayout');

        var classes = [];

        for (var annotation of curPhotoAnnotations) {
            if (classes.indexOf(annotation.className) == -1) {
                classes.push(annotation.className);
            }
        }

        $('#annotationClassDropDown').jqxDropDownList({
            source: classes.sort(),
            placeHolder: 'Annotation class',
            width: '100%',
            height: 30,
            theme: JQX_THEME
        });

        $('#annotationConfLevelDropDown').jqxDropDownList({
            source: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
            placeHolder: 'Confidence level limit',
            width: '100%',
            height: 30,
            theme: JQX_THEME
        });

        $('#annotationsFilterWindow').jqxWindow({
            width: '400px',
            isModal: true,
            theme: JQX_THEME,
            resizable: false
        }).show();

        $('#applyFilter').on('click', function () {
            var classFilter = $('#annotationClassDropDown').jqxDropDownList('val');
            var conLevelFilter = $('#annotationConfLevelDropDown').jqxDropDownList('val');
            filterAnnotations(classFilter, conLevelFilter);
            $('#annotationsFilterWindow').jqxWindow('destroy');
        });

        $('#newEntityCancel').on('click', function () { $('#annotationsFilterWindow').jqxWindow('destroy'); });
    }

    function showInitPredictionWindow() {
        if (availableStageTypes.length > 0) {
            var initPredictionWindow = `
                        <div id="initPredictionWindow" style="display:none">
                            <div id="initPredictionWindowHeader">
                                <span>Run prediction task</span>
                            </div>
                            <div id="initPredictionWindowContent" style="overflow: hidden">
                                <div id="predictionTypeDropDown"></div>
                                <div id="predictionClassFilterDropDown"></div>
                                <input type="button" value="Submit" id="newEntitySave">
                                <input type="button" value="Cancel" id="newEntityCancel">
                            </div>
                        </div>
                    `

            $(initPredictionWindow).insertAfter('#mainLayout');

            $('#predictionTypeDropDown').jqxDropDownList({
                source: availableStageTypes,
                placeHolder: 'Prediction type',
                width: '100%',
                height: 30,
                displayMember: 'name',
                valueMember: 'id',
                autoDropDownHeight: true,
                theme: JQX_THEME
            });

            $('#predictionClassFilterDropDown').jqxDropDownList({
                source: [],
                placeHolder: 'Class filter',
                width: '100%',
                height: 30,
                displayMember: 'name',
                valueMember: 'id',
                checkboxes: true,
                autoDropDownHeight: true,
                theme: JQX_THEME
            });

            $('#predictionTypeDropDown').on('change', function (event) {
                var args = event.args;
                if (args) {
                    var item = args.item;
                    var stage = availableStageTypes.find(function (e) { return e.id == item.value });

                    if (stage != null) {
                        if (stage.details != null) {
                            var details = JSON.parse(stage.details);
                            var classSource = [];

                            for (var cl of details.classes) {
                                classSource.push({ name: cl.name, id: cl.id });
                            }

                            $('#predictionClassFilterDropDown').jqxDropDownList('source', classSource);
                            $('#predictionClassFilterDropDown').jqxDropDownList('checkAll');

                            if (classSource.length < 10) {
                                $('#predictionClassFilterDropDown').jqxDropDownList('autoDropDownHeight', true);
                            } else {
                                $('#predictionClassFilterDropDown').jqxDropDownList('autoDropDownHeight', false);
                            }
                        }

                    }
                }
            });

            $('#initPredictionWindow').jqxWindow({
                width: '400px',
                isModal: true,
                theme: JQX_THEME,
                resizable: false
            }).show();

            $('#newEntitySave').on('click', function () {
                var predictor = $('#predictionTypeDropDown').jqxDropDownList('val');
                if (predictor != '') {
                    var classFilter = $('#predictionClassFilterDropDown').jqxDropDownList('getCheckedItems');
                    initPrediction(predictor, classFilter.map(x => x.value));
                    $('#initPredictionWindow').jqxWindow('destroy');
                } else {
                    alert('Prediction type not selected');
                }
            });

            $('#newEntityCancel').on('click', function () { $('#initPredictionWindow').jqxWindow('destroy'); });
        }
    }

    function showAddProjectWindow() {
        var addNewProjectWindow = `
                        <div id="addProjectWindow" style="display:none">
                            <div id="addProjectWindowHeader">
                                <span>Create new project</span>
                            </div>
                            <div id="addProjectContent" style="overflow: hidden">
                                <label id="newProjectNameLabel">Project name</label>
                                <input type="text" id="newProjectName"/>
                                <label id="newProjectCodeLabel">Project code</label>
                                <input type="text" id="newProjectCode"/>
                                <label id="multivistaNewProjectIdLabel">Multivista project ID</label>
                                <input type="text" id="multivistaNewProjectId"/>
                                <input type="button" value="Create" id="newEntitySave">
                                <input type="button" value="Cancel" id="newEntityCancel">
                            </div>
                        </div>
                    `

        $(addNewProjectWindow).insertAfter('#mainLayout');

        $('#addProjectWindow').jqxWindow({
            width: '400px',
            isModal: true,
            theme: JQX_THEME,
            resizable: false
        }).show();

        $('#newEntitySave').off('click');
        $('#newEntitySave').on('click', function () {
            var newProjectName = $('#newProjectName').val();
            var newProjectCode = $('#newProjectCode').val();
            var multivistaNewProjectId = $('#multivistaNewProjectId').val();

            if (newProjectName == '') {
                alert('Wrong project name');
                return;
            }

            if (newProjectCode == '') {
                alert('Wrong project code');
                return;
            }

            if (multivistaNewProjectId == '') {
                alert('Wrong Multivista project ID');
                return;
            }

            var entity = {
                Name: newProjectName,
                TypeId: 1,
                Details: multivistaNewProjectId,
                Code: newProjectCode
            };

            addNewEntity(
                entity,
                function (data) {
                    availableProjects.push(data);

                    $('#projectsDropDown').jqxDropDownList('addItem', { name: data.name, code: data.code });
                    var projectsDropDownItems = $("#projectsDropDown").jqxDropDownList('getItems');
                    $("#projectsDropDown").jqxDropDownList('selectItem', projectsDropDownItems[projectsDropDownItems.length - 1]);

                    $('#addProjectWindow').jqxWindow('destroy');
                },
                function (error) {
                    showNotification('Unable to create project', NOTIFICATION_TYPE.ERROR);
                    $('#addProjectWindow').jqxWindow('destroy');
                }
            );
        });

        $('#newEntityCancel').off('click');
        $('#newEntityCancel').on('click', function () { $('#addProjectWindow').jqxWindow('destroy'); });
    }

    function showAddBuildingWindow() {
        showNewEntityWindow(
            2,
            function (newBuildingName) {
                if (newBuildingName == '') {
                    alert('Wrong building name');
                } else {
                    var newBuildingEntity = {
                        code: selectedProject.code,
                        details: null,
                        geometry: null,
                        name: newBuildingName,
                        parentId: selectedProject.id,
                        typeId: 2
                    }

                    addNewEntity(
                        newBuildingEntity,
                        function (data) {
                            selectedProjectEntities.push(data);

                            data.label = data.name;

                            $('#projectExplorerTree').jqxTree('addTo', data);

                            showNotification('Building created successfully', NOTIFICATION_TYPE.SUCCESS);
                        },
                        function (error) {
                            showNotification('Unable to create new floor', NOTIFICATION_TYPE.ERROR);
                        }
                    );
                }
            }
        )
    }

    function showAddFloorWindow(building) {
        showNewEntityWindow(
            3,
            function (newFloorName) {
                if (newFloorName == '') {
                    alert('Wrong floor name');
                } else {
                    var newFloorEntity = {
                        code: building.code,
                        details: null,
                        geometry: null,
                        name: newFloorName,
                        parentId: building.id,
                        typeId: 3
                    }

                    addNewEntity(
                        newFloorEntity,
                        function (data) {
                            selectedProjectEntities.push(data);

                            data.label = data.name;

                            var treeItems = $('#projectExplorerTree').jqxTree('getItems');
                            var newFloorParent = treeItems.find(function (e) { return e.id == data.parentId });
                            var newFloorParentElement = newFloorParent.element;
                            $('#projectExplorerTree').jqxTree('addTo', data, newFloorParentElement);

                            showNotification('Floor created successfully', NOTIFICATION_TYPE.SUCCESS);
                        },
                        function (error) {
                            showNotification('Unable to create new floor', NOTIFICATION_TYPE.ERROR);
                        }
                    );
                }
            }
        )
    }

    function showAddFloorplanWindow(floor) {
        loadAttachedProjectFloorplans(
            selectedProject.code,
            function (data) {
                var floorPlansToAdd = [];
                for (var plan of loadedShootTypes) {
                    var sameInAdded = data.find(function (e) { return e.id == plan.ShootTypeUID });

                    if (sameInAdded == null) {
                        floorPlansToAdd.push(plan);
                    }
                }

                var addFloorplanWindow = `
                        <div id="addFloorplanWindow" style="display:none">
                            <div id="addFloorplanWindowHeader">
                                <span>Add floorplan</span>
                            </div>
                            <div id="addFloorplanWindowContent" style="overflow: hidden">
                                <div id="floorplanNameDropDown"></div>
                                <input type="button" value="Create" id="newEntitySave">
                                <input type="button" value="Cancel" id="newEntityCancel">
                            </div>
                        </div>
                    `

                $(addFloorplanWindow).insertAfter('#mainLayout');

                $('#floorplanNameDropDown').jqxDropDownList({
                    source: floorPlansToAdd,
                    placeHolder: 'Floorplan name',
                    width: '100%',
                    height: 30,
                    displayMember: 'FloorplanName',
                    valueMember: 'ShootTypeUID',
                    theme: JQX_THEME,
                    renderer: function (index, label, value) {
                        var datarecord = floorPlansToAdd[index];
                        return '<div><div style="font-weight:bold">' + datarecord.FloorplanName + '</div><div style="padding-left:10px">' + datarecord.Name + '</div></div>';
                    }
                });

                $('#addFloorplanWindow').jqxWindow({
                    width: '400px',
                    isModal: true,
                    theme: JQX_THEME,
                    resizable: false
                }).show();

                $('#newEntitySave').on('click', function () {
                    var selectedFloorPlan = $('#floorplanNameDropDown').jqxDropDownList('getSelectedItem');

                    if (selectedFloorPlan == null) {
                        alert('Floorplan not selected');
                        return;
                    }

                    var selectedFloorPlanId = selectedFloorPlan.value;
                    var metadata = loadedShootTypes.find(function (e) { return e.ShootTypeUID == selectedFloorPlanId });

                    if (metadata == null) {
                        alert('Unable to find metadata for selected floorplan');
                        return;
                    }

                    loadAttachedFloorFloorplans(
                        floor.id,
                        function (data) {
                            $('#addFloorplanWindow').jqxWindow('destroy');

                            if (data.length > 0) {
                                $('#shootTypeSelector').hide();
                                $('#shootDateSelector').hide();

                                var masterFloorplan = data.find(function (e) { return e.isMaster == true });

                                if (masterFloorplan == null) {
                                    showNotification('Unable to find master floorplan for selected floor', NOTIFICATION_TYPE.ERROR);
                                    return;
                                }

                                var masterMetadata = loadedShootTypes.find(function (e) { return e.ShootTypeUID == masterFloorplan.id });

                                if (masterFloorplan.url == metadata.FloorplanImageURL) {
                                    alert('Master floorplan has same image URL as selected floorplan. Transformation matrix will be copied from master floorplan. No need to do manual matching');

                                    var floorPlanEntity = {
                                        Id: metadata.ShootTypeUID,
                                        Name: metadata.Name,
                                        Transform: masterFloorplan.transform,
                                        IsMaster: false,
                                        Url: metadata.FloorplanImageURL,
                                        Code: selectedProject.code,
                                        EntityId: floor.id
                                    };

                                    uploadFloorplan(
                                        floorPlanEntity,
                                        function (data) {
                                            showNotification('Floorplan added successfully', NOTIFICATION_TYPE.SUCCESS);

                                            isViewerForceUpdate = true;
                                            $('#projectExplorerTree').jqxTree('selectItem', floor);
                                        },
                                        function (error) {
                                            alert('Unable to upload floorplan');
                                        }
                                    );
                                } else {
                                    if (masterFloorplan.transform != null) {
                                        mainViewer.showFloorPlan(masterMetadata, masterFloorplan.transform.split(';'));
                                    } else {
                                        mainViewer.showFloorPlan(masterMetadata, null);
                                    }

                                    $('#viewerSplitter').css('width', '50%');
                                    $('#viewerMatcherContainer').show();
                                    var matcherView = new FloorPlanViewer($('#viewerMatcherContainer'));

                                    matcherView.showFloorPlan(metadata, null);

                                    var matcher = new FloorPlanMatcher(mainViewer, matcherView);
                                    var syncer = new FloorPlanSync(mainViewer, matcherView);

                                    $(matcher.dispatcherDOM).on('transformationcalculated', function (event) {
                                        var tm_adjustment = (new THREE.Matrix4()).fromArray(event.detail.tk);
                                        var tm = matcherView.getTransformationMatrix();
                                        tm.premultiply(tm_adjustment);

                                        matcherView.setTransformationMatrix(tm.toArray());
                                        syncer.Start();

                                        function cleanupMatching() {
                                            $(matcher.dispatcherDOM).off('transformationcalculated');

                                            $('#viewerMatcherContainer').empty().hide();
                                            $('#viewerSplitter').css('width', '');
                                            $('#btnApplyMatching').off('click').remove();
                                            $('#btnRestartMatching').off('click').remove();
                                            $('#btnCancelMatching').off('click').remove();

                                            $('#shootTypeSelector').show();
                                            $('#shootDateSelector').show();
                                        }

                                        $('<input type="button" value="Apply matching" id="btnApplyMatching" />').insertBefore($('#viewerContainer')).on('click', function () {
                                            var floorPlanEntity = {
                                                Id: metadata.ShootTypeUID,
                                                Name: metadata.Name,
                                                Transform: tm.toArray().join(';'),
                                                IsMaster: false,
                                                Url: metadata.FloorplanImageURL,
                                                Code: selectedProject.code,
                                                EntityId: floor.id
                                            };

                                            uploadFloorplan(
                                                floorPlanEntity,
                                                function (data) {
                                                    cleanupMatching();
                                                    showNotification('Floorplan added successfully', NOTIFICATION_TYPE.SUCCESS);

                                                    isViewerForceUpdate = true;
                                                    $('#projectExplorerTree').jqxTree('selectItem', floor);
                                                },
                                                function (error) {
                                                    alert('Unable to upload floorplan');
                                                }
                                            );
                                        });

                                        $('<input type="button" value="Restart matching" id="btnRestartMatching" />').insertBefore($('#viewerContainer')).on('click', function () {
                                            $('#btnApplyMatching').off('click').remove();
                                            $('#btnRestartMatching').off('click').remove();
                                            $('#btnCancelMatching').off('click').remove();

                                            syncer.Stop();
                                            matcher.Start();
                                        });

                                        $('<input type="button" value="Cancel" id="btnCancelMatching" />').insertBefore($('#viewerContainer')).on('click', function () {
                                            cleanupMatching();
                                        });
                                    });

                                    matcher.Start();
                                }
                            } else {
                                mainViewer.showFloorPlan(metadata, null);

                                var scaler = new FloorPlanScaler(mainViewer);

                                $(scaler.dispatcherDOM).on('transformationcalculated', function (e) {

                                    var tm_adjustment = (new THREE.Matrix4()).fromArray(event.detail.tk);
                                    var tm = mainViewer.getTransformationMatrix();
                                    tm.premultiply(tm_adjustment);

                                    mainViewer.setTransformationMatrix(tm.toArray());

                                    function clenupScaling() {
                                        $('#btnApplyScaling').off('click').remove();
                                        $('#btnRestartScaling').off('click').remove();
                                        $('#btnCancelScaling').off('click').remove();
                                    }

                                    $('<input type="button" value="Apply scaling" id="btnApplyScaling" />').insertBefore($('#viewerContainer')).on('click', function () {
                                        var floorPlanEntity = {
                                            Id: metadata.ShootTypeUID,
                                            Name: metadata.Name,
                                            Transform: tm.toArray().join(';'),
                                            IsMaster: true,
                                            Url: metadata.FloorplanImageURL,
                                            Code: selectedProject.code,
                                            EntityId: floor.id
                                        };

                                        uploadFloorplan(
                                            floorPlanEntity,
                                            function (data) {
                                                clenupScaling();
                                                showNotification('Floorplan added successfully', NOTIFICATION_TYPE.SUCCESS);

                                                isViewerForceUpdate = true;
                                                $('#projectExplorerTree').jqxTree('selectItem', floor);
                                            },
                                            function (error) {
                                                alert('Unable to upload floorplan');
                                            }
                                        );
                                    });

                                    $('<input type="button" value="Restart scaling" id="btnRestartScaling" />').insertBefore($('#viewerContainer')).on('click', function () {
                                        clenupScaling();
                                        scaler.Start();
                                    });

                                    $('<input type="button" value="Cancel" id="btnCancelScaling" />').insertBefore($('#viewerContainer')).on('click', function () {
                                        clenupScaling();
                                    });
                                });

                                scaler.Start();
                            }
                        },
                        function (error) {
                            alert('Unable get attached floorplans');
                        }
                    );
                });

                $('#newEntityCancel').on('click', function () { $('#addFloorplanWindow').jqxWindow('destroy'); });
            },
            function (error) {
                showNotification('Unable to load attached floorplans', NOTIFICATION_TYPE.ERROR);
            }
        );
    }

    function showAddRoomWindow(floor) {
        showNewEntityWindow(
            4,
            function (newRoomName) {
                if (newRoomName == '') {
                    alert('Wrong room name');
                } else {
                    var newRoomEntity = {
                        code: floor.code,
                        details: null,
                        geometry: null,
                        name: newRoomName,
                        parentId: floor.id,
                        typeId: 4
                    }

                    var onEntityAdded = function (data) {
                        selectedProjectEntities.push(data);

                        data.label = data.name;

                        var treeItems = $('#projectExplorerTree').jqxTree('getItems');
                        var newFloorParent = treeItems.find(function (e) { return e.id == data.parentId });
                        var newFloorParentElement = newFloorParent.element;
                        $('#projectExplorerTree').jqxTree('addTo', data, newFloorParentElement);
                    }

                    addNewEntity(
                        newRoomEntity,
                        function (data) {
                            onEntityAdded(data);
                            showNotification('Room created successfully', NOTIFICATION_TYPE.SUCCESS);

                            var floorEntity = {
                                code: floor.code,
                                details: null,
                                geometry: null,
                                name: newRoomName + ' F',
                                parentId: data.id,
                                typeId: 6
                            }

                            addNewEntity(
                                floorEntity,
                                function (data) {
                                    onEntityAdded(data);
                                    showNotification('Floor created successfully', NOTIFICATION_TYPE.SUCCESS);
                                },
                                function (error) {
                                    showNotification('Unable to add floor', NOTIFICATION_TYPE.ERROR);
                                }
                            );

                            var ceilingEntity = {
                                code: floor.code,
                                details: null,
                                geometry: null,
                                name: newRoomName + ' C',
                                parentId: data.id,
                                typeId: 7
                            }

                            addNewEntity(
                                ceilingEntity,
                                function (data) {
                                    onEntityAdded(data);
                                    showNotification('Floor created successfully', NOTIFICATION_TYPE.SUCCESS);
                                },
                                function (error) {
                                    showNotification('Unable to add floor', NOTIFICATION_TYPE.ERROR);
                                }
                            );
                        },
                        function (error) {
                            showNotification('Unable to create new room', NOTIFICATION_TYPE.ERROR);
                        }
                    );
                }
            }
        )
    }

    function showAddStageWindow(entity) {
        if (availableStageTypes.length > 0) {
            var addStageWindow = `
                        <div id="addStageWindow" style="display:none">
                            <div id="addStageWindowHeader">
                                <span>Add satge</span>
                            </div>
                            <div id="addStageWindowContent" style="overflow: hidden">
                                <div id="stageTypeDropDown"></div>
                                <div id="stageSubTypeDropDown"></div>
                                <input type="text" id="stageValue"/>
                                <input type="text" id="stageDescription"/>
                                <label>Valid from:</label>
                                <div id="validFromDateTimeInput"></div>
                                <label style="margin-top:15px;">Valid to:</label>
                                <div id="validToDateTimeInput" style="margin-bottom:15px;"></div>
                                <input type="button" value="Create" id="newEntitySave">
                                <input type="button" value="Cancel" id="newEntityCancel">
                            </div>
                        </div>
                    `

            $(addStageWindow).insertAfter('#mainLayout');

            $('#stageTypeDropDown').jqxDropDownList({
                source: availableStageTypes,
                placeHolder: 'Stage type',
                width: '100%',
                height: 30,
                displayMember: 'name',
                valueMember: 'id',
                theme: JQX_THEME
            });

            $('#stageSubTypeDropDown').jqxDropDownList({
                source: [],
                placeHolder: 'Class name',
                width: '100%',
                height: 30,
                displayMember: 'name',
                valueMember: 'id',
                checkboxes: true,
                autoDropDownHeight: true,
                theme: JQX_THEME
            });

            $('#stageTypeDropDown').on('change', function (event) {
                var args = event.args;
                if (args) {
                    var item = args.item;
                    var stage = availableStageTypes.find(function (e) { return e.id == item.value });

                    if (stage != null) {
                        if (stage.details != null) {
                            var details = JSON.parse(stage.details);
                            var classSource = [];

                            for (var cl of details.classes) {
                                classSource.push({ name: cl.name, id: cl.id });
                            }

                            $('#stageSubTypeDropDown').jqxDropDownList('source', classSource);
                            $('#stageSubTypeDropDown').jqxDropDownList('checkAll');

                            if (classSource.length < 10) {
                                $('#stageSubTypeDropDown').jqxDropDownList('autoDropDownHeight', true);
                            } else {
                                $('#stageSubTypeDropDown').jqxDropDownList('autoDropDownHeight', false);
                            }
                        }

                    }
                }
            });

            if (availableStageTypes.length < 10) {
                $('#stageTypeDropDown').jqxDropDownList('autoDropDownHeight', true);
            } else {
                $('#stageTypeDropDown').jqxDropDownList('autoDropDownHeight', false);
            }

            $('#stageValue').jqxInput({ placeHolder: 'Value', width: '100%', height: 30, theme: JQX_THEME });
            $('#stageDescription').jqxInput({ placeHolder: 'Description (optional)', width: '100%', height: 30, theme: JQX_THEME });
            $("#validFromDateTimeInput").jqxDateTimeInput({ formatString: "D", width: '100%', height: 30, theme: JQX_THEME });
            $("#validToDateTimeInput").jqxDateTimeInput({ formatString: "D", width: '100%', height: 30, theme: JQX_THEME });

            $('#addStageWindow').jqxWindow({
                width: '400px',
                isModal: true,
                theme: JQX_THEME,
                resizable: false
            }).show();

            $('#newEntitySave').off('click');
            $('#newEntitySave').on('click', function () {
                var stageType = $('#stageTypeDropDown').jqxDropDownList('getSelectedItem');
                var stageSubTypes = $('#stageSubTypeDropDown').jqxDropDownList('getCheckedItems');
                var stageValue = $('#stageValue').jqxInput('val');
                var stageDescription = $('#stageDescription').jqxInput('val');
                var validFrom = $('#validFromDateTimeInput').val('date');
                var validTo = $('#validToDateTimeInput').val('date');

                if (!stageType || !stageType.value) {
                    alert('Wrong stage type');
                    return;
                }

                if (isNaN(parseInt(stageValue))) {
                    alert('Wrong stage value');
                    return;
                }

                if (validFrom == null && validTo == null) {
                    alert('At least one date should be specified');
                    return;
                }

                var stageDetails = { cf: stageSubTypes.map(x => x.value) }

                $.ajax({
                    url: STAGES_URL,
                    method: 'POST',
                    data: JSON.stringify({
                        Code: entity.code,
                        Value: stageValue,
                        ValidFrom: validFrom,
                        ValidTo: validTo,
                        Timestamp: new Date(),
                        IsPlanned: true,
                        IsActive: true,
                        Description: stageDescription,
                        Details: JSON.stringify(stageDetails),
                        TypeId: stageType.value,
                        EntityId: entity.id
                    }),
                    contentType: 'application/json'
                }).done(function (data) {
                    $("#projectExplorerStages").jqxGrid('addrow', null, data);
                    $('#addStageWindow').jqxWindow('destroy');

                    showNotification('Stage created successfully', NOTIFICATION_TYPE.SUCCESS);
                }).fail(function (error) {
                    alert('Unable to create stage');
                });
            });

            $('#newEntityCancel').off('click');
            $('#newEntityCancel').on('click', function () { $('#addStageWindow').jqxWindow('destroy'); });
        }
    }

    function showNewEntityWindow(entityTypeId, handler) {
        var windowHeader;

        switch (entityTypeId) {
            case 2:
                windowHeader = 'Create building';
                break;
            case 3:
                windowHeader = 'Create floor';
                break;
            case 4:
                windowHeader = 'Create room';
                break;
        }

        var addEntityWindow = `
            <div id="addEntityWindow" style="display:none">
                <div id="addEntityWindowHeader">
                    <span>` + windowHeader + `</span>
                </div>
                <div id="addEntityWindowContent" style="overflow: hidden">
                    <input type="text" id="newEntityName">
                    <input type="button" value="Create" id="newEntitySave">
                    <input type="button" value="Cancel" id="newEntityCancel">
                </div>
            </div>
        `

        $(addEntityWindow).insertAfter('#mainLayout');

        $('#addEntityWindow').jqxWindow({
            width: '400px',
            isModal: true,
            theme: JQX_THEME,
            resizable: false
        }).show();

        $('#newEntitySave').off('click');
        $('#newEntitySave').on('click', function () {
            handler($('#newEntityName').val());
            $('#addEntityWindow').jqxWindow('destroy');
        });

        $('#newEntityCancel').off('click');
        $('#newEntityCancel').on('click', function () { $('#addEntityWindow').jqxWindow('destroy'); });
    }




    function showLayoutValidationWindow() {
        var layoutValidationWindow = `
            <div id="layoutValidationWindow">
                <div id="layoutValidationWindowHeader">
                    <span>Layout validation</span>
                </div>
                <div id="layoutValidationWindowContent" style="overflow: hidden">
                    <div id="layoutValidationList" style="height:100%;width:15%;float:left;">
                        <div id="layoutValidationListContent"></div>
                    </div>
                    <div id="layoutValidationViewer" style="position:relative;height:100%;width:85%;float:right;"></div>
                    <input type="button" value="Valid" id="layoutValidationBtnValid" style="position:absolute;bottom:10px;left:50%;width:150px;transform:translateX(-50%);-ms-transform:translateX(-50%);display:none;">
                </div>
            </div>
        `

        $('body').append(layoutValidationWindow);

        $('#layoutValidationWindow').jqxWindow({
            width: '95%',
            height: '95%',
            maxHeight: '95%',
            maxWidth: '95%',
            isModal: true,
            theme: JQX_THEME,
            resizable: false,
            draggable: false,
            showCloseButton: true,
            closeButtonAction: 'close'
        }).show();

        $('#layoutValidationWindow').on('close', function (event) { $('#layoutValidationWindow').remove() });

        var metadataCache = {};
        var layoutValidationPhotoViewer = null;
        var layoutValidationlayout3dProcessor = null;

        $('#layoutValidationListContent').jqxListBox({ source: layoutValidationQueue, displayMember: 'id', valueMember: 'id', width: '100%', height: '100%' });

        $('#layoutValidationListContent').on('select', function (event) {
            var args = event.args;
            if (args) {
                var selectedPhotoId = args.item.value;
                var selectedQueueItem = layoutValidationQueue.find(function (e) { return e.id == selectedPhotoId });

                if (selectedQueueItem != null) {
                    function loadValidation() {

                        if (layoutValidationPhotoViewer == null) {
                            layoutValidationPhotoViewer = new PhotoViewer($('#layoutValidationViewer'));
                        }

                        if (layoutValidationlayout3dProcessor == null) {
                            layoutValidationlayout3dProcessor = new Layout3dProcessor(layoutValidationPhotoViewer);

                            $(layoutValidationlayout3dProcessor.dispatcherDOM).on('layout3dchanged', function (e) {
                                var updatedLayout = {
                                    z0: e.detail.ceilingH,
                                    z1: e.detail.floorH,
                                    uv: []
                                }

                                turf.coordEach(e.detail.uv, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                                    updatedLayout.uv.push([currentCoord[0], currentCoord[1] - currentCoord[2]]);
                                    updatedLayout.uv.push([currentCoord[0], currentCoord[1]]);
                                }, true);

                                e.detail.photo.data = JSON.stringify(updatedLayout);

                                updatePhoto(e.detail.photo.id, e.detail.photo);
                            });
                        }

                        var curPhoto = metadataCache[selectedQueueItem.dateTaken].find(function (e) { return e.PhotoID == selectedPhotoId });

                        if (curPhoto != null) {
                            layoutValidationPhotoViewer.showPhoto(curPhoto);

                            var layout = JSON.parse(selectedQueueItem.data);
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

                            selectedQueueItem.geometry = turf.getGeom(turf.polygon([vertices]));
                            selectedQueueItem.type = 'Feature';

                            layoutValidationlayout3dProcessor.Start(selectedQueueItem, parseFloat(layout.z1), parseFloat(layout.z0), true);

                            $('#layoutValidationBtnValid').show();
                        }
                    }

                    if (!metadataCache[selectedQueueItem.dateTaken]) {
                        $.ajax({
                            url: 'https://mds.multivista.com/index.cfm?fuseaction=aAPI.getPhotos&ShootTypeUID=' + selectedQueueItem.floorplanId + '&ProjectUID=' + selectedProject.details + '&Date=' + selectedQueueItem.dateTaken.split('T')[0],
                            headers: {
                                "Authorization": "Basic " + btoa('multiviewer@multivista.com' + ":" + 'Leica123*')
                            }
                        }).done(
                            function (data) {
                                for (var i = 0; i < data.data.length; i++) {
                                    data.data[i].PhotoID = parseInt(data.data[i].PhotoID.replace('P', ''));
                                }

                                metadataCache[selectedQueueItem.dateTaken] = data.data;
                                loadValidation();
                            }).fail(
                                function (error) {
                                    showNotification('Unable to load shoots', NOTIFICATION_TYPE.ERROR);
                                }
                            );
                    } else {
                        loadValidation();
                    }
                }
            }
        });

        $('#layoutValidationBtnValid').on('click', function () {
            var selectedListIndex = $("#layoutValidationListContent").jqxListBox('getSelectedIndex');

            var selectedPhoto = layoutValidationQueue[selectedListIndex];
            selectedPhoto.status = 'Layout verified';

            updatePhoto(selectedPhoto.id, selectedPhoto);

            $("#layoutValidationListContent").jqxListBox('unselectIndex', selectedListIndex);
            $("#layoutValidationListContent").jqxListBox('removeAt', selectedListIndex);
            $("#layoutValidationListContent").jqxListBox('selectIndex', selectedListIndex);
            layoutValidationQueue.splice(selectedListIndex, 1);


            if (layoutValidationQueue.length == 0) {
                layoutValidationlayout3dProcessor.Dispose();
                layoutValidationPhotoViewer.dispose();
            } else {
                $('#navbar-notifications-layout-validation').text('You have ' + layoutValidationQueue.length + ' layouts for validation');

                if (selectedListIndex < layoutValidationQueue.length) {
                    $("#layoutValidationListContent").jqxListBox('selectIndex', selectedListIndex);
                } else {
                    $("#layoutValidationListContent").jqxListBox('selectIndex', layoutValidationQueue.length - 1);
                }
            }
        });
    }

    function showQcWindow() {
        var qcValidationWindow = `
            <div id="qcValidationWindow">
                <div id="qcWindowHeader">
                    <span>QC Validation</span>
                </div>
                <div id="qcValidationWindowContent" style="overflow: hidden">
                    <div id="qcValidationList" style="height:100%;width:15%;float:left;">
                        <div id="qcValidationListContent"></div>
                    </div>
                    <div id="qcValidationViewer" style="position:relative;height:100%;width:85%;float:right;"></div>
                    <input type="button" value="Valid" id="qcValidationBtnValid" style="position:absolute;bottom:10px;left:50%;width:150px;transform:translateX(-50%);-ms-transform:translateX(-50%);display:none;">
                </div>
            </div>
        `

        $('body').append(qcValidationWindow);

        $('#qcValidationWindow').jqxWindow({
            width: '95%',
            height: '95%',
            maxHeight: '95%',
            maxWidth: '95%',
            isModal: true,
            theme: JQX_THEME,
            resizable: false,
            draggable: false,
            showCloseButton: true,
            closeButtonAction: 'close'
        }).show();

        $('#qcValidationWindow').on('close', function (event) { $('#qcValidationWindow').remove() });

        $('#qcValidationWindow').on('keydown', function (event) {
            switch (event.keyCode) {
                case 1:
                    if (event.keyCode == 27) {

                        $('#qcValidationWindow').off('keydown');
                        qcValidationWindow.jqxWindow('close');
                    }
                    break;
            }
        });

        $('#qcValidationWindow').focus();


    }


    function onVectorFeaturesSelected(isUserAction, features) {
        // select feature in project explorer if selected on viewer
        if (isUserAction) {
            if (features.length > 0) {
                var treeItems = $('#projectExplorerTree').jqxTree('getItems');
                var itemToSelect = treeItems.find(function (e) { return e.id == features[0].id });

                if (itemToSelect != null) {
                    $('#projectExplorerTree').jqxTree('expandItem', itemToSelect);
                    $('#projectExplorerTree').jqxTree('selectItem', itemToSelect);
                }
            } else {
                $('#projectExplorerTree').jqxTree('selectItem', null);

                cleanSelectedEntityDetails();
                reprojectVectorToImage([]);
            }
        }
    }

    function onVectorFeaturesModified(features) {
        if (features.length > 0) {
            $.ajax({
                url: ENTITIES_URL + '/' + features[0].id,
                method: 'PUT',
                data: JSON.stringify(features[0]),
                contentType: 'application/json'
            }).done(function (data) {
                showNotification('Changes succsessfully saved', NOTIFICATION_TYPE.SUCCESS);
            }).fail(function (error) {
                showNotification('Unable to save changes', NOTIFICATION_TYPE.ERROR);
            });
        }
    }

    function onVectorFeatureRemoved(features) {
        if (features.length > 0) {
            deleteEntity(
                features[0].id,
                function () {
                    var selectedTreeItem = $('#projectExplorerTree').jqxTree('getSelectedItem');

                    if (selectedTreeItem) {
                        $('#projectExplorerTree').jqxTree('removeItem', selectedTreeItem);

                        cleanSelectedEntityDetails();

                        var itemIndex = selectedProjectEntities.indexOf(features[0]);

                        if (itemIndex != -1) {
                            selectedProjectEntities.splice(itemIndex, 1);
                        }

                        showNotification('Project item deleted successfully', NOTIFICATION_TYPE.SUCCESS);
                    }
                },
                function (error) {
                    alert('Unable to delete project item');
                }
            );
        }
    }

    function reprojectFloorCeilingToImage(feature, isFloor, isNeedToCleanup) {
        if (isFloor == false) {
            return;
        }

        if (photoViewer != null) {
            var dx = 0;
            var dy = 0;
            var rz = 0;

            // apply vanishing points
            _rawToAlignedR = new THREE.Matrix3();
            _alignedToRawR = new THREE.Matrix3();

            if (layout3dProcessor != null) {
                var layout = layout3dProcessor.getCurrentLayout();

                if (layout && layout.photo && layout.photo.dx != null && layout.photo.dy != null && layout.photo.rz != null) {
                    dx = layout.photo.dx;
                    dy = layout.photo.dy;
                    rz = layout.photo.rz;

                    if (layout.photo.vp) {
                        try {
                            var rk = JSON.parse(layout.photo.vp);
                            if (Array.isArray(rk)) {
                                _rawToAlignedR.set(
                                    parseFloat(rk[2][0]), parseFloat(rk[2][1]), parseFloat(rk[2][2]),
                                    parseFloat(rk[1][0]), parseFloat(rk[1][1]), parseFloat(rk[1][2]),
                                    parseFloat(rk[0][0]), parseFloat(rk[0][1]), parseFloat(rk[0][2])
                                );

                                _alignedToRawR = _rawToAlignedR.clone();
                                _alignedToRawR.invert();
                            }
                        } catch {

                        }
                    }
                }
            }

            var md = photoViewer.currentMetadata;
            var rz = (Math.PI * (parseFloat(md.HotspotTheta) + rz)) / 180;
            var photoPos = new THREE.Vector3(parseFloat(md.HotspotX), - parseFloat(md.HotspotY), 0);
            photoPos.applyMatrix4(mainViewer.getTransformationMatrix());
            var photoPoint = turf.point([photoPos.x + dx, photoPos.y + dy]);

            // find room
            var roomWalls = selectedProjectEntities.filter(x => x.parentId == feature.parentId && x.typeId == 5);

            if (roomWalls.length > 0) {
                var poly = PUtilities.prototype.polygonize(roomWalls, 0.001);
                var polygon = turf.polygon([poly]);

                if (turf.booleanPointInPolygon(photoPoint, polygon)) {
                    if (isNeedToCleanup == true) {
                        clearReprojectedLayout();
                    }
                    
                    var mc = [];

                    turf.coordEach(polygon, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                        var coord = [currentCoord[0], currentCoord[1]]

                        if (isFloor) {
                            coord.push(photoViewer.floorH);
                        } else {
                            coord.push(photoViewer.ceilingH);
                        }

                        mc.push(coord);
                    }, false);

                    var f = JSON.parse(JSON.stringify(feature));
                    f.geometry = turf.multiPolygon([[mc]]).geometry;
                    f.type = 'Feature';

                    turf.coordEach(f, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                        currentCoord[0] -= (photoPos.x + dx);
                        currentCoord[1] -= (photoPos.y + dy);
                    }, false);

                    // convert XYZ to pixels
                    var size = photoViewer.getImageSize();

                    turf.coordEach(f, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                        // xyz + rozation (hotspot theta + correction of the rotation after adjustment) -> uv
                        var uv_tmp = PUtilities.prototype.xyxToUv(currentCoord[0], currentCoord[1], currentCoord[2], rz);
                        currentCoord[0] = uv_tmp[0] * size.imageWidth;
                        currentCoord[1] = -uv_tmp[1] * size.imageHeight;

                        // apply vanishing point
                        var [x, y] = PUtilities.prototype.rotatePanoramicPixel(currentCoord[0], -currentCoord[1], size.imageWidth, size.imageHeight, _alignedToRawR);
                        currentCoord[0] = x;
                        currentCoord[1] = -y;

                        // set elevation of the geometry (like z-index)
                        currentCoord[2] = 5;
                    }, false);

                    // draw wall feature
                    photoViewer.addFloor(f, { color: 'blue', width: 7, node: { radius: 5 } });

                    if (isNeedToCleanup == true) {
                        curPhotoLayoutItems = [feature];
                    } else {
                        curPhotoLayoutItems.push(features);
                    }
                }
            }
        } else {
            clearReprojectedLayout();
        }
    }

    function reprojectVectorToImage(features) {
        if (photoViewer != null && features.length > 0) {
            var dx = 0;
            var dy = 0;
            var rz = 0;

            // apply vanishing points
            _rawToAlignedR = PSULIB.PANO.buildRotationMatrix(null);
            _alignedToRawR = PSULIB.PANO.buildRotationMatrix(null);

            if (layout3dProcessor != null) {
                var layout = layout3dProcessor.getCurrentLayout();

                if (layout && layout.photo && layout.photo.dx != null && layout.photo.dy != null && layout.photo.rz != null) {
                    dx = layout.photo.dx;
                    dy = layout.photo.dy;
                    rz = layout.photo.rz;

                    if (layout.photo.vp) {
                        try {
                            var rk = JSON.parse(layout.photo.vp);
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
                }
            }

            var md = photoViewer.currentMetadata;
            var rz = - (Math.PI * (parseFloat(md.HotspotTheta) + rz)) / 180;
            var photoPos = new THREE.Vector3(parseFloat(md.HotspotX), - parseFloat(md.HotspotY), 0);
            photoPos.applyMatrix4(mainViewer.getTransformationMatrix());
            var photoPoint = turf.point([photoPos.x + dx, photoPos.y + dy]);

            // find room
            var roomWalls = selectedProjectEntities.filter(x => x.parentId == features[0].parentId);

            if (roomWalls.length > 0) {
                var poly = PUtilities.prototype.polygonize(roomWalls, 0.001);
                var polygon = turf.polygon([poly]);

                if (turf.booleanPointInPolygon(photoPoint, polygon)) {
                    clearReprojectedLayout();

                    for (var feature of features) {
                        var mc = [];

                        turf.segmentEach(feature, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
                            var lc = currentSegment.geometry.coordinates;
                            var coords = [];
                            coords.push([lc[0][0], lc[0][1], photoViewer.floorH]);
                            coords.push([lc[1][0], lc[1][1], photoViewer.floorH]);
                            coords.push([lc[1][0], lc[1][1], photoViewer.ceilingH]);
                            coords.push([lc[0][0], lc[0][1], photoViewer.ceilingH]);
                            coords.push([lc[0][0], lc[0][1], photoViewer.floorH]);
                            mc.push([coords]);
                        });

                        var f = JSON.parse(JSON.stringify(feature));
                        f.geometry = turf.multiPolygon(mc).geometry;

                        turf.coordEach(f, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                            currentCoord[0] -= (photoPos.x + dx);
                            currentCoord[1] -= (photoPos.y + dy);
                        }, false);

                        // convert XYZ to pixels
                        var size = photoViewer.getImageSize();

                        turf.coordEach(f, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                            // xyz + rozation (hotspot theta + correction of the rotation after adjustment) -> uv
                            var uv_tmp = PSULIB.PANO.xyxToUv(currentCoord[0], currentCoord[1], currentCoord[2], rz);
                            currentCoord[0] = uv_tmp[0] * size.imageWidth;
                            currentCoord[1] = -uv_tmp[1] * size.imageHeight;

                            // apply vanishing point
                            var [x, y] = PSULIB.PANO.rotatePanoramicPixel(currentCoord[0], -currentCoord[1], size.imageWidth, size.imageHeight, _alignedToRawR);
                            currentCoord[0] = x;
                            currentCoord[1] = -y;

                            // set elevation of the geometry (like z-index)
                            currentCoord[2] = 5;
                        }, false);

                        // draw wall feature
                        photoViewer.addLayout(f, { color: 'blue', width: 7, node: { radius: 5 } });
                    }

                    curPhotoLayoutItems = features;
                }
            }
        } else {
            clearReprojectedLayout();
        }
    }

    function clearReprojectedLayout() {
        if (photoViewer && curPhotoLayoutItems.length > 0) {
            for (photoLayoutItem of curPhotoLayoutItems) {
                photoViewer.removeLayout(photoLayoutItem);
            }

            curPhotoLayoutItems = [];
        }
    }

    function cleanSelectedEntityDetails() {
        if ($('#projectExplorerStages').length != 0) {
            $('#projectExplorerStages').jqxGrid('destroy');
        }

        if ($('#projectExplorerStageDetails').length != 0) {
            $('#projectExplorerStageDetails').remove();
        }
    }

    function isRightClick(event) {
        var rightclick;
        if (!event) var event = window.event;
        if (event.which) rightclick = (event.which == 3);
        else if (event.button) rightclick = (event.button == 2);
        return rightclick;
    }

    function showNotification(message, type) {
        $('#notificationMessage').text(message);
        $('#notificationWindow').jqxNotification('template', type);
        $('#notificationWindow').jqxNotification('open');
    }

    loadProjects();

    loadStageTypes();
})

