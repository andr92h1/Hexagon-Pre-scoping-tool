using System;
using System.Collections.Generic;
using System.Text;

namespace mv.prescoping.queue
{
    public class PredictionTaskArgs
    {
        public string PredictorType { get; set; }
        public long PhotoId { get; set; }
        public string PhotoUrl { get; set; }
        public int ProjectCode { get; set; }
        public List<int> ClassFilter { get; set; }
        public long StageId { get; set; }
        public DateTimeOffset? DateTaken { get; set; }
    }
}
