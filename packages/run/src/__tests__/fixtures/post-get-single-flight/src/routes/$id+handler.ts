import db from "../db";

export const POST: MarkoRun.Handler = async (ctx) => {
  const { id } = ctx.params;
  const body = await ctx.request.formData();

  const record = db.get(id);
  db.set(id, { ...record, name: body.get("name") });

  return ctx.fetch(ctx.url);
}