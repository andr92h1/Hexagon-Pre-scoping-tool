// viewer must have interface:
// AnnotationClassificationProcessor.prototype.viewerInterface
// +
// evetn cursormoved
// enent positionrightdown
// enent positionrightup
// enent mouseleave

function AnnotationClassificationProcessor(viewer, jqueryContainer) {

    const CLASS_ADDED_VALUE = 'a';
    const CLASS_REMOVED_VALUE = 'r';

    // validate input, where is right place to do that ???
    var vr = PUtilities.prototype.checkRequiredFields(viewer, AnnotationClassificationProcessor.prototype.viewerInterface);

    if (vr.isValid == false) {
        throw vr.msg;
    }

    var context = this;
    var _details = null;
    var _currentClassName = null;
    var _isUserInteracting = false;
    var _updatedAnnotationsDuringInteraction = [];

    // INTERFACE
    this.dispatcherDOM = document.createElement("div");

    this.isActive = false;

    this.Start = function (details) {
        reset();
        _details = details;
        buildGui(details);
        viewer.dispatcherDOM.addEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.addEventListener('positionrightdown', onPositionRightDown);
        viewer.dispatcherDOM.addEventListener('positionrightup', onPositionRightUp);
        viewer.dispatcherDOM.addEventListener('mouseleave', onMouseLeave);
        viewer.setEntitiesFilter({ classNames: [PUtilities.prototype.MULTICLASS_CLASS_NAME] });
        this.isActive = true;
    }

    this.Stop = function () {
        reset();
    }

    this.Refresh = function () {
        refreshGui();
        const range = $('#mc-confident-level-range').jqxRangeSelector('getRange');

        if (_currentClassName !== null && range) {
            filterAnnotations(_currentClassName, range.from, range.to);
        }
    }

    this.Dispose = function () {
        reset();
        delete this.dispatcherDOM;
    }

    this.noClassStyle = {
        color: "grey",
        width: 3,
        label: {
            size: 25
        }
    }

    this.hasClassStyle = {
        color: "blue",
        width: 3,
        label: {
            size: 25
        }
    }

    // EVENT
    function dispatchMultiClassModeEvent(className) {
        var event = new CustomEvent('multiclassmode', {
            detail: {
                className: className
            }
        });

        context.dispatcherDOM.dispatchEvent(event);
    }

    function dispatchMultiClassChanged(annotation) {
        var event = new CustomEvent('multiclasschanged', {
            detail: {
                annotation: annotation
            }
        });

        context.dispatcherDOM.dispatchEvent(event);
    }

    function dispatchMultiClassChangingFinished(affectedAnnotations) {
        var event = new CustomEvent('multiclasschangingfinished', {
            detail: {
                annotations: affectedAnnotations
            }
        });

        context.dispatcherDOM.dispatchEvent(event);
    }

    // HELPER
    function onCursorMoved(e) {
        if (_isUserInteracting && _currentClassName !== null) {
            proceedInteraction(e.detail.position.x, e.detail.position.y);
        }
    }

    function onPositionRightDown(e) {
        if (isEditingMode() && _currentClassName !== null) {
            _updatedAnnotationsDuringInteraction = [];
            _isUserInteracting = true;
            proceedInteraction(e.detail.position.x, e.detail.position.y);
        }
    }

    function onPositionRightUp(e) {
        if (isEditingMode() && _currentClassName !== null) {
            proceedFinishInteraction();
        }
    }

    function onMouseLeave(e) {
        if (isEditingMode() && _currentClassName !== null) {
            proceedFinishInteraction();
        }
    }

    function proceedInteraction(x, y) {
        const annotations = getMultiClassAnnotations();
        const p = turf.point([x, y]);

        for (var a of annotations) {
            if (typeof _updatedAnnotationsDuringInteraction[a.id] != 'undefined') {
                continue;
            }

            var result = turf.pointsWithinPolygon(p, a);

            if (result.features.length === 0) {
                continue;
            }

            _updatedAnnotationsDuringInteraction[a.id] = a;
            const details = JSON.parse(a.details);

            if (details.mc[_currentClassName]) {
                // class is present in details
                if (details.mc[_currentClassName].v === 0) {
                    details.mc[_currentClassName].v = 1;

                    if (typeof details.mc[_currentClassName].c == 'undefined') {
                        details.mc[_currentClassName].c = 1;
                    }

                    details.mc[_currentClassName].m = CLASS_ADDED_VALUE;
                } else {
                    details.mc[_currentClassName].v = 0;
                    details.mc[_currentClassName].m = CLASS_REMOVED_VALUE;
                }
            } else {
                // class is missing in details
                details.mc[_currentClassName] = {
                    v: 1,
                    c: 1,
                    m: CLASS_ADDED_VALUE
                }
            }

            // call viewer.updateEntities also updates feature in the viewer.featureCollection
            a.details = JSON.stringify(details);

            if (details.mc[_currentClassName].v === 1) {
                viewer.updateEntities([a], context.hasClassStyle, details.mc[_currentClassName].c.toFixed(2));
            } else {
                viewer.updateEntities([a], context.noClassStyle, "");
            }

            // raise event
            dispatchMultiClassChanged(a);
        }
    }

    function proceedFinishInteraction() {
        _isUserInteracting = false;
        dispatchMultiClassChangingFinished(_updatedAnnotationsDuringInteraction);
        _updatedAnnotationsDuringInteraction = [];
    }

    function buildGui(details) {
        destroyGui();

        // confident level range
        jqueryContainer.append('<div id="mc-confident-level-range"></div>');
        $("#mc-confident-level-range").jqxRangeSelector({
            width: 'calc(100% - 40px)',
            height: 25,
            min: 0.0,
            max: 1.01,
            labelsOnTicks: false,
            majorTicksInterval: 0.1,
            minorTicksInterval: 0.01,
            disabled: true
        });

        $('#mc-confident-level-range').on('change', function (e) {
            if (e.args && _currentClassName !== null) {
                filterAnnotations(_currentClassName, e.args.from, e.args.to);
            }
        });

        // edit button
        var editButton = $('<input id="mc-edit-button" type="button" style="margin-top: 10px;" value="Editing Off"/>');
        jqueryContainer.append(editButton);
        $('#mc-edit-button').jqxToggleButton({
            width: 'calc(100% - 10px)',
            toggled: false
        });

        $("#mc-edit-button").on('click', function () {
            if (isEditingMode()) {
                $("#mc-edit-button")[0].value = 'Editing On';
            } else {
                $("#mc-edit-button")[0].value = 'Editing Off';
            }
        });

        $('#mc-edit-button').jqxToggleButton({ disabled: true });

        // list of classes
        var classElem = $('<div id="mc-list"></div>');

        for (var c of details.classes) {
            classElem.append('<div class="mc-item-radio-button" style="margin-top: 5px;" data-class-name="' + c.alias + '"><div class="mc-item-caption" data-class-name="' + c.alias + '">' + compileClassDisplayName(c) + '</div></div>');
        }

        jqueryContainer.append(classElem);

        $(".mc-item-radio-button").jqxRadioButton({ width: '90%', height: 25 });

        $(".mc-item-radio-button").on('change', function (e) {
            if (e.args.checked) {

                if ($('#mc-confident-level-range').jqxRangeSelector('disabled')) {
                    $('#mc-confident-level-range').jqxRangeSelector({ disabled: false });
                }

                if ($('#mc-edit-button').jqxToggleButton('disabled')) {
                    $('#mc-edit-button').jqxToggleButton({ disabled: false });
                }

                _currentClassName = this.dataset.className;
                const range = $('#mc-confident-level-range').jqxRangeSelector('getRange');
                filterAnnotations(_currentClassName, range.from, range.to);
                dispatchMultiClassModeEvent(_currentClassName);
            }
        });

        // update range of confident levels for each class
        refreshGui();
    }

    function refreshGui() {

        // get multiclass annotations
        var annotations = getMultiClassAnnotations();

        // build statistic
        var stat = {};

        for (var a of annotations) {
            var classes = JSON.parse(a.details);

            if (classes.mc) {
                for (var className in classes.mc) {
                    if (classes.mc[className].v === 1) {
                        if (!stat[className]) {
                            stat[className] = {
                                min: classes.mc[className].c,
                                max: classes.mc[className].c,
                                count: 1
                            };
                        } else {
                            stat[className].min = Math.min(stat[className].min, classes.mc[className].c);
                            stat[className].max = Math.max(stat[className].max, classes.mc[className].c);
                            stat[className].count++;
                        }
                    }
                }
            }
        }

        // update GUI
        for (var c of _details.classes) {
            var caption = jqueryContainer.find('.mc-item-caption[data-class-name="' + c.alias + '"]');

            if (caption.length > 0) {
                if (stat[c.alias]) {
                    caption.text(compileClassDisplayName(c) + ' [' + stat[c.alias].min.toFixed(2) + ';' + stat[c.alias].max.toFixed(2) + ']');
                } else {
                    caption.text(compileClassDisplayName(c));
                }
            }
        }
    }

    function destroyGui() {
        if ($('#mc-confident-level-range').length > 0) {
            $('#mc-confident-level-range').jqxRangeSelector('destroy');
        }

        if ($('#mc-edit-button').length > 0) {
            $('#mc-edit-button').jqxToggleButton('destroy');
        }

        if ($(".mc-item-radio-button").length > 0) {
            $(".mc-item-radio-button").jqxRadioButton('destroy');
        }

        jqueryContainer.empty();
    }

    function isEditingMode() {
        return $("#mc-edit-button").jqxToggleButton('toggled');
    }

    function compileClassDisplayName(classDetails) {
        return classDetails.alias + ' ' + classDetails.name;
    }

    function filterAnnotations(className, minConfidentLevel, maxConfidentLevel) {
        // get multiclass annotations
        var annotations = getMultiClassAnnotations();

        // change style of annotation if has style
        for (var a of annotations) {
            var classes = JSON.parse(a.details);

            if (classes.mc && classes.mc[className] && classes.mc[className].v === 1 && classes.mc[className].c >= minConfidentLevel && classes.mc[className].c <= maxConfidentLevel) {
                viewer.updateEntities([a], context.hasClassStyle, classes.mc[className].c.toFixed(2));
            } else {
                viewer.updateEntities([a], context.noClassStyle, "");
            }
        }
    }

    function reset() {
        _currentClassName = null;
        viewer.setCursorType('default');
        viewer.dispatcherDOM.removeEventListener('cursormoved', onCursorMoved);
        viewer.dispatcherDOM.removeEventListener('positionrightdown', onPositionRightDown);
        viewer.dispatcherDOM.removeEventListener('positionrightup', onPositionRightUp);
        viewer.dispatcherDOM.removeEventListener('mouseleave', onMouseLeave);
        destroyGui();
        this.isActive = false;

        // reset style of the annotations
        var annotations = getMultiClassAnnotations();
        viewer.updateEntities(annotations, viewer.styleDefault);

        // reset filters
        viewer.setEntitiesFilter(viewer.getDefaultFilter());
    }

    function getMultiClassAnnotations(isReverse = false) {

        var result = [];

        for (var item of viewer.featureCollection.features) {

            var vr = PUtilities.prototype.checkRequiredFields(item, PhotoViewer.prototype.annotationInterface);

            if (vr.isValid !== true) {
                continue;
            }

            if (item.className == PUtilities.prototype.MULTICLASS_CLASS_NAME) {
                if (isReverse == false) {
                    result.push(item);
                }
            } else {
                if (isReverse) {
                    result.push(item);
                }
            }
        }

        return result;
    }

}

AnnotationClassificationProcessor.prototype.viewerInterface = ['showInfoMsg', 'dispatcherDOM', 'featureCollection', 'updateEntities', 'setEntitiesFilter', 'getDefaultFilter'];