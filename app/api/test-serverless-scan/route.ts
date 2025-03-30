import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    // Get table name from query parameter or use default
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table") || "CallerStatistics"

    console.log(`Testing serverless DynamoDB scan on table: ${tableName}`)

    // Check if we have the required environment variables
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
      return NextResponse.json(
        {
          success: false,
          message: "AWS credentials not found in environment variables",
        },
        { status: 500 },
      )
    }

    // Dynamically import AWS SDK modules
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb")
    const { DynamoDBDocumentClient, ScanCommand } = await import("@aws-sdk/lib-dynamodb")

    // Create a minimal client configuration
    const clientConfig = {
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    }

    // Create the client
    const client = new DynamoDBClient(clientConfig)

    // Create a document client
    const docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
      },
    })

    // Create the scan command
    const command = new ScanCommand({
      TableName: tableName,
      Limit: 10, // Limit to 10 items for testing
    })

    // Send the command
    const response = await docClient.send(command)

    // Return the response
    return NextResponse.json({
      success: true,
      message: `Successfully scanned table: ${tableName}`,
      count: response.Count,
      scannedCount: response.ScannedCount,
      items: response.Items,
    })
  } catch (error) {
    console.error("Error testing serverless DynamoDB scan:", error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

