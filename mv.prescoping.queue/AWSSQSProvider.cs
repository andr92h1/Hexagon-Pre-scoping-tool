using Amazon;
using Amazon.SQS;
using Amazon.SQS.Model;
using mv.prescoping.core;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace mv.prescoping.queue
{
    public class AWSSQSProvider : IQueueWriteable
    {
        const string DEFAULT_MESSAGE_GROUP_ID = "default";
        string _key = null;
        string _secret = null;
        string _queueUrl = null;
        string _regionSystemName = null;

        public AWSSQSProvider(string key, string secret, string queueUrl, string regionSystemName)
        {
            _key = key;
            _secret = secret;
            _queueUrl = queueUrl;
            _regionSystemName = regionSystemName;
        }

        public async Task<bool> SendMessageAsync<T>(T obj)
        {
            if (string.IsNullOrEmpty(_key))
            {
                throw new Exception($"Incorrect 'key' = {_key}");
            }

            if (string.IsNullOrEmpty(_secret))
            {
                throw new Exception($"Incorrect 'secret' = {_secret}");
            }

            if (string.IsNullOrEmpty(_queueUrl))
            {
                throw new Exception($"Incorrect 'queueUrl' = {_queueUrl}");
            }

            if (string.IsNullOrEmpty(_regionSystemName))
            {
                throw new Exception($"Incorrect 'regionSystemName' = {_regionSystemName}");
            }

            RegionEndpoint region = RegionEndpoint.GetBySystemName(_regionSystemName);

            if (region == null)
            {
                throw new Exception($"Incorrect 'regionSystemName' = {_regionSystemName}");
            }

            AmazonSQSClient sqsClient = new AmazonSQSClient(_key, _secret, region);
            string msgBody = JsonConvert.SerializeObject(obj);

            var request = new SendMessageRequest
            {
                //MessageAttributes = new Dictionary<string, MessageAttributeValue>
                //  {
                //    {
                //      "MyStringAttr", new MessageAttributeValue
                //        { DataType = "String", StringValue = "0" }
                //    }
                //  },
                MessageBody = msgBody,
                QueueUrl = _queueUrl,
                MessageDeduplicationId = msgBody.Get256Hash(),
                MessageGroupId = DEFAULT_MESSAGE_GROUP_ID
            };

            SendMessageResponse responseSendMsg = await sqsClient.SendMessageAsync(request);

            if (responseSendMsg.HttpStatusCode == System.Net.HttpStatusCode.OK)
            {
                return true;
            }
            else
            {
                return false;
            }
        }

        //public static async Task<bool> SendMessageBatchAsync<T>(List<T> objs, string queueUrl = null, string regionSystemName = null)
        //{
        //    if (IsInitialized() == false)
        //    {
        //        throw new Exception($"You have to call Init(key, secret) before any interaction with QSQHelper!");
        //    }

        //    if (string.IsNullOrEmpty(_queueUrl) && string.IsNullOrEmpty(queueUrl))
        //    {
        //        throw new Exception("You have to pass queueUrl because of this one was missed during Init(...) call!");
        //    }

        //    if (string.IsNullOrEmpty(_regionSystemName) && string.IsNullOrEmpty(regionSystemName))
        //    {
        //        throw new Exception("You have to pass regionSystemName because of this one was missed during Init(...) call!");
        //    }

        //    RegionEndpoint region = RegionEndpoint.GetBySystemName(string.IsNullOrEmpty(regionSystemName) == false ? regionSystemName : _regionSystemName);
        //    AmazonSQSClient sqsClient = new AmazonSQSClient(_key, _secret, region);
        //    List<SendMessageBatchRequestEntry> batch = new List<SendMessageBatchRequestEntry>();

        //    foreach (T obj in objs)
        //    {
        //        string msgBody = JsonConvert.SerializeObject(obj);

        //        var entry = new SendMessageBatchRequestEntry
        //        {
        //            MessageBody = msgBody,
        //            MessageDeduplicationId = msgBody.Get256Hash(),
        //            MessageGroupId = DEFAULT_MESSAGE_GROUP_ID
        //        };

        //        batch.Add(entry);
        //    }

        //    string finalQueueUrl = string.IsNullOrEmpty(queueUrl) == false ? queueUrl : _queueUrl;
        //    SendMessageBatchResponse responseSendBatch = await sqsClient.SendMessageBatchAsync(finalQueueUrl,batch);

        //    // !!! add analys of responseSendBatch.Successful/responseSendBatch.Failed !!!

        //    if (responseSendBatch.HttpStatusCode == System.Net.HttpStatusCode.OK)
        //    {
        //        return true;
        //    }
        //    else
        //    {
        //        return false;
        //    }
        //}

        //public static async Task<T> ReceiveMessageAsync<T>(string queueUrl = null, string regionSystemName = null)
        //{
        //    if (IsInitialized() == false)
        //    {
        //        throw new Exception($"You have to call Init(key, secret) before any interaction with QSQHelper!");
        //    }

        //    if (string.IsNullOrEmpty(_queueUrl) && string.IsNullOrEmpty(queueUrl))
        //    {
        //        throw new Exception("You have to pass queueUrl because of this one was missed during Init(...) call!");
        //    }

        //    if (string.IsNullOrEmpty(_regionSystemName) && string.IsNullOrEmpty(regionSystemName))
        //    {
        //        throw new Exception("You have to pass regionSystemName because of this one was missed during Init(...) call!");
        //    }

        //    RegionEndpoint region = RegionEndpoint.GetBySystemName(string.IsNullOrEmpty(regionSystemName) == false ? regionSystemName : _regionSystemName);
        //    AmazonSQSClient sqsClient = new AmazonSQSClient(_key, _secret, region);

        //    ReceiveMessageRequest request = new ReceiveMessageRequest()
        //    {
        //        QueueUrl = string.IsNullOrEmpty(queueUrl) == false ? queueUrl : _queueUrl 
        //    };

        //    var response = await sqsClient.ReceiveMessageAsync(request);

        //    throw new NotImplementedException();
        //}

    }
}
