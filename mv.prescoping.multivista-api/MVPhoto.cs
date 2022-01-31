using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Text;

namespace mv.prescoping.multivista_api
{
    public class MVPhoto
    {
        static GeometryFactory _geometryFactory; 
        public dynamic Details { get; private set; }
        public Geometry Geometry { get; set; }
        public long Id { get; private set; }

        static MVPhoto()
        {
            _geometryFactory = new GeometryFactory();
        }

        public MVPhoto(dynamic details)
        {
            Details = details;
            double x = Convert.ToDouble(details.HotspotX.ToString());
            double y = - Convert.ToDouble(details.HotspotY.ToString()); // Y is negative for adjustmnet with rendering concept in pre-scoping
            Geometry = _geometryFactory.CreatePoint(new Coordinate(x, y));
            string dirtyId = details.PhotoID.ToString();
            if (dirtyId[0] == 'P') dirtyId = dirtyId.Substring(1); 
            Id = Convert.ToInt64(dirtyId);
        }
    }
}
