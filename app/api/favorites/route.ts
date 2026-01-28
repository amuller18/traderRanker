import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FavoriteType } from '@/lib/favorites'

// GET - Fetch all favorites for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to view favorites' },
        { status: 401 }
      )
    }

    // Get type filter from query params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as FavoriteType | null

    let query = supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('type', type)
    }

    const { data: favorites, error } = await query

    if (error) {
      console.error('Error fetching favorites:', error)
      return NextResponse.json(
        { error: 'Failed to fetch favorites' },
        { status: 500 }
      )
    }

    return NextResponse.json({ favorites })
  } catch (error) {
    console.error('Favorites GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add a new favorite
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to add favorites' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, item_id, name, symbol, notes } = body as {
      type: FavoriteType
      item_id: string
      name?: string
      symbol?: string
      notes?: string
    }

    if (!type || !item_id) {
      return NextResponse.json(
        { error: 'type and item_id are required' },
        { status: 400 }
      )
    }

    if (!['trader', 'token'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "trader" or "token"' },
        { status: 400 }
      )
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('item_id', item_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already in favorites' },
        { status: 409 }
      )
    }

    // Add to favorites
    const { data: favorite, error } = await supabase
      .from('favorites')
      .insert({
        user_id: user.id,
        type,
        item_id,
        name,
        symbol,
        notes,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding favorite:', error)
      return NextResponse.json(
        { error: 'Failed to add favorite' },
        { status: 500 }
      )
    }

    return NextResponse.json({ favorite }, { status: 201 })
  } catch (error) {
    console.error('Favorites POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a favorite
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to remove favorites' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as FavoriteType
    const item_id = searchParams.get('item_id')

    if (!type || !item_id) {
      return NextResponse.json(
        { error: 'type and item_id are required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('item_id', item_id)

    if (error) {
      console.error('Error removing favorite:', error)
      return NextResponse.json(
        { error: 'Failed to remove favorite' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Favorites DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
