import boto3
import os
import json

def handler(event, context):
    ecs = boto3.client('ecs')

    cluster_name   = os.environ.get('CLUSTER_NAME')
    task_definition = os.environ.get('TASK_DEFINITION')
    subnets        = os.environ.get('SUBNETS')

    response = ecs.run_task(
        cluster=cluster_name, # name of the cluster
        launchType = 'FARGATE',
        taskDefinition=task_definition, # task definition name and revision
        count = 1,
        platformVersion='LATEST',
        networkConfiguration={
            'awsvpcConfiguration': {
                'subnets': json.loads(subnets),
                'assignPublicIp': 'DISABLED'
            }
        })
    return str(response)
