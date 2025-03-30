import { NextResponse } from "next/server"
import { DynamoDBClient } from "@/lib/dynamo-minimal"

export async function GET() {
  try {
    console.log("Testing minimal DynamoDB client with simple test")

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

    // Create the client
    const client = new DynamoDBClient()

    // Get the table name from environment variable or use default
    const tableName = process.env.DYNAMODB_TRADERS_TABLE || "CallerStatistics"

    // Perform a simple scan with minimal parameters
    const response = await client.scan({
      TableName: tableName,
      Limit: 5,
    })

    // Return the response
    return NextResponse.json({
      success: true,
      message: "Successfully tested minimal DynamoDB client",
      count: response.Count,
      scannedCount: response.ScannedCount,
      items: response.Items,
    })
  } catch (error) {
    console.error("Error testing minimal DynamoDB client:", error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

