import { h, Fragment } from '../runtime.js';
import {
  AdminSettingsDialog,
  PanelFooter,
  useLocalize,
} from '../runtime.js';
import { Permissions, PermissionTypes } from '../sdk.js';
import { useRpc, useUpdateMemoryPermissionsMutation } from '../data.js';

/** Admins tune the per-role memory capabilities. "Use memories" is a global
 *  feature gate, so it is deliberately not repeated here. */
const permissions = [
  { permission: Permissions.CREATE, labelKey: 'com_ui_memories_allow_create' },
  { permission: Permissions.UPDATE, labelKey: 'com_ui_memories_allow_update' },
  { permission: Permissions.READ, labelKey: 'com_ui_memories_allow_read' },
  { permission: Permissions.OPT_OUT, labelKey: 'com_ui_memories_allow_opt_out' },
];

export default function AdminSettings() {
  const localize = useLocalize();
  const { data, isLoading, isError } = useRpc('memories.permissions', {});
  const mutation = useUpdateMemoryPermissionsMutation({
    onSuccess: () => {},
    onError: () => {},
  });

  if (isLoading || isError || (data?.roles ?? []).length === 0) {
    return null;
  }

  return (
    <PanelFooter>
      <AdminSettingsDialog
        permissionType={PermissionTypes.MEMORIES}
        sectionKey="com_ui_memories"
        permissions={permissions}
        menuId="memory-role-dropdown"
        descriptionKey="com_ui_memories"
        mutation={mutation}
      />
    </PanelFooter>
  );
}
