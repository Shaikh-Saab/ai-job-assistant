"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { removeAvatar, uploadAvatar } from "@/actions/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@/lib/validations";
import { initials } from "@/lib/utils";

type Props = { name: string | null; email: string; image: string | null };

export function AvatarForm({ name, email, image }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(image);
  const [pending, startTransition] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    // Client-side checks for fast feedback; the server re-validates.
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return toast.error("Use PNG, JPEG, WebP or GIF");
    if (file.size > AVATAR_MAX_BYTES) return toast.error("Image must be 2 MB or smaller");

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    const fd = new FormData();
    fd.append("avatar", file);
    startTransition(async () => {
      const res = await uploadAvatar(fd);
      URL.revokeObjectURL(localUrl);
      if (res.ok) {
        setPreview(res.data?.url ?? null);
        toast.success(res.message);
        router.refresh();
      } else {
        setPreview(image);
        toast.error(res.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const onRemove = () =>
    startTransition(async () => {
      const res = await removeAvatar();
      if (res.ok) {
        setPreview(null);
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Avatar</CardTitle>
        <CardDescription>PNG, JPEG, WebP or GIF, up to 2 MB.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 text-xl">
          {preview && <AvatarImage src={preview} alt="Your avatar" />}
          <AvatarFallback>{initials(name, email)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="avatar-input"
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            tabIndex={-1}
            aria-hidden="true"
          />
          <Button variant="outline" loading={pending} onClick={() => inputRef.current?.click()}>
            {!pending && <Upload aria-hidden="true" />} Upload new
          </Button>
          {preview && (
            <Button variant="ghost" disabled={pending} onClick={onRemove}>
              <Trash2 aria-hidden="true" /> Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
