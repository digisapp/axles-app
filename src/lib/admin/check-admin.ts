import { createClient } from '@/lib/supabase/server';

export async function checkIsAdmin(): Promise<{ isAdmin: boolean; userId: string | null }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, userId: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  return {
    isAdmin: profile?.is_admin === true,
    userId: user.id
  };
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  const supabase = await createClient();

  await supabase.from('admin_activity_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}
