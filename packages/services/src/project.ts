import type { DbClient } from "@usebugreport/db";
import {
  ingestKeys,
  member,
  projectMembers,
  projects,
  user,
} from "@usebugreport/db";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { createRBACService } from "./rbac";
import type { AuthContext, CursorPage, ProjectRole } from "./types";
import { ServiceError } from "./types";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const bunRuntime = globalThis as typeof globalThis & {
  Bun?: {
    password: {
      hash: (
        password: string,
        options: { algorithm: string; cost: number }
      ) => Promise<string>;
      verify: (password: string, hash: string) => Promise<boolean>;
    };
    randomUUIDv7?: () => string;
  };
};

function generatePrefixedId(prefix: string): string {
  const bun = bunRuntime.Bun;
  const uuid =
    bun && typeof bun.randomUUIDv7 === "function"
      ? bun.randomUUIDv7()
      : crypto.randomUUID();
  return `${prefix}_${uuid.replace(/-/g, "")}`;
}

function slugifyProjectName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project"
  );
}

function randomBase62(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (const byte of bytes) {
    result += BASE62[byte % BASE62.length];
  }
  return result;
}

function generateIngestKeyPlaintext(): string {
  return `ubr_ingest_${randomBase62(32)}`;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id })
  ).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { createdAt: string; id: string };
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    return null;
  }
}

function buildProjectListConditions(
  ctx: AuthContext,
  accessible: string[] | "all",
  decoded: { createdAt: Date; id: string } | null
) {
  const conditions = [eq(projects.organizationId, ctx.organizationId)];

  if (accessible !== "all") {
    if (accessible.length === 0) {
      return null;
    }
    conditions.push(inArray(projects.id, accessible));
  }

  if (decoded) {
    const cursorCondition = or(
      lt(projects.createdAt, decoded.createdAt),
      and(
        eq(projects.createdAt, decoded.createdAt),
        lt(projects.id, decoded.id)
      )
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  return conditions;
}

function hashIngestKey(plaintext: string): Promise<string> {
  const bun = bunRuntime.Bun;
  if (!bun) {
    return Promise.reject(
      new ServiceError("VALIDATION_ERROR", "Password hashing unavailable.")
    );
  }
  return bun.password.hash(plaintext, { algorithm: "bcrypt", cost: 10 });
}

async function countProjectAdmins(
  db: DbClient,
  projectId: string
): Promise<number> {
  const rows = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.role, "admin")
      )
    );
  return rows.length;
}

export function createProjectService(db: DbClient) {
  const rbac = createRBACService(db);

  return {
    async addProjectMember(
      ctx: AuthContext,
      projectId: string,
      input: { role: ProjectRole; userId: string }
    ) {
      await rbac.requireProjectRole(ctx, projectId, "admin");

      const orgMember = await db.query.member.findFirst({
        columns: { id: true },
        where: and(
          eq(member.userId, input.userId),
          eq(member.organizationId, ctx.organizationId)
        ),
      });

      if (!orgMember) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          "User must be a workspace member."
        );
      }

      const existing = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, input.userId)
        ),
      });

      if (existing) {
        throw new ServiceError("CONFLICT", "User is already a project member.");
      }

      await db.insert(projectMembers).values({
        projectId,
        role: input.role,
        userId: input.userId,
      });

      return this.getProjectMember(ctx, projectId, input.userId);
    },

    async createProject(
      ctx: AuthContext,
      input: { name: string; slug?: string }
    ) {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new ServiceError("VALIDATION_ERROR", "Project name is required.");
      }

      const slug = input.slug?.trim() || slugifyProjectName(trimmedName);
      const projectId = generatePrefixedId("prj");
      const ingestKeyId = generatePrefixedId("ing");
      const ingestKeyPlaintext = generateIngestKeyPlaintext();
      const keyPrefix = ingestKeyPlaintext.slice(-8);
      const keyHash = await hashIngestKey(ingestKeyPlaintext);

      const project = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(projects)
          .values({
            id: projectId,
            name: trimmedName,
            organizationId: ctx.organizationId,
            slug,
          })
          .returning();

        if (!created) {
          throw new ServiceError(
            "VALIDATION_ERROR",
            "Failed to create project."
          );
        }

        await tx.insert(projectMembers).values({
          projectId,
          role: "admin",
          userId: ctx.userId,
        });

        await tx.insert(ingestKeys).values({
          id: ingestKeyId,
          keyHash,
          keyPrefix,
          projectId,
        });

        return created;
      });

      return { ingestKeyPlaintext, project };
    },

    async deleteProject(ctx: AuthContext, projectId: string) {
      await rbac.requireProjectRole(ctx, projectId, "admin");
      const existing = await this.getProject(ctx, projectId);
      await db
        .delete(projects)
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.organizationId, ctx.organizationId)
          )
        );
      return existing;
    },

    async getProject(ctx: AuthContext, projectId: string) {
      const allowed = await rbac.canPerform(ctx, projectId, "project:read");
      if (!allowed) {
        throw new ServiceError(
          "FORBIDDEN",
          "Insufficient project permissions."
        );
      }

      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, projectId),
          eq(projects.organizationId, ctx.organizationId)
        ),
      });

      if (!project) {
        throw new ServiceError("NOT_FOUND", "Project not found.");
      }

      return project;
    },

    async getProjectCapabilities(ctx: AuthContext, projectId: string) {
      const resolved = await rbac.resolveProjectRole(ctx, projectId);
      const [canManageMembers, canRotate, canDelete, canUpdate] =
        await Promise.all([
          rbac.canPerform(ctx, projectId, "project:manage_members"),
          rbac.canPerform(ctx, projectId, "ingest:rotate"),
          rbac.canPerform(ctx, projectId, "project:delete"),
          rbac.canPerform(ctx, projectId, "project:update"),
        ]);

      return {
        canDelete,
        canManageMembers,
        canRotate,
        canUpdate,
        effectiveRole: resolved.role,
        source: resolved.source,
      };
    },

    async getProjectMember(
      ctx: AuthContext,
      projectId: string,
      memberUserId: string
    ) {
      await rbac.requireProjectRole(ctx, projectId, "admin");

      const row = await db
        .select({
          email: user.email,
          name: user.name,
          role: projectMembers.role,
          userId: projectMembers.userId,
        })
        .from(projectMembers)
        .innerJoin(user, eq(projectMembers.userId, user.id))
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, memberUserId)
          )
        )
        .limit(1);

      const [memberRow] = row;
      if (!memberRow) {
        throw new ServiceError("NOT_FOUND", "Project member not found.");
      }

      return memberRow;
    },

    async listProjectMembers(ctx: AuthContext, projectId: string) {
      await rbac.requireProjectRole(ctx, projectId, "admin");

      return db
        .select({
          email: user.email,
          name: user.name,
          role: projectMembers.role,
          userId: projectMembers.userId,
        })
        .from(projectMembers)
        .innerJoin(user, eq(projectMembers.userId, user.id))
        .innerJoin(projects, eq(projectMembers.projectId, projects.id))
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projects.organizationId, ctx.organizationId)
          )
        )
        .orderBy(user.name);
    },

    async listProjects(
      ctx: AuthContext,
      options: { cursor?: string; limit?: number } = {}
    ): Promise<CursorPage<typeof projects.$inferSelect>> {
      const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
      const decoded = options.cursor ? decodeCursor(options.cursor) : null;

      if (options.cursor && !decoded) {
        throw new ServiceError("VALIDATION_ERROR", "Invalid cursor.");
      }

      const accessible = await rbac.listAccessibleProjectIds(ctx);
      const conditions = buildProjectListConditions(ctx, accessible, decoded);

      if (!conditions) {
        return {
          data: [],
          page: { hasMore: false, nextCursor: null },
        };
      }

      const rows = await db
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt), desc(projects.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const last = data.at(-1);

      return {
        data,
        page: {
          hasMore,
          nextCursor:
            hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
        },
      };
    },

    async removeProjectMember(
      ctx: AuthContext,
      projectId: string,
      memberUserId: string
    ) {
      await rbac.requireProjectRole(ctx, projectId, "admin");

      const existing = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, memberUserId)
        ),
      });

      if (!existing) {
        throw new ServiceError("NOT_FOUND", "Project member not found.");
      }

      if (existing.role === "admin") {
        const adminCount = await countProjectAdmins(db, projectId);
        if (adminCount <= 1) {
          throw new ServiceError(
            "CONFLICT",
            "Cannot remove the last project admin."
          );
        }
      }

      await db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, memberUserId)
          )
        );
    },

    async rotateIngestKey(ctx: AuthContext, projectId: string) {
      await rbac.requireProjectRole(ctx, projectId, "admin");
      await this.getProject(ctx, projectId);

      const ingestKeyPlaintext = generateIngestKeyPlaintext();
      const keyPrefix = ingestKeyPlaintext.slice(-8);
      const keyHash = await hashIngestKey(ingestKeyPlaintext);
      const ingestKeyId = generatePrefixedId("ing");

      await db.transaction(async (tx) => {
        await tx
          .update(ingestKeys)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(ingestKeys.projectId, projectId),
              isNull(ingestKeys.revokedAt)
            )
          );

        await tx.insert(ingestKeys).values({
          id: ingestKeyId,
          keyHash,
          keyPrefix,
          projectId,
        });
      });

      return { ingestKeyPlaintext, keyPrefix };
    },

    async updateProject(
      ctx: AuthContext,
      projectId: string,
      input: { name?: string; slug?: string }
    ) {
      await rbac.requireProjectRole(ctx, projectId, "admin");

      const updates: Partial<typeof projects.$inferInsert> = {};
      if (input.name !== undefined) {
        const trimmed = input.name.trim();
        if (!trimmed) {
          throw new ServiceError(
            "VALIDATION_ERROR",
            "Project name is required."
          );
        }
        updates.name = trimmed;
      }
      if (input.slug !== undefined) {
        const trimmed = input.slug.trim();
        if (!trimmed) {
          throw new ServiceError(
            "VALIDATION_ERROR",
            "Project slug is required."
          );
        }
        updates.slug = trimmed;
      }

      const [updated] = await db
        .update(projects)
        .set(updates)
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.organizationId, ctx.organizationId)
          )
        )
        .returning();

      if (!updated) {
        throw new ServiceError("NOT_FOUND", "Project not found.");
      }

      return updated;
    },

    async updateProjectMemberRole(
      ctx: AuthContext,
      projectId: string,
      memberUserId: string,
      role: ProjectRole
    ) {
      await rbac.requireProjectRole(ctx, projectId, "admin");

      const existing = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, memberUserId)
        ),
      });

      if (!existing) {
        throw new ServiceError("NOT_FOUND", "Project member not found.");
      }

      if (existing.role === "admin" && role !== "admin") {
        const adminCount = await countProjectAdmins(db, projectId);
        if (adminCount <= 1) {
          throw new ServiceError(
            "CONFLICT",
            "Cannot demote the last project admin."
          );
        }
      }

      await db
        .update(projectMembers)
        .set({ role })
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, memberUserId)
          )
        );

      return this.getProjectMember(ctx, projectId, memberUserId);
    },

    async validateIngestKey(plaintext: string): Promise<{
      organizationId: string;
      projectId: string;
    } | null> {
      const activeKeys = await db
        .select({
          keyHash: ingestKeys.keyHash,
          organizationId: projects.organizationId,
          projectId: projects.id,
        })
        .from(ingestKeys)
        .innerJoin(projects, eq(ingestKeys.projectId, projects.id))
        .where(isNull(ingestKeys.revokedAt));

      const matches = await Promise.all(
        activeKeys.map(async (row) => ({
          row,
          valid: bunRuntime.Bun
            ? await bunRuntime.Bun.password.verify(plaintext, row.keyHash)
            : false,
        }))
      );

      const match = matches.find((entry) => entry.valid);
      if (!match) {
        return null;
      }

      return {
        organizationId: match.row.organizationId,
        projectId: match.row.projectId,
      };
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;

export {
  decodeCursor,
  encodeCursor,
  generateIngestKeyPlaintext,
  generatePrefixedId,
  slugifyProjectName,
};
