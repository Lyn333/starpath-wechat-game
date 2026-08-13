import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { archiveLevel, createLevel, getLevelDetail, listAdminLevels, listPublishedLevels, publishLevelVersion, saveDraftVersion } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { difficultySchema, gridSizeSchema, levelSnapshotSchema, levelStatusSchema, validateLevelSnapshot } from "../shared/levelSchema";

const levelDraftInput = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96),
  gridSize: gridSizeSchema,
  difficulty: difficultySchema,
  snapshot: levelSnapshotSchema,
});

function requireValidSnapshot(gridSize: z.infer<typeof gridSizeSchema>, snapshot: z.infer<typeof levelSnapshotSchema>) {
  const validation = validateLevelSnapshot(gridSize, snapshot);
  if (!validation.valid) throw new TRPCError({ code: "BAD_REQUEST", message: validation.errors.join("；") });
  return validation;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  levelAdmin: router({
    list: adminProcedure.input(z.object({ status: levelStatusSchema.optional(), gridSize: gridSizeSchema.optional(), difficulty: difficultySchema.optional() }).optional()).query(({ input }) => listAdminLevels(input ?? {})),
    get: adminProcedure.input(z.object({ levelId: z.string().min(1) })).query(({ input }) => getLevelDetail(input.levelId)),
    validate: adminProcedure.input(z.object({ gridSize: gridSizeSchema, snapshot: levelSnapshotSchema })).query(({ input }) => validateLevelSnapshot(input.gridSize, input.snapshot)),
    create: adminProcedure.input(levelDraftInput).mutation(({ ctx, input }) => createLevel({ ...input, validation: requireValidSnapshot(input.gridSize, input.snapshot) }, ctx.user.id)),
    saveDraft: adminProcedure.input(levelDraftInput.omit({ slug: true }).extend({ levelId: z.string().min(1) })).mutation(({ ctx, input }) => saveDraftVersion(input.levelId, { ...input, validation: requireValidSnapshot(input.gridSize, input.snapshot) }, ctx.user.id)),
    publish: adminProcedure.input(z.object({ levelId: z.string().min(1), versionId: z.string().min(1) })).mutation(({ ctx, input }) => publishLevelVersion(input.levelId, input.versionId, ctx.user.id)),
    archive: adminProcedure.input(z.object({ levelId: z.string().min(1) })).mutation(({ ctx, input }) => archiveLevel(input.levelId, ctx.user.id)),
    rollback: adminProcedure.input(z.object({ levelId: z.string().min(1), versionId: z.string().min(1) })).mutation(({ ctx, input }) => publishLevelVersion(input.levelId, input.versionId, ctx.user.id, "rollback")),
  }),
  gameLevels: router({
    list: publicProcedure.input(z.object({ gridSize: gridSizeSchema.optional(), difficulty: difficultySchema.optional() }).optional()).query(({ input }) => listPublishedLevels(input ?? {})),
  }),
});

export type AppRouter = typeof appRouter;
