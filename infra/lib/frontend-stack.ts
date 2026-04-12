import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { Construct } from 'constructs'

export interface FrontendStackProps extends cdk.StackProps {
  albDnsName: string
}

export class FrontendStack extends cdk.Stack {
  readonly distributionDomainName: string

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props)

    // ─── S3 BUCKET ───────────────────────────────────────────────────────────
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `topognosis-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // ─── ALB ORIGIN ──────────────────────────────────────────────────────────
    // CloudFront proxies /api/* to the ALB so the browser never makes a plain
    // HTTP request (mixed-content would be blocked since CloudFront is HTTPS).
    const albOrigin = new origins.HttpOrigin(props.albDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    })

    // Use AWS-managed policies:
    // - CACHING_DISABLED: TTL=0, no caching, every request goes to origin
    // - ALL_VIEWER: forwards all viewer headers (including Authorization), query strings, and cookies
    const apiCachePolicy = cloudfront.CachePolicy.CACHING_DISABLED
    const apiOriginRequestPolicy = cloudfront.OriginRequestPolicy.ALL_VIEWER

    // ─── CLOUDFRONT DISTRIBUTION ─────────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // All /api/* requests proxy through to the ALB
        '/api/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiOriginRequestPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    })

    this.distributionDomainName = distribution.distributionDomainName

    // ─── OUTPUTS ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket - deploy frontend here with: aws s3 sync dist/ s3://BUCKET',
    })

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL - this is your frontend URL',
    })

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID - needed to invalidate cache after deploy',
    })
  }
}
