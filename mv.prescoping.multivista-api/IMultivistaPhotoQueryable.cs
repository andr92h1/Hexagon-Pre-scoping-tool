using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace mv.prescoping.multivista_api
{
    public interface IMultivistaPhotoQueryable
    {
        Task<List<MVPhoto>> GetPhotosAsync(string projectId, string shootTypeId, DateTimeOffset dateTaken);
    }
}
