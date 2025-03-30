/**
 * DynamoDB Client for Vercel Serverless Environment
 *
 * This client is designed to work reliably in Vercel's serverless environment
 * by avoiding file system operations and using dynamic imports.
 */

// Debug function for logging
function debug(...args: any[]) {
  console.log("[DynamoDB]", ...args)
}

// Type definitions
export interface DynamoDBConfig {
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  endpoint?: string
  tableName?: string
}

// Generic type for DynamoDB items
export type DynamoDBItem = Record<string, any>

/**
 * Creates a DynamoDB Document Client
 * Uses dynamic imports to avoid file system operations at module load time
 */
export async function createDynamoDBClient(config?: DynamoDBConfig) {
  try {
    debug("Creating DynamoDB client...")

    // Use environment variables as defaults
    const region = config?.region || process.env.AWS_REGION
    const accessKeyId = config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
    const sessionToken = config?.sessionToken || process.env.AWS_SESSION_TOKEN

    // Check for required credentials
    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error("Missing AWS credentials. Please provide region, accessKeyId, and secretAccessKey.")
    }

    // Dynamically import AWS SDK to avoid file system operations
    debug("Dynamically importing AWS SDK...")
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb")
    const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb")

    // Create client configuration
    const clientConfig: any = {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      },
    }

    // Add endpoint if provided (useful for local development)
    if (config?.endpoint) {
      clientConfig.endpoint = config.endpoint
    }

    // Create the DynamoDB client
    const client = new DynamoDBClient(clientConfig)

    // Create and return the document client
    return DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
      },
    })
  } catch (error) {
    debug("Error creating DynamoDB client:", error)
    throw error
  }
}

/**
 * Scans a DynamoDB table
 */
export async function scanTable<T = DynamoDBItem>(
  tableName: string,
  options: {
    limit?: number
    filterExpression?: string
    expressionAttributeValues?: Record<string, any>
    expressionAttributeNames?: Record<string, string>
    consistentRead?: boolean
    config?: DynamoDBConfig
  } = {},
): Promise<T[]> {
  try {
    debug(`Scanning table: ${tableName}`)

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the ScanCommand
    const { ScanCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the scan command parameters
    const params: any = {
      TableName: tableName,
      ConsistentRead: options.consistentRead || false,
    }

    // Add optional parameters if provided
    if (options.limit) params.Limit = options.limit
    if (options.filterExpression) params.FilterExpression = options.filterExpression
    if (options.expressionAttributeValues) params.ExpressionAttributeValues = options.expressionAttributeValues
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames

    // Execute the scan command
    debug("Executing scan command with params:", JSON.stringify(params))
    const command = new ScanCommand(params)
    const response = await docClient.send(command)

    // Return the items
    const items = response.Items || []
    debug(`Scan returned ${items.length} items`)
    return items as T[]
  } catch (error) {
    debug(`Error scanning table ${tableName}:`, error)
    throw error
  }
}

/**
 * Queries a DynamoDB table
 */
export async function queryTable<T = DynamoDBItem>(
  tableName: string,
  options: {
    keyConditionExpression: string
    expressionAttributeValues: Record<string, any>
    expressionAttributeNames?: Record<string, string>
    filterExpression?: string
    indexName?: string
    limit?: number
    consistentRead?: boolean
    scanIndexForward?: boolean
    config?: DynamoDBConfig
  },
): Promise<T[]> {
  try {
    debug(`Querying table: ${tableName}`)

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the QueryCommand
    const { QueryCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the query command parameters
    const params: any = {
      TableName: tableName,
      KeyConditionExpression: options.keyConditionExpression,
      ExpressionAttributeValues: options.expressionAttributeValues,
      ConsistentRead: options.consistentRead || false,
    }

    // Add optional parameters if provided
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames
    if (options.filterExpression) params.FilterExpression = options.filterExpression
    if (options.indexName) params.IndexName = options.indexName
    if (options.limit) params.Limit = options.limit
    if (options.scanIndexForward !== undefined) params.ScanIndexForward = options.scanIndexForward

    // Execute the query command
    debug("Executing query command with params:", JSON.stringify(params))
    const command = new QueryCommand(params)
    const response = await docClient.send(command)

    // Return the items
    const items = response.Items || []
    debug(`Query returned ${items.length} items`)
    return items as T[]
  } catch (error) {
    debug(`Error querying table ${tableName}:`, error)
    throw error
  }
}

/**
 * Gets an item from a DynamoDB table
 */
export async function getItem<T = DynamoDBItem>(
  tableName: string,
  key: Record<string, any>,
  options: {
    consistentRead?: boolean
    config?: DynamoDBConfig
  } = {},
): Promise<T | null> {
  try {
    debug(`Getting item from table: ${tableName}`)

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the GetCommand
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the get command parameters
    const params = {
      TableName: tableName,
      Key: key,
      ConsistentRead: options.consistentRead || false,
    }

    // Execute the get command
    debug("Executing get command with params:", JSON.stringify(params))
    const command = new GetCommand(params)
    const response = await docClient.send(command)

    // Return the item
    if (!response.Item) {
      debug("Item not found")
      return null
    }

    debug("Item found")
    return response.Item as T
  } catch (error) {
    debug(`Error getting item from table ${tableName}:`, error)
    throw error
  }
}

/**
 * Puts an item into a DynamoDB table
 */
export async function putItem(
  tableName: string,
  item: DynamoDBItem,
  options: {
    conditionExpression?: string
    expressionAttributeValues?: Record<string, any>
    expressionAttributeNames?: Record<string, string>
    config?: DynamoDBConfig
  } = {},
): Promise<void> {
  try {
    debug(`Putting item into table: ${tableName}`)

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the PutCommand
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the put command parameters
    const params: any = {
      TableName: tableName,
      Item: item,
    }

    // Add optional parameters if provided
    if (options.conditionExpression) params.ConditionExpression = options.conditionExpression
    if (options.expressionAttributeValues) params.ExpressionAttributeValues = options.expressionAttributeValues
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames

    // Execute the put command
    debug("Executing put command with params:", JSON.stringify(params))
    const command = new PutCommand(params)
    await docClient.send(command)

    debug("Item put successfully")
  } catch (error) {
    debug(`Error putting item into table ${tableName}:`, error)
    throw error
  }
}

/**
 * Updates an item in a DynamoDB table
 */
export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  options: {
    updateExpression: string
    expressionAttributeValues?: Record<string, any>
    expressionAttributeNames?: Record<string, string>
    conditionExpression?: string
    returnValues?: string
    config?: DynamoDBConfig
  },
): Promise<any> {
  try {
    debug(`Updating item in table: ${tableName}`)

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the UpdateCommand
    const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the update command parameters
    const params: any = {
      TableName: tableName,
      Key: key,
      UpdateExpression: options.updateExpression,
      ReturnValues: options.returnValues || "NONE",
    }

    // Add optional parameters if provided
    if (options.expressionAttributeValues) params.ExpressionAttributeValues = options.expressionAttributeValues
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames
    if (options.conditionExpression) params.ConditionExpression = options.conditionExpression

    // Execute the update command
    debug("Executing update command with params:", JSON.stringify(params))
    const command = new UpdateCommand(params)
    const response = await docClient.send(command)

    debug("Item updated successfully")
    return response.Attributes
  } catch (error) {
    debug(`Error updating item in table ${tableName}:`, error)
    throw error
  }
}

/**
 * Deletes an item from a DynamoDB table
 */
export async function deleteItem(
  tableName: string,
  key: Record<string, any>,
  options: {
    conditionExpression?: string
    expressionAttributeValues?: Record<string, any>
    expressionAttributeNames?: Record<string, string>
    returnValues?: string
    config?: DynamoDBConfig
  } = {},
): Promise<any> {
  try {
    debug(`Deleting item from table: ${tableName}`)

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the DeleteCommand
    const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the delete command parameters
    const params: any = {
      TableName: tableName,
      Key: key,
      ReturnValues: options.returnValues || "NONE",
    }

    // Add optional parameters if provided
    if (options.conditionExpression) params.ConditionExpression = options.conditionExpression
    if (options.expressionAttributeValues) params.ExpressionAttributeValues = options.expressionAttributeValues
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames

    // Execute the delete command
    debug("Executing delete command with params:", JSON.stringify(params))
    const command = new DeleteCommand(params)
    const response = await docClient.send(command)

    debug("Item deleted successfully")
    return response.Attributes
  } catch (error) {
    debug(`Error deleting item from table ${tableName}:`, error)
    throw error
  }
}

/**
 * Batch gets items from DynamoDB tables
 */
export async function batchGetItems<T = Record<string, DynamoDBItem[]>>(
  items: Record<string, { Keys: Record<string, any>[] }>,
  options: {
    config?: DynamoDBConfig
  } = {},
): Promise<T> {
  try {
    debug("Batch getting items")

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the BatchGetCommand
    const { BatchGetCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the batch get command parameters
    const params = {
      RequestItems: items,
    }

    // Execute the batch get command
    debug("Executing batch get command with params:", JSON.stringify(params))
    const command = new BatchGetCommand(params)
    const response = await docClient.send(command)

    // Return the items
    debug("Batch get completed successfully")
    return response.Responses as T
  } catch (error) {
    debug("Error batch getting items:", error)
    throw error
  }
}

/**
 * Batch writes items to DynamoDB tables
 */
export async function batchWriteItems(
  items: Record<
    string,
    Array<{ PutRequest?: { Item: Record<string, any> }; DeleteRequest?: { Key: Record<string, any> } }>
  >,
  options: {
    config?: DynamoDBConfig
  } = {},
): Promise<void> {
  try {
    debug("Batch writing items")

    // Create the DynamoDB client
    const docClient = await createDynamoDBClient(options.config)

    // Dynamically import the BatchWriteCommand
    const { BatchWriteCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create the batch write command parameters
    const params = {
      RequestItems: items,
    }

    // Execute the batch write command
    debug("Executing batch write command with params:", JSON.stringify(params))
    const command = new BatchWriteCommand(params)
    await docClient.send(command)

    debug("Batch write completed successfully")
  } catch (error) {
    debug("Error batch writing items:", error)
    throw error
  }
}

