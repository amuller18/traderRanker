/**
 * DynamoDB Client Configuration
 *
 * This module initializes and exports the DynamoDB client used for all
 * database operations. It handles AWS credentials and region configuration.
 *
 * Part of: Backend Layer (Data Access)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

/**
 * Initialize DynamoDB Client with AWS credentials from environment
 */
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

/**
 * Document client wrapper for easier DynamoDB operations
 * Automatically marshalls/unmarshalls JavaScript objects
 */
export const docClient = DynamoDBDocumentClient.from(dynamoClient)

/**
 * Table names from environment with defaults
 */
export const TRADERS_TABLE = process.env.DYNAMODB_TRADERS_TABLE || 'CallerStatistics'
export const TRADES_TABLE = process.env.DYNAMODB_TRADES_TABLE || 'Trades'
