using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using mv.prescoping.db;

using Amazon.Lambda.Core;
using Amazon.Lambda.SQSEvents;
using Microsoft.Extensions.Configuration;
using mv.prescoping.multivista_api;
using mv.prescoping.core;


// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace mv.prescoping.annotation_spatial_analysis
{
    public class Function
    {
        private ApplicationDbContext _dbContext = null;
        private IConfiguration _configuration = null;
        private IMultivistaPhotoQueryable _multivistaMetadataProvider = null;

        /// <summary>
        /// Default constructor. This constructor is used by Lambda to construct the instance. When invoked in a Lambda environment
        /// the AWS credentials will come from the IAM role associated with the function and the AWS region will be set to the
        /// region the Lambda function is executed in.
        /// </summary>
        public Function()
        {

        }


        /// <summary>
        /// This method is called for every Lambda invocation. This method takes in an SQS event object and can be used 
        /// to respond to SQS messages.
        /// </summary>
        /// <param name="evnt"></param>
        /// <param name="context"></param>
        /// <returns></returns>
        public async Task FunctionHandler(SQSEvent evnt, ILambdaContext context)
        {
            // make a preparation job
            _configuration = ConfigurationJsonHelper.CreateConfiguration();
            _multivistaMetadataProvider = new MultivistaMetadataProvider(_configuration.GetValue<string>("Multivista:ApiEndpointUrl"), _configuration.GetValue<string>("Multivista:Username"), _configuration.GetValue<string>("Multivista:Password"));
            string connectionString = _configuration.GetValue<string>("ConnectionStrings:DefaultConnection");
            context.Logger.Log($"Init DB context at: {connectionString}");
            _dbContext = ApplicationDbContext.CreateDbContext(connectionString);

            // do job
            foreach (var message in evnt.Records)
            {
                await ProcessMessageAsync(message, context);
            }

            // dispose resources
            if (_dbContext != null)
            {
                _dbContext.Dispose();
                _dbContext = null;
            }

            _configuration = null;
            _multivistaMetadataProvider = null;
        }

        private async Task ProcessMessageAsync(SQSEvent.SQSMessage message, ILambdaContext context)
        {
            // {"FloorplanId": "D434CED9-DF68-4C32-8845-DCB52A4A2D73", "DateTaken": "2020-03-06T00:00:00+00:00", PhotoId: 158698128}
            //  "{\"FloorplanId\":\"D434CED9-DF68-4C32-8845-DCB52A4A2D73\",\"DateTaken\":\"2020-03-06T00:00:00+00:00\", \"PhotoId\": 158698128}"

            // 1. get photos (Layout adjusted only) from floorplan, filtered by DateTaken and PhotoId (if present)
            // 2. get geometry from the floor plan and build room's geometry
            // 3. for each dateTaken
            // 4. get multivista photo positions
            // 5. for each photo get room
            // 6. for each room extract wall's geometry
            // 7. for each annotation get intersection with wall's geometry
            // 8. bigest intersection is parent of the annotation


            context.Logger.LogLine($"Processed message {message.Body}");

            // TODO: Do interesting work based on the new message
            await Task.CompletedTask;
        }
    }
}
