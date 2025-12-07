/**
 * Trader Repository
 *
 * Data access layer for trader statistics. Handles all DynamoDB operations
 * related to trader data. No business logic - just data access.
 *
 * Part of: Backend Layer (Data Access)
 */

import {
  ScanCommand,
  PutCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb'
import { docClient, TRADERS_TABLE } from './dynamoClient.js'

/**
 * Fetch all traders from DynamoDB
 * @returns {Promise<Array>} Array of trader records
 */
export async function findAll() {
  const command = new ScanCommand({
    TableName: TRADERS_TABLE,
  })

  const result = await docClient.send(command)
  return result.Items || []
}

/**
 * Save a trader to DynamoDB (create or update)
 * @param {Object} trader - Trader data with caller as primary key
 * @returns {Promise<void>}
 */
export async function save(trader) {
  const command = new PutCommand({
    TableName: TRADERS_TABLE,
    Item: trader,
  })

  await docClient.send(command)
}

/**
 * Delete a trader from DynamoDB
 * @param {string} caller - Trader identifier (primary key)
 * @returns {Promise<void>}
 */
export async function remove(caller) {
  const command = new DeleteCommand({
    TableName: TRADERS_TABLE,
    Key: { caller },
  })

  await docClient.send(command)
}
