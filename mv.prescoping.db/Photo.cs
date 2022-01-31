using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace mv.prescoping.db
{
    public class Photo
    {

        public const string STATUS_NEW = "New";
        public const string STATUS_LAYOUT_EXTRACTED = "Layout extracted"; // run manual validation ->  "Layout verified"
        public const string STATUS_ERROR_LAYOUT_EXTRACTION = "Error layout extraction"; // run manual capturing -> "Layout verified"
        public const string STATUS_LAYOUT_VERIFIED = "Layout verified";
        public const string STATUS_LAYOUT_ADJUSTED = "Layout adjusted";
        public const string STATUS_ERROR_LAYOUT_ADJUSTMENT = "Error layout adjustment"; // run manual adjustment -> "Layout adjusted";

        public Photo()
        {
            Annotations = new HashSet<Annotation>();
        }

        public long Id { get; set; }

        [Required]
        public int Code { get; set; }

        [MaxLength(32)]
        public string Status { get; set; }

        public float? Dx { get; set; }

        public float? Dy { get; set; }

        public float? Dz { get; set; }

        public float? Rz { get; set; }

        [Required]
        public string Url { get; set; }

        public string Data { get; set; }
        
        public string Vp { get; set; }

        public string ChangeHistory { get; set; }

        public DateTimeOffset DateTaken { get; set; }

        [ForeignKey("Entity")]
        public string FloorplanId { get; set; }

        [JsonIgnore]
        public virtual Floorplan Floorplan { get; set; }

        [JsonIgnore]
        public virtual ICollection<Annotation> Annotations { get; set; }
    }
}
