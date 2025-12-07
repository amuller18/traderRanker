/**
 * Trade Repository
 *
 * Data access layer for trade records. Handles all DynamoDB operations
 * related to trade data. No business logic - just data access.
 *
 * Part of: Backend Layer (Data Access)
 */

import {
  ScanCommand,
  QueryCommand,
  PutCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb'
import { docClient, TRADES_TABLE } from './dynamoClient.js'

/**
 * Fetch all trades from DynamoDB
 * @returns {Promise<Array>} Array of trade records
 */
export async function findAll() {
  const command = new ScanCommand({
    TableName: TRADES_TABLE,
  })

  const result = await docClient.send(command)
  return result.Items || []
}

/**
 * Find all trades for a specific trader
 * @param {string} caller - Trader identifier
 * @returns {Promise<Array>} Array of trade records for the trader
 */
export async function findByTrader(caller) {
  const command = new QueryCommand({
    TableName: TRADES_TABLE,
    KeyConditionExpression: 'caller = :caller',
    ExpressionAttributeValues: {
      ':caller': caller,
    },
  })

  const result = await docClient.send(command)
  return result.Items || []
}

/**
 * Save a trade to DynamoDB (create or update)
 * @param {Object} trade - Trade data with caller, ca, date_called as keys
 * @returns {Promise<void>}
 */
export async function save(trade) {
  const command = new PutCommand({
    TableName: TRADES_TABLE,
    Item: trade,
  })

  await docClient.send(command)
}

/**
 * Delete a trade from DynamoDB
 * @param {string} caller - Trader identifier
 * @param {string} ca - Contract address
 * @param {string} date_called - Date of the trade
 * @returns {Promise<void>}
 */
export async function remove(caller, ca, date_called) {
  const command = new DeleteCommand({
    TableName: TRADES_TABLE,
    Key: { caller, ca, date_called },
  })

  await docClient.send(command)
}
