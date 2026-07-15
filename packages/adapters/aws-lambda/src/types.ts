/**
 * A subset of the AWS API Gateway HTTP API / Lambda Function URL request event
 * (payload format version 2.0).
 */
export interface APIGatewayProxyEventV2 {
  version: string;
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  cookies?: string[];
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: {
    accountId: string;
    apiId: string;
    domainName: string;
    domainPrefix: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    requestId: string;
    stage: string;
    time: string;
    timeEpoch: number;
  };
  body?: string;
  pathParameters?: Record<string, string | undefined>;
  isBase64Encoded: boolean;
  stageVariables?: Record<string, string | undefined>;
}

/**
 * A structured Lambda response for the API Gateway HTTP API / Function URL
 * payload format version 2.0.
 */
export interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
}

/** The AWS Lambda invocation context. */
export interface LambdaContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis(): number;
}

/**
 * The platform object passed to Marko Run route handlers when deployed to AWS
 * Lambda. Exposes the raw Lambda event and invocation context.
 */
export interface AWSLambdaPlatformInfo {
  event: APIGatewayProxyEventV2;
  context: LambdaContext;
}
