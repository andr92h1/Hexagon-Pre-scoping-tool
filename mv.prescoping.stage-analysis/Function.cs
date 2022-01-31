using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Amazon.Lambda.Core;
using Amazon.Lambda.SQSEvents;
using mv.prescoping.db;
using mv.prescoping.queue;

using Microsoft.Extensions.Configuration;
using System.IO;
using mv.prescoping.core;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Polygonize;

using System.Text.Json;
using System.Text.Json.Serialization;
using NetTopologySuite.Geometries.Utilities;
using mv.prescoping.multivista_api;
using mv.prescoping.engine;


// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace mv.prescoping.stage_analysis
{
    public class Function
    {

        private ApplicationDbContext _dbContext = null;
        private IConfiguration _configuration = null;
        private IMultivistaPhotoQueryable _multivistaMetadataProvider = null;
        private IQueueWriteable _queue = null;

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
            _queue = new AWSSQSProvider(_configuration.GetValue<string>("SQSDetails:Key"), _configuration.GetValue<string>("SQSDetails:Secret"), _configuration.GetValue<string>("SQSDetails:AiPredictionQueueUrl"), _configuration.GetValue<string>("SQSDetails:StageAnalysisRegionSystemName"));
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
            _queue = null;

        }

        private async Task ProcessMessageAsync(SQSEvent.SQSMessage message, ILambdaContext context)
        {
            // new stage created: {"StageId": 43, "FloorplanId": null, "DateTaken": null}
            // new photos added: {"StageId": null, "FloorplanId": "D434CED9-DF68-4C32-8845-DCB52A4A2D73", "DateTaken": "2020-03-06T00:00:00+00:00"}
            //  "{\"StageId\":null,\"FloorplanId\":\"D434CED9-DF68-4C32-8845-DCB52A4A2D73\",\"DateTaken\":\"2020-03-06T00:00:00+00:00\"}",

            context.Logger.LogLine($"Processed message {message.Body}");
            var stageAnalysis = new StageAnalysis(_dbContext, _multivistaMetadataProvider);
            var stageAnalysisArg = JsonSerializer.Deserialize<StageAnalysisTaskArgs>(message.Body);
            List<PredictionTaskArgs> allTasks = new List<PredictionTaskArgs>();

            if (stageAnalysisArg.StageId != null)
            {
                context.Logger.LogLine($"Proceed stage analysis by StageId = {stageAnalysisArg.StageId}");
                var tasks = await stageAnalysis.BuildPredictionTasksByStageId((long)stageAnalysisArg.StageId);
                allTasks.AddRange(tasks);
            }
            else if (stageAnalysisArg.DateTaken != null && string.IsNullOrEmpty(stageAnalysisArg.FloorplanId) == false)
            {
                context.Logger.LogLine($"Proceed stage analysis by FloorplanId = {stageAnalysisArg.FloorplanId} & DateTaken = {stageAnalysisArg.DateTaken}");
                var tasks = await stageAnalysis.BuildPredictionTasksByFloorplanIdAndDateTaken(stageAnalysisArg.FloorplanId, (DateTimeOffset)stageAnalysisArg.DateTaken);
                allTasks.AddRange(tasks);
            }

            // add messages into prediction's queue
            context.Logger.LogLine($"Total count of the AI preditction tasks: {allTasks.Count}");

            foreach (var arg in allTasks)
            {
                int attempts = 0;
                bool isSuccess = false;

                while (attempts < 3 && isSuccess == false)
                {
                    attempts++;

                    try
                    {
                        isSuccess = await _queue.SendMessageAsync<PredictionTaskArgs>(arg);
                    }
                    catch (Exception exp)
                    {
                        context.Logger.LogLine($"Error adding AI task to queue: {exp.Message}");
                    }
                }

                if (isSuccess)
                {
                    context.Logger.LogLine($"AI task successfully added to the SQS: {JsonSerializer.Serialize(arg)}");
                }
                else
                {
                    context.Logger.LogLine($"ERROR during adding AI task to the SQS: {JsonSerializer.Serialize(arg)}");
                }
            }

            await Task.CompletedTask;
        }
    }
}
