#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { NetworkStack } from '../lib/network-stack'
import { DataStack } from '../lib/data-stack'
import { AppStack } from '../lib/app-stack'

const app = new cdk.App()

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
}

const network = new NetworkStack(app, 'TopognosisNetwork', { env })

const data = new DataStack(app, 'TopognosisData', {
  env,
  vpc: network.vpc,
  dbSg: network.dbSg,
  redisSg: network.redisSg,
})

new AppStack(app, 'TopognosisApp', {
  env,
  vpc: network.vpc,
  albSg: network.albSg,
  appSg: network.appSg,
  db: data.db,
  redis: data.redis,
  djangoSecret: data.djangoSecret,
  dbSecret: data.dbSecret,
  anthropicSecret: data.anthropicSecret,
})
