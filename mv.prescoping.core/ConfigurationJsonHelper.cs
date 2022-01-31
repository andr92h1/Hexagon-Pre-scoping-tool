using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace mv.prescoping.core
{
    
    public static class ConfigurationJsonHelper
    {

        public static IConfiguration CreateConfiguration()
        {

#if DEBUG
            string appSettingsName = "appsettings.development.json";
#else
            string appSettingsName = "appsettings.json";
#endif

            return new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile(appSettingsName, optional: false)
                .Build();

        }
    }
}
