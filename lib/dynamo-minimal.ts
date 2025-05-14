/**
 * Ultra-Minimal DynamoDB Client for Vercel Serverless Environment
 *
 * This implementation completely avoids any filesystem operations by:
 * 1. Using direct fetch API calls to AWS instead of the full SDK
 * 2. Manually signing requests using AWS Signature V4
 * 3. Avoiding any credential providers that might use the filesystem
 */

// Debug function for logging
function debug(...args: any[]) {
  console.log("[DynamoDB-Minimal]", ...args)
}

// Type definitions
export interface DynamoDBConfig {
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  endpoint?: string
}

// Generic type for DynamoDB items
export type DynamoDBItem = Record<string, any>

// AWS Signature V4 implementation
class AwsSignatureV4 {
  private region: string
  private accessKeyId: string
  private secretAccessKey: string
  private sessionToken?: string
  private service = "dynamodb"

  constructor(config: {
    region: string
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }) {
    this.region = config.region
    this.accessKeyId = config.accessKeyId
    this.secretAccessKey = config.secretAccessKey
    this.sessionToken = config.sessionToken
  }

  // Helper to convert string to Uint8Array
  private toUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str)
  }

  // Helper to convert hex to Uint8Array
  private hexToUint8Array(hex: string): Uint8Array {
    const len = hex.length / 2
    const result = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      result[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16)
    }
    return result
  }

  // Helper to convert Uint8Array to hex
  private uint8ArrayToHex(arr: Uint8Array): string {
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  // HMAC-SHA256 implementation using Web Crypto API
  private async hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, this.toUint8Array(message))
    return new Uint8Array(signature)
  }

  // SHA-256 hash implementation using Web Crypto API
  private async sha256(message: string): Promise<string> {
    const msgUint8 = this.toUint8Array(message)
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  // Create canonical request for AWS Signature V4
  private async createCanonicalRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    payload: string,
  ): Promise<string> {
    const parsedUrl = new URL(url)
    const canonicalUri = parsedUrl.pathname
    const canonicalQueryString = parsedUrl.search.substring(1)

    const canonicalHeaders =
      Object.entries(headers)
        .map(([key, value]) => `${key.toLowerCase()}:${value}`)
        .sort()
        .join("\n") + "\n"

    const signedHeaders = Object.keys(headers)
      .map((h) => h.toLowerCase())
      .sort()
      .join(";")

    const payloadHash = await this.sha256(payload)

    return [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n")
  }

  // Create string to sign for AWS Signature V4
  private createStringToSign(timestamp: string, credentialScope: string, canonicalRequestHash: string): string {
    return ["AWS4-HMAC-SHA256", timestamp, credentialScope, canonicalRequestHash].join("\n")
  }

  // Calculate signature key for AWS Signature V4
  private async calculateSignatureKey(dateStamp: string, regionName: string, serviceName: string): Promise<Uint8Array> {
    const kDate = await this.hmacSha256(this.toUint8Array(`AWS4${this.secretAccessKey}`), dateStamp)
    const kRegion = await this.hmacSha256(kDate, regionName)
    const kService = await this.hmacSha256(kRegion, serviceName)
    const kSigning = await this.hmacSha256(kService, "aws4_request")
    return kSigning
  }

  // Sign a request with AWS Signature V4
  public async signRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    payload: string,
  ): Promise<Record<string, string>> {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
    const datestamp = timestamp.substring(0, 8)

    // Add required headers
    const allHeaders = {
      ...headers,
      "x-amz-date": timestamp,
      host: new URL(url).host,
    }

    // Add session token if available
    

    const canonicalRequest = await this.createCanonicalRequest(method, url, allHeaders, payload)

    const credentialScope = `${datestamp}/${this.region}/${this.service}/aws4_request`
    const canonicalRequestHash = await this.sha256(canonicalRequest)
    const stringToSign = this.createStringToSign(timestamp, credentialScope, canonicalRequestHash)

    const signingKey = await this.calculateSignatureKey(datestamp, this.region, this.service)

    const signature = this.uint8ArrayToHex(await this.hmacSha256(signingKey, stringToSign))

    const signedHeaders = Object.keys(allHeaders)
      .map((h) => h.toLowerCase())
      .sort()
      .join(";")

    const authorizationHeader = [
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(", ")

    return {
      ...allHeaders,
      Authorization: authorizationHeader,
    }
  }
}

// DynamoDB client implementation
export class DynamoDBClient {
  private config: Required<Omit<DynamoDBConfig, "sessionToken">> & { sessionToken?: string }
  private signer: AwsSignatureV4

  constructor(config?: DynamoDBConfig) {
    // Use environment variables as defaults
    const region = config?.region || process.env.AWS_REGION
    const accessKeyId = config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
    const endpoint = config?.endpoint || `https://dynamodb.${region}.amazonaws.com`

    // Check for required credentials
    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error("Missing AWS credentials. Please provide region, accessKeyId, and secretAccessKey.")
    }

    this.config = {
      region,
      accessKeyId,
      secretAccessKey,
      endpoint,
    }

    this.signer = new AwsSignatureV4({
      region,
      accessKeyId,
      secretAccessKey,
    })

    debug("DynamoDB client initialized with region:", region)
  }

  // Send a request to DynamoDB
  private async sendRequest(action: string, payload: any): Promise<any> {
    const url = this.config.endpoint
    const method = "POST"
    const body = JSON.stringify(payload)

    const headers = {
      "Content-Type": "application/x-amz-json-1.0",
      "X-Amz-Target": `DynamoDB_20120810.${action}`,
    }

    const signedHeaders = await this.signer.signRequest(method, url, headers, body)

    debug(`Sending ${action} request to DynamoDB`)

    try {
      const response = await fetch(url, {
        method,
        headers: signedHeaders,
        body,
      })

      if (!response.ok) {
        const errorText = await response.text()
        debug(`DynamoDB ${action} request failed:`, errorText)
        throw new Error(`DynamoDB ${action} request failed: ${response.status} ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      debug(`Error in DynamoDB ${action} request:`, error)
      throw error
    }
  }

  // Scan a table
  public async scan(params: {
    TableName: string
    Limit?: number
    FilterExpression?: string
    ExpressionAttributeValues?: Record<string, any>
    ExpressionAttributeNames?: Record<string, string>
    ConsistentRead?: boolean
    ExclusiveStartKey?: Record<string, any>
  }): Promise<{
    Items: DynamoDBItem[]
    Count: number
    ScannedCount: number
    LastEvaluatedKey?: Record<string, any>
  }> {
    // Convert ExpressionAttributeValues to DynamoDB format
    if (params.ExpressionAttributeValues) {
      const convertedValues: Record<string, any> = {}

      for (const [key, value] of Object.entries(params.ExpressionAttributeValues)) {
        convertedValues[key] = this.convertToDynamoDBValue(value)
      }

      params.ExpressionAttributeValues = convertedValues
    }

    const response = await this.sendRequest("Scan", params)

    // Convert DynamoDB format back to JavaScript
    if (response.Items) {
      // Use a local reference to the method to maintain 'this' context
      const convertItem = this.convertFromDynamoDBItem.bind(this)
      response.Items = response.Items.map((item) => convertItem(item))
    }

    return response
  }

  // Query a table
  public async query(params: {
    TableName: string
    KeyConditionExpression: string
    FilterExpression?: string
    ExpressionAttributeValues?: Record<string, any>
    ExpressionAttributeNames?: Record<string, string>
    ConsistentRead?: boolean
    IndexName?: string
    Limit?: number
    ScanIndexForward?: boolean
    ExclusiveStartKey?: Record<string, any>
  }): Promise<{
    Items: DynamoDBItem[]
    Count: number
    ScannedCount: number
    LastEvaluatedKey?: Record<string, any>
  }> {
    // Convert ExpressionAttributeValues to DynamoDB format
    if (params.ExpressionAttributeValues) {
      const convertedValues: Record<string, any> = {}

      for (const [key, value] of Object.entries(params.ExpressionAttributeValues)) {
        convertedValues[key] = this.convertToDynamoDBValue(value)
      }

      params.ExpressionAttributeValues = convertedValues
    }

    const response = await this.sendRequest("Query", params)

    // Convert DynamoDB format back to JavaScript
    if (response.Items) {
      // Use a local reference to the method to maintain 'this' context
      const convertItem = this.convertFromDynamoDBItem.bind(this)
      response.Items = response.Items.map((item) => convertItem(item))
    }

    return response
  }

  // Get an item
  public async getItem(params: {
    TableName: string
    Key: Record<string, any>
    ConsistentRead?: boolean
  }): Promise<{
    Item?: DynamoDBItem
  }> {
    // Convert Key to DynamoDB format
    const convertedKey: Record<string, any> = {}

    for (const [key, value] of Object.entries(params.Key)) {
      convertedKey[key] = this.convertToDynamoDBValue(value)
    }

    params.Key = convertedKey

    const response = await this.sendRequest("GetItem", params)

    // Convert DynamoDB format back to JavaScript
    if (response.Item) {
      response.Item = this.convertFromDynamoDBItem(response.Item)
    }

    return response
  }

  // Put an item
  public async putItem(params: {
    TableName: string
    Item: DynamoDBItem
    ConditionExpression?: string
    ExpressionAttributeValues?: Record<string, any>
    ExpressionAttributeNames?: Record<string, string>
    ReturnValues?: string
  }): Promise<{
    Attributes?: DynamoDBItem
  }> {
    // Convert Item to DynamoDB format
    const convertedItem: Record<string, any> = {}

    for (const [key, value] of Object.entries(params.Item)) {
      convertedItem[key] = this.convertToDynamoDBValue(value)
    }

    params.Item = convertedItem

    // Convert ExpressionAttributeValues to DynamoDB format
    if (params.ExpressionAttributeValues) {
      const convertedValues: Record<string, any> = {}

      for (const [key, value] of Object.entries(params.ExpressionAttributeValues)) {
        convertedValues[key] = this.convertToDynamoDBValue(value)
      }

      params.ExpressionAttributeValues = convertedValues
    }

    const response = await this.sendRequest("PutItem", params)

    // Convert DynamoDB format back to JavaScript
    if (response.Attributes) {
      response.Attributes = this.convertFromDynamoDBItem(response.Attributes)
    }

    return response
  }

  // Update an item
  public async updateItem(params: {
    TableName: string
    Key: Record<string, any>
    UpdateExpression: string
    ExpressionAttributeValues?: Record<string, any>
    ExpressionAttributeNames?: Record<string, string>
    ConditionExpression?: string
    ReturnValues?: string
  }): Promise<{
    Attributes?: DynamoDBItem
  }> {
    // Convert Key to DynamoDB format
    const convertedKey: Record<string, any> = {}

    for (const [key, value] of Object.entries(params.Key)) {
      convertedKey[key] = this.convertToDynamoDBValue(value)
    }

    params.Key = convertedKey

    // Convert ExpressionAttributeValues to DynamoDB format
    if (params.ExpressionAttributeValues) {
      const convertedValues: Record<string, any> = {}

      for (const [key, value] of Object.entries(params.ExpressionAttributeValues)) {
        convertedValues[key] = this.convertToDynamoDBValue(value)
      }

      params.ExpressionAttributeValues = convertedValues
    }

    const response = await this.sendRequest("UpdateItem", params)

    // Convert DynamoDB format back to JavaScript
    if (response.Attributes) {
      response.Attributes = this.convertFromDynamoDBItem(response.Attributes)
    }

    return response
  }

  // Delete an item
  public async deleteItem(params: {
    TableName: string
    Key: Record<string, any>
    ConditionExpression?: string
    ExpressionAttributeValues?: Record<string, any>
    ExpressionAttributeNames?: Record<string, string>
    ReturnValues?: string
  }): Promise<{
    Attributes?: DynamoDBItem
  }> {
    // Convert Key to DynamoDB format
    const convertedKey: Record<string, any> = {}

    for (const [key, value] of Object.entries(params.Key)) {
      convertedKey[key] = this.convertToDynamoDBValue(value)
    }

    params.Key = convertedKey

    // Convert ExpressionAttributeValues to DynamoDB format
    if (params.ExpressionAttributeValues) {
      const convertedValues: Record<string, any> = {}

      for (const [key, value] of Object.entries(params.ExpressionAttributeValues)) {
        convertedValues[key] = this.convertToDynamoDBValue(value)
      }

      params.ExpressionAttributeValues = convertedValues
    }

    const response = await this.sendRequest("DeleteItem", params)

    // Convert DynamoDB format back to JavaScript
    if (response.Attributes) {
      response.Attributes = this.convertFromDynamoDBItem(response.Attributes)
    }

    return response
  }

  // Convert JavaScript value to DynamoDB format
  private convertToDynamoDBValue(value: any): any {
    if (value === null || value === undefined) {
      return { NULL: true }
    }

    if (typeof value === "string") {
      return { S: value }
    }

    if (typeof value === "number") {
      return { N: value.toString() }
    }

    if (typeof value === "boolean") {
      return { BOOL: value }
    }

    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return { B: Buffer.from(value).toString("base64") }
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { L: [] }
      }

      // Check if all elements are of the same type
      const firstType = typeof value[0]
      const allSameType = value.every((item) => typeof item === firstType)

      if (allSameType) {
        if (firstType === "string") {
          return { SS: value }
        }

        if (firstType === "number") {
          return { NS: value.map((n) => n.toString()) }
        }

        if (Buffer.isBuffer(value[0]) || value[0] instanceof Uint8Array) {
          return { BS: value.map((b) => Buffer.from(b).toString("base64")) }
        }
      }

      // Mixed type array
      return { L: value.map((item) => this.convertToDynamoDBValue(item)) }
    }

    if (typeof value === "object") {
      const result: Record<string, any> = {}

      for (const [key, val] of Object.entries(value)) {
        result[key] = this.convertToDynamoDBValue(val)
      }

      return { M: result }
    }

    // Default to string for unsupported types
    return { S: String(value) }
  }

  // Convert DynamoDB item to JavaScript object
  private convertFromDynamoDBItem(item: Record<string, any>): DynamoDBItem {
    const result: DynamoDBItem = {}

    for (const [key, value] of Object.entries(item)) {
      result[key] = this.convertFromDynamoDBValue(value)
    }

    return result
  }

  // Convert DynamoDB value to JavaScript value
  private convertFromDynamoDBValue(value: any): any {
    if (value.S !== undefined) {
      return value.S
    }

    if (value.N !== undefined) {
      return Number(value.N)
    }

    if (value.BOOL !== undefined) {
      return value.BOOL
    }

    if (value.NULL !== undefined) {
      return null
    }

    if (value.B !== undefined) {
      return Buffer.from(value.B, "base64")
    }

    if (value.SS !== undefined) {
      return value.SS
    }

    if (value.NS !== undefined) {
      return value.NS.map((n: string) => Number(n))
    }

    if (value.BS !== undefined) {
      return value.BS.map((b: string) => Buffer.from(b, "base64"))
    }

    if (value.L !== undefined) {
      return value.L.map((item: any) => this.convertFromDynamoDBValue(item))
    }

    if (value.M !== undefined) {
      return this.convertFromDynamoDBItem(value.M)
    }

    return value
  }
}

// Helper functions for common operations
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
    const client = new DynamoDBClient(options.config)

    // Create the scan parameters
    const params: any = {
      TableName: tableName,
      ConsistentRead: options.consistentRead || false,
    }

    // Add optional parameters if provided
    if (options.limit) params.Limit = options.limit
    if (options.filterExpression) params.FilterExpression = options.filterExpression
    if (options.expressionAttributeValues) params.ExpressionAttributeValues = options.expressionAttributeValues
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames

    // Execute the scan
    debug("Executing scan with params:", JSON.stringify(params))
    const response = await client.scan(params)

    // Return the items
    const items = response.Items || []
    debug(`Scan returned ${items.length} items`)
    return items as T[]
  } catch (error) {
    debug(`Error scanning table ${tableName}:`, error)
    throw error
  }
}

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
    const client = new DynamoDBClient(options.config)

    // Create the query parameters
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

    // Execute the query
    debug("Executing query with params:", JSON.stringify(params))
    const response = await client.query(params)

    // Return the items
    const items = response.Items || []
    debug(`Query returned ${items.length} items`)
    return items as T[]
  } catch (error) {
    debug(`Error querying table ${tableName}:`, error)
    throw error
  }
}

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
    const client = new DynamoDBClient(options.config)

    // Create the get parameters
    const params = {
      TableName: tableName,
      Key: key,
      ConsistentRead: options.consistentRead || false,
    }

    // Execute the get
    debug("Executing getItem with params:", JSON.stringify(params))
    const response = await client.getItem(params)

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
    const client = new DynamoDBClient(options.config)

    // Create the put parameters
    const params: any = {
      TableName: tableName,
      Item: item,
    }

    // Add optional parameters if provided
    if (options.conditionExpression) params.ConditionExpression = options.conditionExpression
    if (options.expressionAttributeValues) params.ExpressionAttributeValues = options.expressionAttributeValues
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames

    // Execute the put
    debug("Executing putItem with params:", JSON.stringify(params))
    await client.putItem(params)

    debug("Item put successfully")
  } catch (error) {
    debug(`Error putting item into table ${tableName}:`, error)
    throw error
  }
}

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
    const client = new DynamoDBClient(options.config)

    // Create the update parameters
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

    // Execute the update
    debug("Executing updateItem with params:", JSON.stringify(params))
    const response = await client.updateItem(params)

    debug("Item updated successfully")
    return response.Attributes
  } catch (error) {
    debug(`Error updating item in table ${tableName}:`, error)
    throw error
  }
}

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
    const client = new DynamoDBClient(options.config)

    // Create the delete parameters
    const params: any = {
      TableName: tableName,
      Key: key,
      ReturnValues: options.returnValues || "NONE",
    }

    // Add optional parameters if provided
    if (options.conditionExpression) params.ConditionExpression = options.conditionExpression
    if (options.expressionAttributeValues) params.ExpressionAttributeValues = options.expressionAttributeValues
    if (options.expressionAttributeNames) params.ExpressionAttributeNames = options.expressionAttributeNames

    // Execute the delete
    debug("Executing deleteItem with params:", JSON.stringify(params))
    const response = await client.deleteItem(params)

    debug("Item deleted successfully")
    return response.Attributes
  } catch (error) {
    debug(`Error deleting item from table ${tableName}:`, error)
    throw error
  }
}

