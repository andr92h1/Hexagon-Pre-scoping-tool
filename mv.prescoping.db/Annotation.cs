using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace mv.prescoping.db
{
    public class Annotation
    {

        public enum AnnotationType
        {
            Manual = 0,
            Ai = 1
        }

        public long Id { get; set; }

        [Required]
        public int Code { get; set; }

        [Required]
        public string ClassName { get; set; }

        public float ConfidentLevel { get; set; }

        [Required]
        public AnnotationType Source { get; set; }

        public bool IsPassedValidation { get; set; }

        public bool IsDeleted { get; set; }

        public bool IsClassChanged { get; set; }

        public bool IsGeometryChanged { get; set; }

        [Required]
        public Geometry Geometry { get; set; }

        public string Label { get; set; }

        public string ChangeHistory { get; set; }

        public string Details { get; set; }

        [ForeignKey("Stage")]
        public long? StageId { get; set; }

        [JsonIgnore]
        public virtual Stage Stage { get; set; }

        [ForeignKey("Photo")]
        public long PhotoId { get; set; }

        [JsonIgnore]
        public virtual Photo Photo { get; set; }

        [ForeignKey("Entity")]
        public long? EntityId { get; set; }

        [JsonIgnore]
        public virtual Entity Entity { get; set; }

    }
}
