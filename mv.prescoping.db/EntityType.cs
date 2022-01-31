using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace mv.prescoping.db
{
    public class EntityType
    {
        public const string PROJECT_NAME = "project";
        public const string BUILDING_NAME = "building";
        public const string FLOOR_NAME = "floor";
        public const string ROOM_NAME = "room";
        public const string WALL_NAME = "wall";

        public EntityType()
        {
            Entities = new HashSet<Entity>();
        }

        public long Id { get; set; }

        [Required]
        [MaxLength(128)]
        public string Name { get; set; }

        public string Description { get; set; }

        [JsonIgnore]
        public virtual ICollection<Entity> Entities { get; set; }
    }
}
