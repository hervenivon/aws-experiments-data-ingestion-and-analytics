# A sample output record from Kinesis Analytics application for this function is as below
# {'recordId': '8afbe41d-db75-4cd1-8dc3-f80ca2c382e2', 'lambdaDeliveryRecordMetadata': {'retryHint': 128}, 'data': 'eyJBRCI6Ik5vdCBjbGlja2VkIiwiSU5HRVNUSU9OX1RJTUUiOjE1NjcyMDg4MTkzMDEsIk5CUiI6MTU0OH0='}
# The decoded data is {"AD":"Not clicked","INGESTION_TIME":1567208819301,"NBR":1548}

import boto3
import base64
from json import loads
from datetime import datetime

cw_client = boto3.client('cloudwatch')
namespace = 'BidRequestExperiment'

def handler(event, context):
    output = []
    success = 0
    failure = 0

    for record in event['records']:
        try:
            payload = loads(base64.b64decode(record['data']))
            timestamp = float(payload['INGESTION_TIME']) / 1000
            event_time = datetime.utcfromtimestamp(timestamp).strftime('%Y-%m-%dT%H:%M:%S')
            metricDataItem={
                'MetricName': 'Clicked?',
                'Timestamp': event_time,
                'Value': payload['NBR'],
                'Unit': 'None',
                'StorageResolution': 1
            }
            metricDataItem['MetricName'] = payload['AD']
            print('metrics to cwc = {}'.format([metricDataItem]))
            response = cw_client.put_metric_data(Namespace=namespace,MetricData=[metricDataItem])
            print(response)
            success += 1
            output.append({'recordId': record['recordId'], 'result': 'Ok'})
        except Exception as inst:
            print(inst)
            failure += 1
            output.append({'recordId': record['recordId'], 'result': 'DeliveryFailed'})

    print('Successfully delivered {0} records, failed to deliver {1} records'.format(success, failure))
    return {'records': output}
