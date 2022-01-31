using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace mv.prescoping.queue
{
    public interface IQueueWriteable
    {
        Task<bool> SendMessageAsync<T>(T obj);
    }
}
