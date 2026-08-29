import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';

// GET /api/tracked/:id — flight details + full price history.
export async function GET(_request, { params }) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const id = Number(params.id);
  const supabase = createClient();

  const { data: trackedFlight, error } = await supabase
    .from('tracked_flights')
    .select('*, price_history(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !trackedFlight) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  trackedFlight.price_history.sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));

  return NextResponse.json({ trackedFlight });
}

// DELETE /api/tracked/:id — only the owning user can remove it (also
// enforced by the RLS delete policy in supabase/schema.sql).
export async function DELETE(_request, { params }) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const id = Number(params.id);
  const supabase = createClient();

  const { data, error } = await supabase
    .from('tracked_flights')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select();

  if (error) {
    console.error('DELETE /api/tracked/[id] error:', error);
    return NextResponse.json({ error: 'Failed to remove tracked flight' }, { status: 500 });
  }

  if (!data.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
