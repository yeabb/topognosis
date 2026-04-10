import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc
  albSg: ec2.SecurityGroup
  appSg: ec2.SecurityGroup
  db: rds.DatabaseInstance
  redis: elasticache.CfnCacheCluster
  djangoSecret: secretsmanager.Secret
  dbSecret: secretsmanager.Secret
  anthropicSecret: secretsmanager.Secret
}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props)

    const { vpc, albSg, appSg, db, redis, djangoSecret, dbSecret, anthropicSecret } = props

    // ─── ECR REPOSITORY ─────────────────────────────────────────────────────
    // Reference the existing repo rather than creating it — avoids conflicts
    // if the repo already exists from a previous deploy attempt.
    const repository = ecr.Repository.fromRepositoryName(this, 'AppRepository', 'topognosis-app')

    // ─── ECS CLUSTER ────────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'topognosis',
    })

    // ─── CLOUDWATCH LOG GROUP ───────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'AppLogs', {
      logGroupName: '/ecs/topognosis',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // ─── FARGATE TASK DEFINITION ─────────────────────────────────────────────
    // Blueprint for your container: CPU/memory, image, env vars, secrets.
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 512,       // 0.5 vCPU
      memoryLimitMiB: 1024,
    })

    // Grant task permission to read secrets from Secrets Manager
    djangoSecret.grantRead(taskDef.taskRole)
    dbSecret.grantRead(taskDef.taskRole)
    anthropicSecret.grantRead(taskDef.taskRole)

    // Grant task permission to pull images from ECR
    repository.grantPull(taskDef.taskRole)

    const container = taskDef.addContainer('app', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'app',
        logGroup,
      }),
      environment: {
        DEBUG: 'False',
        ALLOWED_HOSTS: '*',           // tighten to your domain after first deploy
        DB_NAME: 'topognosis',
        DB_HOST: db.dbInstanceEndpointAddress,
        DB_PORT: '5432',
        REDIS_HOST: redis.attrRedisEndpointAddress,
        REDIS_PORT: '6379',
        CORS_ALLOW_ALL_ORIGINS: 'True',
      },
      secrets: {
        // Pulled from Secrets Manager at container startup — never stored in
        // the task definition or visible in plaintext in the console.
        SECRET_KEY: ecs.Secret.fromSecretsManager(djangoSecret),
        DB_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(anthropicSecret),
      },
    })

    container.addPortMappings({ containerPort: 8000 })

    // ─── FARGATE SERVICE ─────────────────────────────────────────────────────
    // Keeps your task running. If the container crashes, ECS restarts it.
    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,          // required since there is no NAT Gateway
      securityGroups: [appSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      // Don't block CloudFormation waiting for service stability — we verify
      // health via ECS console/logs after deploy instead.
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      circuitBreaker: { rollback: false },
    })

    // ─── APPLICATION LOAD BALANCER ───────────────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    })

    const listener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
    })

    listener.addTargets('AppTarget', {
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/api/health/',
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: '200',
      },
      // Sticky sessions — routes a user's requests to the same container so
      // WebSocket connections don't get split across instances.
      stickinessCookieDuration: cdk.Duration.hours(1),
    })

    // ─── OUTPUTS ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS — point your domain CNAME here',
    })

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR URI — use this in your docker build/push commands',
    })

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: db.dbInstanceEndpointAddress,
      description: 'RDS endpoint',
    })
  }
}
