// viewer must have interface:
// FloorPlanSync.prototype.viewerInterface
// +
// event entitiespicked
// event unselectall
// enent positionleftdown
// enent positionleftup
// event cursormoved
function VectorModifier(viewer) {

    // validate input, where is right place to do that ???
    var vr = PUtilities.prototype.checkRequiredFields(viewer, VectorModifier.prototype.viewerInterface);

    if (vr.isValid == false) {
        throw vr.msg;
    }

    var _entities = [];
    var _context = this;
    var _positionTolerancy = 0.25;
    var _editing = [];
    var _isIgnoreNextUnselectAll = false; // required for adding/removing vertixes

    // INTERFACE
    this.dispatcherDOM = document.createElement("div");

    this.getEditingFeatures = function () {
        return _editing;
    }

    this.Start = function (positionTolerancy = 0.25) {

        reset();

        _positionTolerancy = positionTolerancy;

        viewer.dispatcherDOM.addEventListener('entitiespicked', onEntitiesPicked);
        viewer.dispatcherDOM.addEventListener('unselectall', onUnselectAll);
        viewer.dispatcherDOM.addEventListener('positionleftdown', onPositionLeftDown);
        viewer.dispatcherDOM.addEventListener('positionleftup', onPositionLeftUp);
        viewer.dispatcherDOM.addEventListener('cursormoved', onCursorMoved);
    }

    this.Stop = function () {
        reset();
    }

    this.Dispose = function () {
        reset();
        delete this.dispatcherDOM;
    }

    this.Add = function (entities) {

        var affected = add(entities);

        if (affected != 0) {
            dispatchEntitiesSetChanged();
        }

    }

    this.Remove = function (entities) {

        var affected = remove(entities);

        if (affected > 0) {
            dispatchEntitiesSetChanged();
        }

    }

    this.RemoveAll = function () {

        if (_entities.length > 0) {
            removeAll();
            dispatchEntitiesSetChanged();
        }
    }

    // EVENT
    function dispatchEntitiesSetChanged(isUserAction = false) {

        var event = new CustomEvent('entitiessetchanged', {
            detail: {
                entities: _entities,
                isUserAction: isUserAction
            }
        });

        _context.dispatcherDOM.dispatchEvent(event);
    }

    function dispatchEntitiesChanged(entities) {

        var event = new CustomEvent('entitieschanged', {
            detail: {
                entities: entities
            }
        });

        _context.dispatcherDOM.dispatchEvent(event);
    }

    function dispatchEntitiesRemoved(entities) {

        var event = new CustomEvent('entitiesremoved', {
            detail: {
                entities: entities
            }
        });

        _context.dispatcherDOM.dispatchEvent(event);
    }

    // HELPER
    function onEntitiesPicked(e) {

        var hasNewEntity = false;

        for (var item in e.detail.entities) {
            var index = getEntityIndex(item);

            if (index == -1) {
                hasNewEntity = true;
                break;
            }
        }

        if (hasNewEntity) {
            if (e.detail.shiftKey == false) {
                removeAll();
            }

            add(e.detail.entities);
        }

        if (hasNewEntity) {
            dispatchEntitiesSetChanged(true);
        }
    }

    function onUnselectAll(e) {

        // ignore unselect all if ware operations add/remove vertices 
        if (_isIgnoreNextUnselectAll == true) {
            _isIgnoreNextUnselectAll = false;
            return;
        }

        if (_entities.length > 0) {
            removeAll();
            dispatchEntitiesSetChanged(true);
        }
    }

    function onPositionLeftDown(e) {

        if (_entities.length > 0) {

            if (e.detail.ctrlKey) {
                // add extra vertex
                _isIgnoreNextUnselectAll = true;

                var updatedEntities = [];

                for (var item of _entities) {
                    var p = PUtilities.prototype.getProjectionOnEntity(item, e.detail.position);

                    if (p) {
                        if (p.properties.d < _positionTolerancy) {
                            PUtilities.prototype.addVertex(item, p.properties.index, new THREE.Vector3(p.geometry.coordinates[0], p.geometry.coordinates[1], 0));
                            updatedEntities.push(item);
                        }
                    }
                }

                if (updatedEntities.length > 0) {
                    viewer.updateEntities(updatedEntities, viewer.styleForEditing);
                    dispatchEntitiesChanged(updatedEntities);
                }

            } else if (e.detail.altKey) {
                // remove vertex
                _isIgnoreNextUnselectAll = true;

                var updatedEntities = [];
                var removedEntities = [];

                for (var item of _entities) {
                    var result = PUtilities.prototype.getClosestVertex(item, e.detail.position.x, e.detail.position.y);

                    if (result.i != -1 && result.d < _positionTolerancy) {
                        var result = PUtilities.prototype.removeVertex(item, result.i);

                        if (result.isValid) {
                            updatedEntities.push(item);
                        } else {
                            removedEntities.push(item);
                        }

                    }
                }

                if (updatedEntities.length > 0) {
                    viewer.updateEntities(updatedEntities, viewer.styleForEditing);
                    dispatchEntitiesChanged(updatedEntities);
                }

                if (removedEntities.length > 0) {
                    viewer.removeEntities(removedEntities);
                    dispatchEntitiesRemoved(removedEntities);
                }

            } else {
                // start vertix editing
                _editing = [];

                for (var item of _entities) {
                    var result = PUtilities.prototype.getClosestVertex(item, e.detail.position.x, e.detail.position.y); // getClosestVertex(item, e.detail.position);

                    if (result.i != -1 && result.d < _positionTolerancy) {
                        _editing.push({ index: result.i, multiFeatureIndex: result.mfi, entity: item, isChanged: false });
                    }
                }

                if (_editing.length > 0) {
                    viewer.isPanningFrozen = true;
                }
            }
        }
    }

    function onPositionLeftUp(e) {

        viewer.isPanningFrozen = false;

        if (_editing.length > 0) {

            var updatedEntities = _editing.filter(value => value.isChanged).map(function (e) { return e.entity });

            if (updatedEntities.length > 0) {
                dispatchEntitiesChanged(updatedEntities);
            }

            _editing = [];
        }
    }

    function onCursorMoved(e) {

        if (_editing.length > 0) {
            _isIgnoreNextUnselectAll = false;

            for (var item of _editing) {
                PUtilities.prototype.updateEntityVertex(item.entity, item.index, item.multiFeatureIndex, e.detail.position.x, e.detail.position.y);
                viewer.updateEntities([item.entity], viewer.styleForEditing);
                item.isChanged = true;
            }
        }
    }

    function reset() {

        _context.RemoveAll();

        viewer.dispatcherDOM.removeEventListener('entitiespicked', onEntitiesPicked);
        viewer.dispatcherDOM.removeEventListener('unselectall', onUnselectAll);
        viewer.dispatcherDOM.removeEventListener('positionleftdown', onPositionLeftDown);
        viewer.dispatcherDOM.removeEventListener('positionleftup', onPositionLeftUp);
        viewer.dispatcherDOM.removeEventListener('cursormoved', onCursorMoved);
    }

    function getEntityIndex(entity) {

        for (var i = 0; i < _entities.length; i++) {
            if (_entities[i].id == entity.id) {
                return i;
            }
        }

        return -1;
    }

    function removeAll() {
        viewer.updateEntities(_entities, viewer.styleDefault);
        _entities = [];
    }

    function remove(entities) {

        var affected = 0;

        for (var i = 0; i < entities.length; i++) {
            for (var j = 0; j < _entities.length; j++) {
                if (entities[i].id == _entities[j].id) {
                    viewer.updateEntities([_entities[j]], viewer.styleDefault);
                    _entities.splice(j, 1);
                    j--;
                    affected++;
                }
            }
        }

        return affected;
    }

    function add(entities) {

        var affected = 0;

        for (var e of entities) {
            var index = getEntityIndex(e);

            if (index == -1) {
                _entities.push(e);
                viewer.updateEntities([e], viewer.styleForEditing);
                affected++;
            }
        }

        return affected;
    }

}

VectorModifier.prototype.viewerInterface = [
    'dispatcherDOM',
    'styleForEditing',
    'styleDefault',
    'isPanningFrozen',
    'updateEntities',
    'removeEntities'
];