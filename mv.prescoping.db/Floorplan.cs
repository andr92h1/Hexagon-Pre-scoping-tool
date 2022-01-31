using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace mv.prescoping.db
{
    public class Floorplan
    {
        public Floorplan()
        {
            Photos = new HashSet<Photo>();
        }

        [MaxLength(36)]
        public string Id { get; set; }

        [Required]
        [MaxLength(256)]
        public string Name { get; set; }

        public string Transform { get; set; }

        public bool IsMaster { get; set; }

        [Required]
        public string Url { get; set; }

        [Required]
        public int Code { get; set; }

        [ForeignKey("Entity")]
        public long EntityId { get; set; }

        [JsonIgnore]
        public virtual Entity Entity { get; set; }

        [JsonIgnore]
        public virtual ICollection<Photo> Photos { get; set; }

    }
}
