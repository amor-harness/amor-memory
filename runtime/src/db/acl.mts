import { PermissionBits, PrincipalType } from '@amor-harness/data-provider';
import type { Connection, Mongoose, Types } from 'mongoose';

/** One principal an access check can run for; the public principal never
 *  carries an id. Injected stores describe their principals with plain strings,
 *  so the kind stays open to them. */
interface ResolvedPrincipal {
  principalType: PrincipalType | string;
  principalId?: string | Types.ObjectId;
}

/** One `users` document, projected to the role and source id a lookup needs. */
interface PrincipalUserRow {
  _id: Types.ObjectId;
  role?: string;
  idOnTheSource?: string | null;
}

/** One `groups` document, projected to its id. */
interface PrincipalGroupRow {
  _id: Types.ObjectId;
}

interface PrincipalLookup {
  userId?: string | Types.ObjectId;
  role?: string;
  idOnTheSource?: string | null;
}

function permissionBitSupersets(requiredBits: number): number[] {
  const bits: number[] = [];
  for (let value = 0; value <= 63; value += 1) {
    if ((value & requiredBits) === requiredBits) {
      bits.push(value);
    }
  }
  return bits;
}

/** ACL helpers the memory store layer needs. They mirror data-schemas'
 *  aclEntry/userGroup methods, but read through the plugin's mongoose models. */
interface AclEntryRow {
  resourceId: Types.ObjectId | string;
  permBits: number;
}

export function createAclDeps(mongoose: Mongoose | Connection) {
  const connection: Connection =
    'connection' in mongoose ? mongoose.connection : (mongoose as Connection);
  const types = 'Types' in mongoose ? mongoose.Types : (mongoose as Connection).base.Types;
  const principalsFor = async ({
    userId,
    role,
    idOnTheSource,
  }: PrincipalLookup): Promise<ResolvedPrincipal[]> => {
    const users = connection.collection<PrincipalUserRow>('users');
    const groups = connection.collection<PrincipalGroupRow>('groups');
    if (userId == null) {
      throw new Error('userId is required');
    }
    const userObjectId = typeof userId === 'string' ? new types.ObjectId(userId) : userId;
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
    const principals: ResolvedPrincipal[] = [
      { principalType: PrincipalType.USER, principalId: userObjectId },
    ];
    if (typeof userRole === 'string' && userRole.trim()) {
      principals.push({ principalType: PrincipalType.ROLE, principalId: userRole });
    }
    const memberId = memberIdOnTheSource || String(userId);
    const memberGroups = await groups
      .find({ memberIds: memberId }, { projection: { _id: 1 } })
      .toArray();
    for (const group of memberGroups) {
      principals.push({ principalType: PrincipalType.GROUP, principalId: group._id });
    }
    principals.push({ principalType: PrincipalType.PUBLIC });
    return principals;
  };

  const principalQuery = (principals: ResolvedPrincipal[]): ResolvedPrincipal[] =>
    principals.map((principal) => ({
      principalType: principal.principalType,
      ...(principal.principalType !== PrincipalType.PUBLIC && {
        principalId: principal.principalId,
      }),
    }));

  return {
    getUserPrincipals: principalsFor,
    async findAccessibleResources(
      principals: ResolvedPrincipal[],
      resourceType: string,
      requiredPermission: number,
    ): Promise<Types.ObjectId[]> {
      const aclEntries = connection.collection<AclEntryRow>('aclentries');
      return aclEntries.distinct('resourceId', {
        $or: principalQuery(principals),
        resourceType,
        permBits: { $in: permissionBitSupersets(requiredPermission) },
      }) as Promise<Types.ObjectId[]>;
    },
    async getEffectivePermissionsForResources(
      principals: ResolvedPrincipal[],
      resourceType: string,
      resourceIds: Array<string | Types.ObjectId>,
    ): Promise<Map<string, number>> {
      if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
        return new Map<string, number>();
      }
      const aclEntries = connection.collection<AclEntryRow>('aclentries');
      const entries = await aclEntries
        .find({
          $or: principalQuery(principals),
          resourceType,
          resourceId: { $in: resourceIds },
        })
        .toArray();
      const permissions = new Map<string, number>();
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
