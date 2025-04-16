import { NextResponse } from "next/server"

// RPC endpoint
const RPC_URL = "https://api.mainnet-beta.solana.com"

export async function GET(request: Request) {
  try {
    // Get token address from query parameter
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address) {
      return NextResponse.json({ error: "Token address is required" }, { status: 400 })
    }

    // Create the JSON-RPC payload
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [address, { encoding: "jsonParsed" }],
    }

    // Make the request to the Solana RPC
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch token info: ${response.status}`)
    }

    const responseData = await response.json()

    // Check for errors in the RPC response
    if (responseData.error) {
      throw new Error(`RPC error: ${responseData.error.message || JSON.stringify(responseData.error)}`)
    }

    // Check if we have a result
    if (!responseData.result || !responseData.result.value) {
      throw new Error("No account data found")
    }

    // Check if the account exists
    if (!responseData.result.value.data) {
      return NextResponse.json({ error: "Token account not found" }, { status: 404 })
    }

    // Extract the parsed data
    const parsedData = responseData.result.value.data.parsed

    // Check if this is a token mint account
    if (parsedData.type !== "mint") {
      return NextResponse.json({ error: "Not a token mint account" }, { status: 400 })
    }

    // Extract mint info
    const info = parsedData.info

    // Check mint and freeze authorities
    const mintAuthority = info.mintAuthority
    const freezeAuthority = info.freezeAuthority

    return NextResponse.json({
      mint_authority: {
        address: mintAuthority,
        disabled: mintAuthority === null,
      },
      freeze_authority: {
        address: freezeAuthority,
        disabled: freezeAuthority === null,
      },
    })
  } catch (error) {
    console.error("Error fetching token authorities:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

