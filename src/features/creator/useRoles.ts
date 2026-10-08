import { useEffect, useState } from 'react';

import { useFamily } from '@/features/family/FamilyProvider';
import { supabase } from '@/lib/supabase';

export type Roles = { is_creator: boolean; is_moderator: boolean; creator_name: string | null };
const NONE: Roles = { is_creator: false, is_moderator: false, creator_name: null };

/** Creator / moderator roles of the signed-in account (granted by an admin in the staff table). */
export function useRoles(): Roles {
  const { session } = useFamily();
  const [roles, setRoles] = useState<Roles>(NONE);
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) return setRoles(NONE);
    supabase.rpc('get_my_roles').then(({ data }) => setRoles({ ...NONE, ...((data ?? {}) as Partial<Roles>) }));
  }, [uid]);

  return roles;
}
