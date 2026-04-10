import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc
  readonly albSg: ec2.SecurityGroup
  readonly appSg: ec2.SecurityGroup
  readonly dbSg: ec2.SecurityGroup
  readonly redisSg: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Two public subnets across two AZs. No NAT Gateway — Fargate tasks get
    // public IPs but are locked down via security groups (only ALB can reach them).
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    })

    // ALB: accepts HTTP/HTTPS from the internet
    this.albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      description: 'ALB - accepts 80/443 from internet',
    })
    this.albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80))
    this.albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443))

    // Fargate: only accepts traffic from the ALB
    this.appSg = new ec2.SecurityGroup(this, 'AppSg', {
      vpc: this.vpc,
      description: 'Fargate app - only accepts traffic from ALB',
    })
    this.appSg.addIngressRule(this.albSg, ec2.Port.tcp(8000))

    // RDS: only accepts traffic from the app
    this.dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      description: 'RDS - only accepts traffic from app',
    })
    this.dbSg.addIngressRule(this.appSg, ec2.Port.tcp(5432))

    // Redis: only accepts traffic from the app
    this.redisSg = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc: this.vpc,
      description: 'Redis - only accepts traffic from app',
    })
    this.redisSg.addIngressRule(this.appSg, ec2.Port.tcp(6379))
  }
}
