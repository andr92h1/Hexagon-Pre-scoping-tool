const knex = require('knex')
const knexPostgis = require('knex-postgis');
const PSULIB = require('./lib/psulib');
const MVMD = require('./lib/multivista-metadata');

exports.handler = function (event, context) {

    if (event != null) {

        const mv_credentials = {
            username: 'multiviewer@multivista.com',
            password: 'Leica123*'
        }

        const db = knex({
            client: 'pg',
            connection: {
                host: '18.159.153.101',
                port: 5432,
                user: 'multivista_admin',
                password: '???',
                database: 'prescoping'
            }
        });

        const st = knexPostgis(db);

        for (var record of event.Records) {

            if (!record || !record.body) {
                console.log('Incorrecte event description!', record);
                continue;
            }

            var args = JSON.parse(record.body);

            console.log("Start processing event:");
            console.log(args);

            args.Status = 'Layout adjusted';

            db('Floorplans').where({ Id: args.FloorplanId }).then(floorplans => {

                if (floorplans.length != 1) {
                    console.log('Incorrect FloorplanId, db has ' + floorplans.length + ' recodrs');
                } else {
                    const floorplan = floorplans[0];

                    const entitiesQueryPromis = db.select('e.Id', 'e.ParentId', st.asGeoJSON('e.Geometry').as('Geometry'))
                        .from({ r: 'Entities' })
                        .leftJoin({ e: 'Entities' }, 'r.Id', '=', 'e.ParentId')
                        .where('r.ParentId', '=', floorplan.EntityId);

                    Promise.all([
                        db('Photos').where(args),
                        entitiesQueryPromis
                    ]).then((photos, entities) => {
                        // do rest here...
                        var t = 1;
                    }).catch(error => {
                        console.log(error);
                    })
                }

            }).catch(error => {
                console.log(error);
            });


            //// get adjusted photos by filter
            //db('Photos').where(args).then(photos => {

            //    // group photos by date taken
            //    var datePhotos = {};

            //    for (var photo of photos) {
            //        var dateKey = PSULIB.DATE.toFormatString(photo.DateTaken);

            //        if (typeof datePhotos[dateKey] == 'undefined') {
            //            datePhotos[dateKey] = [];
            //        }

            //        datePhotos[dateKey].push(photo);
            //    }

            //    for (var dateTaken in datePhotos) {
            //        console.log('Handling date: ' + dateTaken);

            //        MVMD.getPhotos(args.FloorplanId, dateTaken, mv_credentials).then(mvphotos => {
            //            // continue here!!!
            //        });
            //    }

            //    // get room geometries
            //    //db('Entities').select('Id', st.asGeoJSON('Geometry')).then(entities => {
            //    //    for (var item of entities) {
            //    //        console.log(item);
            //    //    }
            //    //});

            //});

            // + 1. get photos (Layout adjusted only) from floorplan, filtered by DateTaken and PhotoId (if present)
            // + 2. get geometry from the floor plan and build room's geometry
            // + 3. for each dateTaken
            // + 4. get multivista photo positions
            // 5. for each photo get room
            // 6. for each room extract wall's geometry
            // 7. for each annotation get intersection with wall's geometry
            // 8. bigest intersection is parent of the annotation



        }

    }
    else {
        console.log('No event object');
    }

    context.done(null, 'Hello World');  // SUCCESS with message
};
