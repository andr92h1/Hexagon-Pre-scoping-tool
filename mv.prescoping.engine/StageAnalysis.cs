using Microsoft.EntityFrameworkCore;
using mv.prescoping.db;
using mv.prescoping.multivista_api;
using mv.prescoping.queue;
using NetTopologySuite.Geometries;
using NetTopologySuite.Geometries.Utilities;
using NetTopologySuite.Operation.Polygonize;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace mv.prescoping.engine
{
    public class StageAnalysis: IDisposable
    {
        private ApplicationDbContext _dbContext;
        private IMultivistaPhotoQueryable _multivistaMetadataProvider;

        public StageAnalysis(ApplicationDbContext dbContext, IMultivistaPhotoQueryable multivistaMetadataProvider)
        {
            _dbContext = dbContext;
            _multivistaMetadataProvider = multivistaMetadataProvider;
        }

        private PredictionTaskArgs BuildStageAnalysisTaskArgs(Photo photo, Stage stage)
        {
            List<int> classFilter = new List<int>();

            if ( string.IsNullOrEmpty(stage.Details) == false)
            {
                dynamic obj = JsonConvert.DeserializeObject(stage.Details);

                if (obj.cf != null)
                {
                    foreach (dynamic item in obj.cf)
                    {
                        classFilter.Add(Convert.ToInt32(item.ToString()));
                    }
                }
            }

            return new PredictionTaskArgs()
            {
                PhotoId = photo.Id,
                PhotoUrl = photo.Url,
                DateTaken = photo.DateTaken,
                ClassFilter = classFilter,
                ProjectCode = stage.Code,
                PredictorType = stage.Type.Name,
                StageId = stage.Id
            };
        }

        public async Task<List<PredictionTaskArgs>> BuildPredictionTasksByStageId(long stageId)
        {
            List<PredictionTaskArgs> tasks = new List<PredictionTaskArgs>();

            var stage = _dbContext.Stages
                .Include(s => s.Entity).ThenInclude(e => e.Type)
                .Include(s => s.Type)
                .First(s => s.Id == stageId);

            // get all floorplan that are covered by stage
            List<Floorplan> floorplans = new List<Floorplan>();

            if (stage.Entity.Type.Name == EntityType.BUILDING_NAME)
            {
                floorplans = _dbContext.Floorplans.Where(f => f.Entity.ParentId == stage.EntityId).ToList();
            }
            else if (stage.Entity.Type.Name == EntityType.FLOOR_NAME)
            {
                floorplans = _dbContext.Floorplans.Where(f => f.EntityId == stage.EntityId).ToList();
            }
            else if (stage.Entity.Type.Name == EntityType.ROOM_NAME)
            {
                floorplans = _dbContext.Floorplans.Where(f => f.EntityId == stage.Entity.ParentId).ToList();
            }
            else if (stage.Entity.Type.Name == EntityType.WALL_NAME)
            {
                floorplans = _dbContext.Floorplans.Where(f => f.EntityId == stage.Entity.Parent.ParentId).ToList();
            }
            else
            {
                throw new ArgumentException($"Unsupported stage type: {stage.Entity.Type.Name}");
            }

            // analize photos on the floorplans & build tasks for the predictions
            foreach (var fp in floorplans)
            {

                // apply filter by validFrom/validTo
                var photos = _dbContext.Photos.Where(p => p.FloorplanId == fp.Id);
                var projectEntity = _dbContext.Entities.FirstOrDefault(e => e.Code == fp.Code && e.Type.Name == EntityType.PROJECT_NAME);

                if (projectEntity == null)
                {
                    throw new Exception($"There is no project entity in the database for the floorplan: Id = {fp.Id}, Code = {fp.Code}");
                }

                if (stage.ValidFrom != null)
                {
                    DateTimeOffset validFrom = new DateTimeOffset(stage.ValidFrom.Value.Year, stage.ValidFrom.Value.Month, stage.ValidFrom.Value.Day, 0, 0, 0, new TimeSpan());
                    photos = photos.Where(p => p.DateTaken >= validFrom);
                }

                if (stage.ValidTo != null)
                {
                    DateTimeOffset validTo = new DateTimeOffset(stage.ValidTo.Value.Year, stage.ValidTo.Value.Month, stage.ValidTo.Value.Day, 0, 0, 0, new TimeSpan());
                    photos = photos.Where(p => p.DateTaken <= validTo);
                }

                if (stage.Entity.Type.Name == EntityType.BUILDING_NAME || stage.Entity.Type.Name == EntityType.FLOOR_NAME)
                {
                    // for the building/floor's stage take all photos
                    foreach (var p in photos)
                    {
                        tasks.Add(BuildStageAnalysisTaskArgs(p, stage));
                    }
                }
                else
                {
                    // for the room/wall's stage apply filtration by geometry
                    long? roomId = (stage.Entity.Type.Name == EntityType.ROOM_NAME) ? stage.Entity.Id : stage.Entity.ParentId;
                    List<Geometry> geoms = _dbContext.Entities.Where(e => e.ParentId == roomId && e.Geometry != null).Select(e => e.Geometry).ToList();
                    Polygonizer polygonizer = new Polygonizer();
                    polygonizer.Add(geoms);
                    var roomPolygons = polygonizer.GetPolygons();

                    // prepare transformation from floorplan cs into pixels cs
                    double[] tk = fp.Transform.Split(";").Select(e => Convert.ToDouble(e)).ToArray();
                    var pixelToWorldTransform = new AffineTransformation(tk[0], tk[4], tk[12], tk[1], tk[5], tk[13]);

                    if (roomPolygons.Count > 0)
                    {
                        // group photos by dateTaken
                        foreach (var grp in photos.AsEnumerable().GroupBy(p => p.DateTaken))
                        {
                            // sanitary check
                            if (grp.Key == null)
                            {
                                continue;
                            }

                            // prepare photos from grp for quick access
                            var prescopingPhotos = grp.ToDictionary(p => p.Id);

                            // get positions of the photos from Multivista side
                            var mvPhotos = await _multivistaMetadataProvider.GetPhotosAsync(projectEntity.Details, fp.Id, (DateTimeOffset)grp.Key);

                            foreach (var mvp in mvPhotos)
                            {
                                // convert photo position from pixel to world 
                                mvp.Geometry = pixelToWorldTransform.Transform(mvp.Geometry);

                                foreach (var roomGeom in roomPolygons)
                                {
                                    if (roomGeom.Contains(mvp.Geometry) && prescopingPhotos.ContainsKey(mvp.Id))
                                    {
                                        tasks.Add(BuildStageAnalysisTaskArgs(prescopingPhotos[mvp.Id], stage));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return tasks;

        }

        public async Task<List<PredictionTaskArgs>> BuildPredictionTasksByFloorplanIdAndDateTaken(string floorplanId, DateTimeOffset dateTaken)
        {
            List<PredictionTaskArgs> tasks = new List<PredictionTaskArgs>();

            var fp = _dbContext.Floorplans.Include(fp => fp.Entity).First(f => f.Id == floorplanId);
            dateTaken = new DateTimeOffset(dateTaken.Year, dateTaken.Month, dateTaken.Day, 0, 0, 0, new TimeSpan());
            var prescopingPhotos = _dbContext.Photos.Where(p => p.FloorplanId == fp.Id && p.DateTaken == dateTaken).ToList();

            var projectEntity = _dbContext.Entities.FirstOrDefault(e => e.Code == fp.Code && e.Type.Name == EntityType.PROJECT_NAME);

            if (projectEntity == null)
            {
                throw new Exception($"There is no project entity in the database for the floorplan: Id = {fp.Id}, Code = {fp.Code}");
            }

            var mvIdPhotos = (await _multivistaMetadataProvider.GetPhotosAsync(projectEntity.Details, fp.Id, dateTaken)).ToDictionary(p => p.Id);

            // 1. check building/floor's stages
            List<Stage> stages = new List<Stage>();

            var buildingEntity = _dbContext.Entities.Include(e => e.Stages).ThenInclude(e => e.Type).FirstOrDefault(e => e.Id == fp.Entity.ParentId);

            if (buildingEntity != null)
            {
                stages.AddRange(buildingEntity.Stages.Where(s => s.IsActive && s.IsPlanned));
            }

            var floorEntity = _dbContext.Entities.Include(e => e.Stages).ThenInclude(e => e.Type).FirstOrDefault(e => e.Id == fp.EntityId);

            if (floorEntity != null)
            {
                stages.AddRange(floorEntity.Stages.Where(s => s.IsActive && s.IsPlanned));
            }

            foreach (var stage in stages)
            {
                if (stage.ValidFrom != null)
                {
                    DateTimeOffset validFrom = new DateTimeOffset(stage.ValidFrom.Value.Year, stage.ValidFrom.Value.Month, stage.ValidFrom.Value.Day, 0, 0, 0, new TimeSpan());

                    if (dateTaken < validFrom)
                    {
                        continue;
                    }
                }

                if (stage.ValidTo != null)
                {
                    DateTimeOffset validTo = new DateTimeOffset(stage.ValidTo.Value.Year, stage.ValidTo.Value.Month, stage.ValidTo.Value.Day, 0, 0, 0, new TimeSpan());

                    if (dateTaken > validTo)
                    {
                        continue;
                    }
                }

                foreach (var p in prescopingPhotos)
                {
                    tasks.Add(BuildStageAnalysisTaskArgs(p, stage));
                }
            }

            // 2. check room/wall's stages
            var roomEntities = await _dbContext.Entities
                .Include(e => e.Stages).ThenInclude(s => s.Type) // include stages from the rooms
                .Include(e => e.Children).ThenInclude(c => c.Stages).ThenInclude(s => s.Type) // include stages from the walls
                .Where(e => e.ParentId == fp.EntityId)
                .ToListAsync();

            // prepare transformation
            double[] tk = fp.Transform.Split(";").Select(e => Convert.ToDouble(e)).ToArray();
            var pixelToWorldTransform = new AffineTransformation(tk[0], tk[4], tk[12], tk[1], tk[5], tk[13]);
            var worldToPixelTransform = pixelToWorldTransform.GetInverse();

            foreach (var roomEntity in roomEntities)
            {
                stages = new List<Stage>(); //cleanup list of stages

                var wallEntities = roomEntity.Children.Where(e => e.Geometry != null);

                // skip room withput geometries
                if (wallEntities.Count() == 0)
                {
                    continue;
                }

                // build list of room/wall's stages
                stages.AddRange(roomEntity.Stages.Where(s => s.IsActive && s.IsPlanned));

                foreach (var wallEntity in roomEntity.Children)
                {
                    stages.AddRange(wallEntity.Stages.Where(s => s.IsActive && s.IsPlanned));
                }

                // skip room without stages
                if (stages.Count == 0)
                {
                    continue;
                }

                // build room geometry
                var wallGeometries = wallEntities.Select(e => e.Geometry).ToList();
                Polygonizer polygonizer = new Polygonizer();
                polygonizer.Add(wallGeometries);
                var roomPolygons = polygonizer.GetPolygons();

                foreach (var roomPolygon in roomPolygons)
                {
                    // Y is negative, and APIHelper provides photo Geomerty with negative Y
                    var roomPolygonInPixel = worldToPixelTransform.Transform(roomPolygon);

                    foreach (var p in prescopingPhotos)
                    {
                        // skip photos outside the room
                        if (mvIdPhotos.ContainsKey(p.Id) == false || roomPolygonInPixel.Contains(mvIdPhotos[p.Id].Geometry) == false)
                        {
                            continue;
                        }

                        foreach (var stage in stages)
                        {
                            // skip stage out of photo taken date
                            if (stage.ValidFrom != null)
                            {
                                DateTimeOffset validFrom = new DateTimeOffset(stage.ValidFrom.Value.Year, stage.ValidFrom.Value.Month, stage.ValidFrom.Value.Day, 0, 0, 0, new TimeSpan());

                                if (p.DateTaken < validFrom)
                                {
                                    continue;
                                }
                            }

                            if (stage.ValidTo != null)
                            {
                                DateTimeOffset validTo = new DateTimeOffset(stage.ValidTo.Value.Year, stage.ValidTo.Value.Month, stage.ValidTo.Value.Day, 0, 0, 0, new TimeSpan());

                                if (p.DateTaken > validTo)
                                {
                                    continue;
                                }
                            }

                            // add task
                            tasks.Add(BuildStageAnalysisTaskArgs(p, stage));
                        }
                    }
                }
            }

            return tasks;

        }

        public void Dispose()
        {
            if (_dbContext != null)
            {
                _dbContext.Dispose();
            }
        }
    }
}
