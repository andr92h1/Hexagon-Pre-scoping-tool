using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace mv.prescoping.db
{
    public class Stage
    {
        public Stage()
        {
            Annotations = new HashSet<Annotation>();
            ActualStages = new HashSet<Stage>();
        }

        public long Id { get; set; }

        [Required]
        public int Code { get; set; }

        [Required]
        public float Value { get; set; }

        public DateTimeOffset? ValidFrom { get; set; }

        public DateTimeOffset? ValidTo { get; set; }

        [Required]
        public DateTimeOffset Timestamp { get; set; }

        public bool IsPlanned { get; set; }

        public bool IsActive { get; set; }

        public bool IsValidationReqired { get; set; }

        public string Description { get; set; }

        public string Details { get; set; }

        [ForeignKey("Type")]
        public long TypeId { get; set; }

        [JsonIgnore]
        public virtual StageType Type { get; set; }

        [ForeignKey("Entity")]
        public long EntityId { get; set; }

        [JsonIgnore]
        public virtual Entity Entity { get; set; }

        [ForeignKey("PlannedStage")]
        public long? PlannedStageId { get; set; }

        [JsonIgnore]
        public virtual Stage PlannedStage { get; set; }

        [JsonIgnore]
        public virtual ICollection<Stage> ActualStages { get; set; }

        [JsonIgnore]
        public virtual ICollection<Annotation> Annotations { get; set; }
    }
}
