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
    public class Entity
    {
        public Entity()
        {
            Stages = new HashSet<Stage>();
            Children = new HashSet<Entity>();
            Annotations = new HashSet<Annotation>();
        }

        public long Id { get; set; }

        [Required]
        [MaxLength(128)]
        public string Name { get; set; }

        [Required]
        public int Code { get; set; }

        public string Details { get; set; }

        public Geometry Geometry { get; set; }

        [ForeignKey("Type")]
        public long TypeId { get; set; }

        [JsonIgnore]
        public virtual EntityType Type { get; set; }

        [ForeignKey("Parent")]
        public long? ParentId { get; set; }

        [JsonIgnore]
        public virtual Entity Parent { get; set; }

        [JsonIgnore]
        public virtual ICollection<Entity> Children { get; set; }

        [JsonIgnore]
        public virtual ICollection<Stage> Stages { get; set; }

        [JsonIgnore]
        public virtual ICollection<Annotation> Annotations { get; set; }

    }
}
