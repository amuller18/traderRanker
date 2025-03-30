import { NextResponse } from "next/server"
import { getTraderStats } from "@/lib/dynamodb-direct"

export async function GET() {
  try {
    // Check if we have the required environment variables
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
      return NextResponse.json({
        success: false,
        message: "AWS credentials not found in environment variables",
        usingMockData: true,
      })
    }

    // Try to fetch data
    const traders = await getTraderStats()

    // Check if we're using mock data
    const usingMockData = traders.length === 0 || traders[0].caller === "TraderAlpha"

    return NextResponse.json({
      success: true,
      message: usingMockData
        ? "Connected but using mock data (no real data found)"
        : "Successfully connected to DynamoDB",
      count: traders.length,
      usingMockData,
      sample: traders.slice(0, 3),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        usingMockData: true,
      },
      { status: 500 },
    )
  }
}

