import { PermissionBits, PrincipalType } from 'librechat-data-provider';

function permissionBitSupersets(requiredBits) {
  const bits = [];
  for (let value = 0; value <= 63; value += 1) {
    if ((value & requiredBits) === requiredBits) {
      bits.push(value);
    }
  }
  return bits;
}

/** ACL helpers the memory store layer needs. They mirror data-schemas'
 *  aclEntry/userGroup methods, but read through the plugin's mongoose models. */
export function createAclDeps(mongoose) {
  const connection = mongoose.connection ?? mongoose;
  const principalsFor = async ({ userId, role, idOnTheSource }) => {
    const users = connection.collection('users');
    const groups = connection.collection('groups');
    const userObjectId =
      typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    let userRole = role;
    let memberIdOnTheSource = idOnTheSource;
    if (userRole === undefined || memberIdOnTheSource === undefined) {
      const user = await users.findOne(
        { _id: userObjectId },
        { projection: { role: 1, idOnTheSource: 1 } },
      );
      if (userRole === undefined) {
        userRole = user?.role;
      }
      if (memberIdOnTheSource === undefined) {
        memberIdOnTheSource = user?.idOnTheSource ?? null;
      }
    }
    const principals = [{ principalType: PrincipalType.USER, principalId: userObjectId }];
    if (typeof userRole === 'string' && userRole.trim()) {
      principals.push({ principalType: PrincipalType.ROLE, principalId: userRole });
    }
    const memberId = memberIdOnTheSource || userId.toString();
    const memberGroups = await groups.find({ memberIds: memberId }, { projection: { _id: 1 } }).toArray();
    for (const group of memberGroups) {
      principals.push({ principalType: PrincipalType.GROUP, principalId: group._id });
    }
    principals.push({ principalType: PrincipalType.PUBLIC });
    return principals;
  };

  const principalQuery = (principals) =>
    principals.map((principal) => ({
      principalType: principal.principalType,
      ...(principal.principalType !== PrincipalType.PUBLIC && {
        principalId: principal.principalId,
      }),
    }));

  return {
    getUserPrincipals: principalsFor,
    async findAccessibleResources(principals, resourceType, requiredPermission) {
      const aclEntries = connection.collection('aclentries');
      return aclEntries.find({
        $or: principalQuery(principals),
        resourceType,
        permBits: { $in: permissionBitSupersets(requiredPermission) },
      }).distinct('resourceId');
    },
    async getEffectivePermissionsForResources(principals, resourceType, resourceIds) {
      if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
        return new Map();
      }
      const aclEntries = connection.collection('aclentries');
      const entries = await aclEntries.find({
        $or: principalQuery(principals),
        resourceType,
        resourceId: { $in: resourceIds },
      }).toArray();
      const permissions = new Map();
      for (const entry of entries) {
        const id = entry.resourceId.toString();
        permissions.set(id, (permissions.get(id) ?? 0) | entry.permBits);
      }
      return permissions;
    },
    permissionBitSupersets,
    PermissionBits,
  };
}
