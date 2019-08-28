import boto3
import os

def handler(event, context):
    ecs = boto3.client('ecs')

    cluster_name = os.environ.get('CLUSTER_NAME')
    task_arn     = event['taskArn']

    response = ecs.stop_task(
        cluster=cluster_name, # name of the cluster
        task=task_arn, # task arn
        reason='USER REQUEST THROUGH LAMBDA'
    )
    return str(response)
