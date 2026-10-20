"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { currentUserId, unstable_update } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  preferencesSchema,
  profileSchema,
} from "@/lib/validations";
import type { ActionResult } from "@/types/actions";

const UNAUTHORIZED = { ok: false, error: "You must be signed in" } as const;

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: parsed.data.name, bio: parsed.data.bio || null },
    select: { name: true },
  });

  await unstable_update({ user: { id: userId, name: user.name } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved" };
}

export async function updatePreferences(input: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;

  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  return { ok: true, message: "Preferences saved" };
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ok: false, error: "Avatar storage isn't configured (BLOB_READ_WRITE_TOKEN)." };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image" };
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use PNG, JPEG, WebP or GIF" };
  }
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "Image must be 2 MB or smaller" };

  const ext = file.type.split("/")[1];
  const blob = await put(`avatars/${userId}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true, // new URL each upload → no stale CDN cache
    contentType: file.type,
  });

  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  await prisma.user.update({ where: { id: userId }, data: { image: blob.url } });

  // Clean up our own previous upload (never touch OAuth provider avatars).
  if (previous?.image?.includes(".blob.vercel-storage.com")) {
    await del(previous.image).catch(() => undefined);
  }

  await unstable_update({ user: { id: userId, image: blob.url } });
  revalidatePath("/", "layout");
  return { ok: true, data: { url: blob.url }, message: "Avatar updated" };
}

export async function removeAvatar(): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;

  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  await prisma.user.update({ where: { id: userId }, data: { image: null } });
  if (previous?.image?.includes(".blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(previous.image).catch(() => undefined);
  }

  await unstable_update({ user: { id: userId, image: null } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Avatar removed" };
}
