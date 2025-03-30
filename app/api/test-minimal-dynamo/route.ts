import { NextResponse } from "next/server"
import { scanTable } from "@/lib/dynamo-minimal"

export async function GET(request: Request) {
  try {
    // Get table name from query parameter or use default
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table") || "CallerStatistics"

    console.log(`Testing minimal DynamoDB scan on table: ${tableName}`)

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

    // Scan the table
    const items = await scanTable(tableName, {
      limit: 10, // Limit to 10 items for testing
    })

    // Return the response
    return NextResponse.json({
      success: true,
      message: `Successfully scanned table: ${tableName} using minimal client`,
      count: items.length,
      items: items,
    })
  } catch (error) {
    console.error("Error testing minimal DynamoDB scan:", error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

