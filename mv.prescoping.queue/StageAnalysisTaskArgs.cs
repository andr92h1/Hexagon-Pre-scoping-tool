using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace mv.prescoping.queue
{
    public class StageAnalysisTaskArgs
    {
        public long? StageId { get; set; }
        public string FloorplanId { get; set; }
        public DateTimeOffset? DateTaken { get; set; }
    }
}
