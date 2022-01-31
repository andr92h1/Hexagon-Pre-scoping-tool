using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace mv.prescoping.multivista_api
{
    public class MultivistaMetadataProvider : IMultivistaPhotoQueryable
    {
        public string ApiEndpointUrl { get; set; }
        public string Username { get; set; }
        public string Password { get; set; }

        public MultivistaMetadataProvider(string apiEndpointUrl, string username, string passward)
        {
            ApiEndpointUrl = apiEndpointUrl;
            Username = username;
            Password = passward;
        }

        public async Task<List<MVPhoto>> GetPhotosAsync(string projectId, string shootTypeId, DateTimeOffset dateTaken)
        {
            if (string.IsNullOrEmpty(ApiEndpointUrl) || string.IsNullOrEmpty(Username) || string.IsNullOrEmpty(Password))
            {
                throw new ArgumentException("Please, call MVAPIHelper.Init(,,) before any interaction with MVAPIHelper");
            }

            List<MVPhoto> result = new List<MVPhoto>();
            string url = $"{ApiEndpointUrl}?fuseaction=aAPI.getPhotos&ProjectUID={projectId}&ShootTypeUID={shootTypeId}&Date={dateTaken.ToString("yyyy'-'MM'-'dd")}";		
            WebRequest request = WebRequest.Create(url);
            (request as HttpWebRequest).AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate;
            request.Headers["Authorization"] = "Basic " + Convert.ToBase64String(Encoding.Default.GetBytes(Username + ":" + Password));

            using (HttpWebResponse response = (HttpWebResponse)(await request.GetResponseAsync()))
            {
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    response.Close();
                    throw new Exception("Server returns status code " + response.StatusCode);
                }
                else
                {
                    string responseFromServer = null;

                    using (Stream dataStream = response.GetResponseStream())
                    using (StreamReader reader = new StreamReader(dataStream))
                    {
                        responseFromServer = await reader.ReadToEndAsync();
                        reader.Close();
                        dataStream.Close();
                        response.Close();
                    }

                    if (String.IsNullOrEmpty(responseFromServer))
                    {
                        throw new Exception("Server returns empty response!");
                    }

                    dynamic obj = JsonConvert.DeserializeObject(responseFromServer);

                    foreach (var item in obj.data)
                    {
                        result.Add(new MVPhoto(item));
                    }

                    return result;
                }
            }
        }

    }
}
