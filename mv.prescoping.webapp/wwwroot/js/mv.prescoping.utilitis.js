function PUtilities() { }

PUtilities.prototype.MULTICLASS_CLASS_NAME = 'MULTICLASS';

PUtilities.prototype.PREDICTION_TYPES = {
    BBOX: 'bbox',
    SEGMENTATION: 'segmentation',
    CLASSIFICATION: 'classification'
};

PUtilities.prototype.polygonize = function polygonize(entities, pt) {

    var tmp = [];
    var v = [];

    // preparation
    for (var item of entities) {
        var type = turf.getType(item);

        if (type != 'LineString') {
            continue;
        }

        var c = turf.getCoords(item);

        tmp.push({
            xs: c[0][0],
            ys: c[0][1],
            xe: c[c.length - 1][0],
            ye: c[c.length - 1][1],
            e: item
        });
    }

    // build links
    var fe = tmp.shift();
    var fc = turf.getCoords(fe.e);
    v = JSON.parse(JSON.stringify(fc));

    while (tmp.length > 0) {
        var xs = v[0][0];
        var ys = v[0][1];
        var xe = v[v.length - 1][0];
        var ye = v[v.length - 1][1];

        // end to start
        var etosi = tmp.findIndex(e => Math.abs(xe - e.xs) < pt && Math.abs(ye - e.ys) < pt);
        var stosi = tmp.findIndex(e => Math.abs(xs - e.xs) < pt && Math.abs(ys - e.ys) < pt);

        if (etosi != -1 || stosi != -1) {
            var index = etosi != -1 ? etosi : stosi;

            if (etosi == -1) {
                v.reverse(); // make etos case
            }

            var c = turf.getCoords(tmp[index].e);

            for (var i = 1; i < c.length; i++) {
                v.push(c[i]);
            }

            tmp.splice(index, 1);
            continue;
        }

        // end to end case
        var etoei = tmp.findIndex(e => Math.abs(xe - e.xe) < pt && Math.abs(ye - e.ye) < pt);
        var stoei = tmp.findIndex(e => Math.abs(xs - e.xe) < pt && Math.abs(ys - e.ye) < pt);

        if (etoei != -1 || stoei != -1) {
            var index = etoei != -1 ? etoei : stoei;

            if (etoei == -1) {
                v.reverse(); // make etoe case
            }

            var c = turf.getCoords(tmp[index].e);

            for (var i = c.length - 2; i >= 0; i--) {
                v.push(c[i]);
            }

            tmp.splice(index, 1);
            continue;
        }

        // connection does not detected - abort analisys
        break;
    }

    // if first and last points are equal - build polygon
    if (Math.abs(v[0][0] - v[v.length - 1][0]) < pt && Math.abs(v[0][1] - v[v.length - 1][1]) < pt) {
        return v;
    } else {
        null;
    }
}

PUtilities.prototype.checkRequiredFields = function (obj, requiredProperties) {

    var result = { isValid: true, msg: '' };

    for (var p of requiredProperties) {
        if (typeof obj[p] == 'undefined') {

            result.isValid = false;
            result.msg = 'Invalid object signature, missing required field ' + p;

            return result;
        }
    }

    return result;

}

PUtilities.prototype.direction = function (dx, dy) {

    var dir = null;

    if (dy == 0) {
        if (dx > 0) {
            dir = 90;
        }
        else {
            dir = 270;
        }

    }
    else {
        var rumbRad = Math.abs(Math.atan(dx / dy));
        var rumb = (rumbRad * 180) / Math.PI;

        if (dy > 0) {
            if (dx == 0) {
                dir = 0;
            }
            else {
                if (dx > 0) {
                    dir = rumb;
                }
                else {
                    dir = 360 - rumb;
                }
            }
        }
        else {
            if (dx == 0) {
                dir = 180;
            }
            else {
                if (dx > 0) {
                    dir = 180 - rumb;
                }
                else {
                    dir = 180 + rumb;
                }
            }
        }
    }

    return dir * Math.PI / 180;
}

PUtilities.prototype.calculateTransform2D = function (pm1, ps1, pm2, ps2) {
    // in XY plane
    // primitive... we will improve later

    // 1. remove offset ps1
    var m1 = new THREE.Matrix4();
    m1.makeTranslation(-ps1.x, -ps1.y, -ps1.z);

    // 2. rotate
    var m2 = new THREE.Matrix4();

    var vm = pm2.clone();
    vm.sub(pm1);
    var dirm = PUtilities.prototype.direction(vm.x, vm.y);

    var vs = ps2.clone();
    vs.sub(ps1);
    var dirs = PUtilities.prototype.direction(vs.x, vs.y);

    var r = dirs - dirm;

    m2.makeRotationAxis(new THREE.Vector3(0, 0, 1), r);

    // 3. apply scale
    var m3 = new THREE.Matrix4();

    var lm = vm.length();
    var ls = vs.length();
    var s = lm / ls;

    m3.makeScale(s, s, s);

    // 4. add affset pm1
    var m4 = new THREE.Matrix4();
    m4.makeTranslation(pm1.x, pm1.y, pm1.z);

    //// 4. add offset ps1
    //var m4 = new THREE.Matrix4();
    //m4.makeTranslation(ps1.x, ps1.y, ps1.z);

    //// 5. remove diff between pm1 and ps1
    //var m5 = new THREE.Matrix4();

    //var t = ps1.clone();
    //t.sub(pm1);

    //m5.makeTranslation(t.x, t.y, t.z);

    // calculate matrix
    var m = new THREE.Matrix4();
    m.premultiply(m1);
    m.premultiply(m2);
    m.premultiply(m3);
    m.premultiply(m4);
/*    m.premultiply(m5);*/
    return m;
}

PUtilities.prototype.calculateTransformScaleOnly = function (p1, p2, distance) {

    var m = new THREE.Matrix4();
    var vm = p2.clone();
    vm.sub(p1);
    var l = vm.length();
    var s = distance / l;
    m.makeScale(s, s, s);
    return m;
}

PUtilities.prototype.geoJsonToVector3Array = function (geoJson) {
    var vertices = [];

    turf.coordEach(geoJson, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
        vertices.push(new THREE.Vector3(currentCoord[0], currentCoord[1], (currentCoord.length > 2) ? currentCoord[2] : 0));
    }, false);

    return vertices;
}

PUtilities.prototype.dirToVector3 = function (dir) {
    return new THREE.Vector3(Math.sin(dir), Math.cos(dir), 0);
}

PUtilities.prototype.hasProjectionToLine = function (startLine, endLine, checkPoint) {
    var expr1 = (checkPoint[0] - startLine[0]) * (endLine[0] - startLine[0]) + (checkPoint[1] - startLine[1]) * (endLine[1] - startLine[1]);
    var expr2 = Math.pow((endLine[0] - startLine[0]), 2) + Math.pow((endLine[1] - startLine[1]), 2);

    if (0 <= expr1 && expr1 < expr2) {
        return true;
    } else {
        return false;
    }
}

PUtilities.prototype.getProjectionToLine = function (startLine, endLine, checkPoint) {
    var x = endLine[1] - startLine[1];
    var y = startLine[0] - endLine[0];
    var L = (startLine[0] * endLine[1] - endLine[0] * startLine[1] + startLine[1] * checkPoint[0] - endLine[1] * checkPoint[0] + endLine[0] * checkPoint[1] - startLine[0] * checkPoint[1]) / (x * (endLine[1] - startLine[1]) + y * (startLine[0] - endLine[0]));
    return [checkPoint[0] + x * L, checkPoint[1] + y * L];
}

PUtilities.prototype.getClosestVertex = function (feature, x, y) {

    var i = -1;
    var mfi = -1;
    var d = 1000000;
    var multiFeatureCoordinateIndex = 0;
    var currectMultiFeatureIndex = 0;

    turf.coordEach(feature, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {

        if (currectMultiFeatureIndex != multiFeatureIndex) {
            multiFeatureCoordinateIndex = 0;
            currectMultiFeatureIndex = multiFeatureIndex;
        }

        var td = Math.sqrt(Math.pow(currentCoord[0] - x, 2) + Math.pow(currentCoord[1] - y, 2));

        if (td < d) {
            i = multiFeatureCoordinateIndex;
            mfi = multiFeatureIndex;
            d = td;
        }

        multiFeatureCoordinateIndex++;

    }, false);

    return { i, mfi, d }

}

PUtilities.prototype.updateEntityVertex = function (feature, index, multiFeatureIndex, x, y) {

    var type = turf.getType(feature);

    if (type == 'LineString') {

        feature.geometry.coordinates[index][0] = x;
        feature.geometry.coordinates[index][1] = y;

    } else if (type == 'Polygon') {

        feature.geometry.coordinates[0][index][0] = x;
        feature.geometry.coordinates[0][index][1] = y;

        var l = feature.geometry.coordinates[0].length;

        if (index == 0) {
            feature.geometry.coordinates[0][l - 1][0] = x;
            feature.geometry.coordinates[0][l - 1][1] = y;
        } else if (index == l - 1) {
            feature.geometry.coordinates[0][0][0] = x;
            feature.geometry.coordinates[0][0][1] = y;
        }

    }

}

//PUtilities.prototype.uvToXyz = function (u, v, h, rz = 0) {
//    // add analis for extrym cases!!!!
//    var dz = (0.5 - u) * Math.PI * 2;
//    var dx = (0.5 - v) * Math.PI;
//    var euler = new THREE.Euler(dx, 0, dz + rz, 'ZXY');
//    var tv = new THREE.Vector3(0, 1, 0);
//    tv.applyEuler(euler);
//    tv.multiplyScalar(Math.abs(h / tv.z)); // scale up/down to h
//    return tv;
//}

//PUtilities.prototype.xyxToUv = function (x, y, z, rz = 0) {
//    // add analis for extrym cases for v!!!
//    var u;

//    if (x == 0 && y == 0) {
//        u = 0.5;
//    } else if (x == 0 && y == 1) {
//        u = 0.5;
//    } else if (x == 0 && y == -1) {
//        u = 0.0;
//    } else if (x == -1 && y == 0) {
//        u = 0.25;
//    } else if (x == 1 && y == 0) {
//        u = 0.75;
//    } else {
//        if (y > 0) {
//            u = 0.5 + Math.atan(x / y) / (Math.PI * 2);
//        }
//        else {
//            if (x > 0) {
//                u = 0.5 + (Math.PI + Math.atan(x / y)) / (Math.PI * 2);
//            }
//            else {
//                u = 0.5 + (-Math.PI + Math.atan(x / y)) / (Math.PI * 2);
//            }
//        }
//    }

//    // apply correction due to ratation
//    u += rz / (Math.PI * 2);

//    if (u > 1) {
//        u--;
//    } else if (u < 0) {
//        u++;
//    }

//    var v = 0.5 - Math.atan(z / Math.sqrt(x * x + y * y)) / Math.PI;

//    return [u, v];
//}

PUtilities.prototype.getProjectionOnEntity = function (entity, vector3) {

    var candidates = [];

    turf.segmentEach(entity, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
        var ps = currentSegment.geometry.coordinates[0];
        var pe = currentSegment.geometry.coordinates[1];
        var p = vector3.toArray();

        if (PUtilities.prototype.hasProjectionToLine(ps, pe, p) == true) {
            var pp = PUtilities.prototype.getProjectionToLine(ps, pe, p);
            var d = Math.sqrt(Math.pow(pp[0] - p[0], 2) + Math.pow(pp[1] - p[1], 2));
            candidates.push(turf.point(pp, { d: d, index: segmentIndex, mfi: multiFeatureIndex }));
        }
    });

    candidates.sort((a, b) => a.properties.d > b.properties.d && 1 || -1);

    return candidates.length > 0 ? candidates[0] : null;
}

PUtilities.prototype.addVertex = function (feature, index, vertex, multiFeatureIndex = 0) {

    var type = turf.getType(feature);

    if (type == 'LineString') {
        feature.geometry.coordinates.splice(index + 1, 0, [vertex.x, vertex.y, vertex.z]);
    } else if (type == 'Polygon') {
        feature.geometry.coordinates[0].splice(index + 1, 0, [vertex.x, vertex.y, vertex.z]);
    } else {
        throw 'Unsupported geom type: ' + type;
    }
}

PUtilities.prototype.removeVertex = function (feature, index) {

    var type = turf.getType(feature);
    var result = { isValid: true };

    if (type == 'LineString') {

        if (feature.geometry.coordinates.length > 2) {
            feature.geometry.coordinates.splice(index, 1);
        } else {
            result.isValid = false; // LineString must have 2 or more vertices
        }

    } else if (type == 'Polygon') {

        if (feature.geometry.coordinates[0].length > 4) {

            feature.geometry.coordinates[0].splice(index, 1);

            var l = feature.geometry.coordinates[0].length;

            if (index == 0) {
                feature.geometry.coordinates[0][l - 1][0] = feature.geometry.coordinates[0][0][0];
                feature.geometry.coordinates[0][l - 1][1] = feature.geometry.coordinates[0][0][1];
            } else if (index == l - 1) {
                feature.geometry.coordinates[0][0][0] = feature.geometry.coordinates[0][l - 1][0];
                feature.geometry.coordinates[0][0][1] = feature.geometry.coordinates[0][l - 1][1];
            }

        } else {
            result.isValid = false; // LineString must have 2 or more vertices
        }
    }

    return result;
}

PUtilities.prototype.relativePosition = function (startLine, endLine, checkPoint) {
    // 0 - belong line, > 0 - to the right of the line, < 0 - to the left of the line
    return (endLine[0] - startLine[0]) * (checkPoint[1] - startLine[1]) - (endLine[1] - startLine[1]) * (checkPoint[0] - startLine[0]);
}

PUtilities.prototype.distanceFromPointToLine = function (startLine, endLine, checkPoint) {
    var A = startLine[1] - endLine[1];
    var B = endLine[0] - startLine[0];
    var C = startLine[0] * endLine[1] - endLine[0] * startLine[1];

    var p1 = Math.abs(A * checkPoint[0] + B * checkPoint[1] + C);
    var p2 = Math.sqrt(Math.pow(A, 2) + Math.pow(B, 2));

    return p1 / p2;
}

PUtilities.prototype.featureTo3DObject = function (metadata, style = {}, label = null) {

    var entityColor = 'green';
    var entityWidth = 0.25;
    var entityNodeRadius = 0.25;
    var entityFillOpacity = 0.5;
    var entityLabelSize = 10;
    var entityLabelFont = null;

    if (style && typeof style.color != 'undefined') {
        entityColor = style.color;
    }

    if (style && typeof style.width != 'undefined') {
        entityWidth = style.width;
    }

    if (style && style.node) {
        if (typeof style.node.radius != 'undefined') {
            entityNodeRadius = style.node.radius;
        }
    }

    if (style && typeof style.fillOpacity != 'undefined') {
        entityFillOpacity = style.fillOpacity;
    }

    if (style && style.label) {
        if (typeof style.label.size != 'undefined') {
            entityLabelSize = style.label.size;
        }

        if (typeof style.label.font != 'undefined') {
            entityLabelFont = style.label.font;
        }
    }

    var geomType = turf.getType(metadata);
    var vertices = PUtilities.prototype.geoJsonToVector3Array(metadata);

    var group = new THREE.Group();

    if (geomType == 'LineString' || geomType == 'Polygon') {

        if (entityWidth == 0) {
            var geom = new THREE.BufferGeometry().setFromPoints(vertices);
            geom.computeBoundingSphere();
            var mesh = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: entityColor }));
            group.add(mesh);
        } else {
            var meshLine = new MeshLine();
            meshLine.setPoints(vertices);
            var mesh = new THREE.Mesh(meshLine, new MeshLineMaterial({ color: entityColor, lineWidth: entityWidth }));
            mesh.raycast = MeshLineRaycast; // raycast support
            group.add(mesh);
        }

        if (style && style.node) {

            for (var v of vertices) {
                var nodeGeom = new THREE.SphereGeometry(entityNodeRadius, 5, 5);
                var nodeMesh = new THREE.Mesh(nodeGeom, new THREE.MeshBasicMaterial({ color: entityColor }));
                nodeMesh.translateX(v.x);
                nodeMesh.translateY(v.y);
                nodeMesh.translateZ(v.z);
                group.add(nodeMesh);
            }
        }

        if (geomType == 'Polygon') {

            var triangles = THREE.ShapeUtils.triangulateShape(vertices, []);

            if (triangles.length > 0) {
                var position = new Float32Array(triangles.length * 9);
                positionIndex = 0;

                for (var i = 0; i < triangles.length; i++) {

                    var p0 = vertices[triangles[i][0]];
                    var p1 = vertices[triangles[i][1]];
                    var p2 = vertices[triangles[i][2]];

                    position[positionIndex + 0] = p0.x;
                    position[positionIndex + 1] = p0.y;
                    position[positionIndex + 2] = p0.z;

                    position[positionIndex + 3] = p1.x;
                    position[positionIndex + 4] = p1.y;
                    position[positionIndex + 5] = p1.z;

                    position[positionIndex + 6] = p2.x;
                    position[positionIndex + 7] = p2.y;
                    position[positionIndex + 8] = p2.z;

                    positionIndex += 9;
                }

                var fillGeometry = new THREE.BufferGeometry();
                fillGeometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
                fillGeometry.computeVertexNormals();
                var fillMesh = new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({ color: entityColor, transparent: true, opacity: entityFillOpacity }));
                group.add(fillMesh);
            }
        }

        // build text mesh
        if (label && entityLabelFont) {

            var labelGeometry = new THREE.TextGeometry(label, {
                font: entityLabelFont,
                curveSegments: 1,
                size: entityLabelSize,
                height: 0.1,
                bevelEnabled: false
            });

            labelGeometry.computeBoundingBox();
            labelGeometry.translate(
                - 0.5 * (labelGeometry.boundingBox.max.x - labelGeometry.boundingBox.min.x),
                - 0.5 * (labelGeometry.boundingBox.max.y - labelGeometry.boundingBox.min.y),
                - 0.5 * (labelGeometry.boundingBox.max.z - labelGeometry.boundingBox.min.z)
            );
            labelGeometry.computeBoundingBox();

            var labelMesh = new THREE.Mesh(labelGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, color: entityColor }));

            var minx = 1000000, miny = 1000000, maxx = -1000000, maxy = -1000000;

            for (var v of vertices) {
                minx = Math.min(v.x, minx);
                miny = Math.min(v.y, miny);
                maxx = Math.max(v.x, maxx);
                maxy = Math.max(v.y, maxy);
            }

            labelMesh.position.x = (minx + maxx) / 2;
            labelMesh.position.y = (miny + maxy) / 2;
            labelMesh.position.z = 1;

            group.add(labelMesh);
        }

    } else {
        throw 'Unsupported geometry type: ' + geomType;
    }

    group.userData = metadata;
    return group;
}

PUtilities.prototype.invertY = function (feature) {
    turf.coordEach(feature, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
        currentCoord[1] *= -1;
    }, false);
}

//PUtilities.prototype.rotatePanoramicPixel = function (x, y, w, h, r) {

//    if (r instanceof THREE.Matrix3 == false) {
//        throw 'Incorrect type of the rotation matrix, should be instance of THREE.Matrix3';
//    }

//    var x_ang = (x - w / 2 - 0.5) / w * Math.PI * 2;
//    var y_ang = -(y - h / 2 - 0.5) / h * Math.PI;

//    var x_new = Math.cos(y_ang) * Math.sin(x_ang);
//    var y_new = Math.cos(y_ang) * Math.cos(x_ang);
//    var z_new = Math.sin(y_ang);

//    var xyz = new THREE.Vector3(x_new, y_new, z_new);
//    xyz.applyMatrix3(r);

//    var dist_xy = Math.sqrt(xyz.x * xyz.x + xyz.y * xyz.y);
//    dist_xy = Math.max(dist_xy, 0.000001);
//    var dist_xyz = Math.sqrt(xyz.x * xyz.x + xyz.y * xyz.y + xyz.z * xyz.z);
//    var v = Math.asin(xyz.z / dist_xyz);
//    var u = Math.asin(xyz.x / dist_xy);

//    var isValid = (xyz.y < 0) && (u >= 0);

//    if (isValid) {
//        u = Math.PI - u;
//    }

//    isValid = (xyz.y < 0) && (u <= 0);

//    if (isValid) {
//        u = -Math.PI - u;
//    }

//    if (isNaN(u)) {
//        u = 0;
//    }

//    var px = (u + Math.PI) / (2 * Math.PI) * w + 0.5;
//    var py = (-v + Math.PI / 2) / Math.PI * h + 0.5;

//    return [px, py];
//}
