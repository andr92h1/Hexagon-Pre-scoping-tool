// viewer must have interface:
// AnnotationGeneralProcessor.prototype.viewerInterface
// +
// event cursormoved
// enent positionrightdown
// enent positionrightup
// enent mouseleave

function AnnotationGeneralProcessor(viewer, jqueryContainer) {

    // validate input, where is right place to do that ???
    var vr = PUtilities.prototype.checkRequiredFields(viewer, AnnotationGeneralProcessor.prototype.viewerInterface);

    if (vr.isValid == false) {
        throw vr.msg;
    }

    var context = this;
    var _isUserInteracting = false;
    var _filter = viewer.getDefaultFilter();

    // INTERFACE
    this.dispatcherDOM = document.createElement("div");

    this.isActive = false;

    this.Start = function () {
        reset();
        buildGui();
        viewer.dispatcherDOM.addEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.addEventListener('positionrightdown', onPositionRightDown);
        viewer.dispatcherDOM.addEventListener('positionrightup', onPositionRightUp);
        viewer.dispatcherDOM.addEventListener('mouseleave', onMouseLeave);
        _filter = viewer.getDefaultFilter();
        viewer.setEntitiesFilter(_filter);
        this.isActive = true;
    }

    this.Stop = function () {
        reset();
    }

    this.Refresh = function () {
        refreshGui();
    }

    this.Dispose = function () {
        reset();
        delete this.dispatcherDOM;
    }

    // EVENT
    function dispatchFilterChangedEvent(filter) {
        var event = new CustomEvent('filterchanged', {
            detail: {
                filter: filter
            }
        });

        context.dispatcherDOM.dispatchEvent(event);
    }

    // HELPER
    function onCursorMoved(e) {
        if (_isUserInteracting) {
            // do something...
        }
    }

    function onPositionRightDown(e) {
        _isUserInteracting = true;
    }

    function onPositionRightUp(e) {
        _isUserInteracting = false;
    }

    function onMouseLeave(e) {
        _isUserInteracting = false;
    }

    function buildGui(details) {
        destroyGui();

        // confident level range
        jqueryContainer.append('<div id="gen-confident-level-range"></div>');

        $("#gen-confident-level-range").jqxRangeSelector({
            width: 'calc(100% - 40px)',
            height: 25,
            min: 0.0,
            max: 1.01,
            range: { from: 0.0, to: 1.0 },
            labelsOnTicks: false,
            majorTicksInterval: 0.1,
            minorTicksInterval: 0.01,
        });

        $('#gen-confident-level-range').on('change', function (e) {
            if (e.args) {
                _filter.confidentLevelMin = e.args.from;
                _filter.confidentLevelMax = e.args.to;
                viewer.setEntitiesFilter(_filter);
            }
        });

        // show all btn
        jqueryContainer.append($('<input id="gen-show-all-button" type="button" style="margin-top: 2%; margin-left: 2%;" value="Show all"/>'));

        $('#gen-show-all-button').jqxButton({
            width: 'calc(100% - 4%)'
        });

        $('#gen-show-all-button').on('click', function (e) {
            // reset confident level filter
            $("#gen-confident-level-range").jqxRangeSelector('setRange', 0.0, 1.0);

            // update viewer
            _filter = viewer.getDefaultFilter();
            viewer.setEntitiesFilter(_filter);
            refreshGui();
        });

        // add labels filter
        jqueryContainer.append($('<div id="gen-labels-list" style="margin-top: 2%; margin-left: 2%;"></div>'));

        $("#gen-labels-list").jqxListBox({
            source: [],
            multiple: true,
            width: 'calc(100% - 4%)',
            height: 150
        });

        $('#gen-labels-list').on('select', onLabelSelect);

        $('#gen-labels-list').on('unselect', onLabelUnselect);

        // class names filter
        jqueryContainer.append($('<div id="gen-class-names-list" style="margin-top: 2%; margin-left: 2%;"></div>'));

        $("#gen-class-names-list").jqxListBox({
            source: [],
            multiple: true,
            width: 'calc(100% - 4%)',
            height: 500
        });

        $('#gen-class-names-list').on('select', onClassNameSelect);

        $('#gen-class-names-list').on('unselect', onClassNameUnselect);

        // update lists
        refreshGui();
    }

    function onLabelSelect(event) {
        var args = event.args;
        if (args) {
            var item = args.item;
            var value = item.value;

            if (_filter.labels == null) {
                _filter.labels = [];
            }

            if (_filter.labels.indexOf(value) == -1) {
                _filter.labels.push(value);
            }

            viewer.setEntitiesFilter(_filter);
        }
    }

    function onLabelUnselect(event) {
        var args = event.args;
        if (args) {
            var item = args.item;
            var value = item.value;

            if (_filter.labels != null) {
                var index = _filter.labels.indexOf(value);

                if (index != -1) {
                    _filter.labels.splice(index, 1);
                }

                if (_filter.labels.length == 0) {
                    _filter.labels = null;
                }
            }

            viewer.setEntitiesFilter(_filter);
        }
    }

    function onClassNameSelect(event) {
        var args = event.args;
        if (args) {
            var item = args.item;
            var value = item.value;

            if (_filter.classNames == null) {
                _filter.classNames = [];
            }

            if (_filter.classNames.indexOf(value) == -1) {
                _filter.classNames.push(value);
            }

            viewer.setEntitiesFilter(_filter);
        }
    }

    function onClassNameUnselect(event) {
        var args = event.args;
        if (args) {
            var item = args.item;
            var value = item.value;

            if (_filter.classNames != null) {
                var index = _filter.classNames.indexOf(value);

                if (index != -1) {
                    _filter.classNames.splice(index, 1);
                }

                if (_filter.classNames.length == 0) {
                    _filter.classNames = null;
                }
            }

            viewer.setEntitiesFilter(_filter);
        }
    }

    function refreshGui() {

        // build lists
        var labels = [];
        var classNames = [];

        for (var f of viewer.featureCollection.features) {
            if (typeof f.label != 'undefined' && labels.indexOf(f.label) == -1) {
                labels.push(f.label);
            }

            if (typeof f.className != 'undefined' && classNames.indexOf(f.className) == -1) {
                classNames.push(f.className);
            }
        }

        labels.sort();
        classNames.sort();

        // update label
        $('#gen-labels-list').off('unselect', onLabelUnselect); // prevent filter modification

        $('#gen-labels-list').jqxListBox('source', labels);

        if (_filter.labels != null) {
            for (var label of _filter.labels) {
                var labelIndex = labels.indexOf(label);

                if (labelIndex != -1) {
                    $("#gen-labels-list").jqxListBox('selectIndex', labelIndex);
                }
            }
        }

        $('#gen-labels-list').on('unselect', onLabelUnselect);

        // update class name
        $('#gen-class-names-list').off('unselect', onClassNameUnselect); // prevent filter modification

        $('#gen-class-names-list').jqxListBox('source', classNames);

        if (_filter.classNames != null) {
            for (var className of _filter.classNames) {
                var classNameIndex = classNames.indexOf(className);

                if (classNameIndex != -1) {
                    $("#gen-class-names-list").jqxListBox('selectIndex', classNameIndex);
                }
            }
        }

        $('#gen-class-names-list').on('unselect', onClassNameUnselect);

    }

    function destroyGui() {
        if ($('#gen-confident-level-range').length > 0) {
            $('#gen-confident-level-range').jqxRangeSelector('destroy');
        }

        if ($('#gen-show-all-button').length > 0) {
            $('#gen-show-all-button').jqxButton('destroy');
        }

        if ($('#gen-labels-list').length > 0) {
            $('#gen-labels-list').jqxButton('destroy');
            $('#gen-labels-list').off('select', onLabelSelect);
            $('#gen-labels-list').off('unselect', onLabelUnselect);
        }

        if ($('#gen-class-names-list').length > 0) {
            $('#gen-class-names-list').jqxButton('destroy');
            $('#gen-class-names-list').off('select', onClassNameSelect);
            $('#gen-class-names-list').off('unselect', onClassNameUnselect);
        }

        jqueryContainer.empty();
    }

    function reset() {
        viewer.setCursorType('default');
        viewer.dispatcherDOM.removeEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.removeEventListener('positionrightdown', onPositionRightDown);
        viewer.dispatcherDOM.removeEventListener('positionrightup', onPositionRightUp);
        viewer.dispatcherDOM.removeEventListener('mouseleave', onMouseLeave);
        destroyGui();
        this.isActive = false;

        // reset filters
        viewer.setEntitiesFilter(viewer.getDefaultFilter());
    }

}

AnnotationGeneralProcessor.prototype.viewerInterface = ['showInfoMsg', 'dispatcherDOM', 'featureCollection', 'updateEntities', 'setEntitiesFilter', 'getDefaultFilter'];