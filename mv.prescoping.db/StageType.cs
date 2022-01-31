using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace mv.prescoping.db
{
    public class StageType
    {
        public StageType()
        {
            Stages = new HashSet<Stage>();
        }

        public long Id { get; set; }

        [Required]
        [MaxLength(128)]
        public string Name { get; set; }

        public string Details { get; set; }

        public bool IsActive { get; set; }

        [JsonIgnore]
        public virtual ICollection<Stage> Stages { get; set; }
    }
}
