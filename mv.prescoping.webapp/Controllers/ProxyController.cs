using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using mv.prescoping.db;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace mv.prescoping.webapp.Controllers
{
    [Authorize]
    public class ProxyController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly string _pythonProcessorEndpoint;

        public ProxyController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
            _pythonProcessorEndpoint = _configuration.GetValue<string>("ProcessingServices:PythonProcessorEndpoint");
        }

        [HttpGet]
        public async Task<IActionResult> Data(string url)
        {
            if (string.IsNullOrEmpty(url))
            {
                return NotFound();
            }

            HttpClient httpClient = new HttpClient();
            var response = await httpClient.GetAsync(url);
            var content = await response.Content.ReadAsStreamAsync();
            return new FileStreamResult(content, response.Content.Headers.ContentType.MediaType);
        }

        [HttpPost]
        public async Task<IActionResult> Prediction()
        {
            HttpClient httpClient = new HttpClient();

            if (!Request.Body.CanSeek)
            {
                Request.EnableBuffering();
            }

            Request.Body.Position = 0;

            var reader = new StreamReader(Request.Body, Encoding.UTF8);
            var body = await reader.ReadToEndAsync().ConfigureAwait(false);
            var response = await httpClient.PostAsync(_pythonProcessorEndpoint + "/predict", new StringContent(body, Encoding.UTF8, "application/json"));
            var content = await response.Content.ReadAsStreamAsync();
            return StatusCode((int)response.StatusCode, content);
        }
    }
}
