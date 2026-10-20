"use client";

import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { Laptop, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { updatePreferences } from "@/actions/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

type Props = { emailNotifications: boolean; signInMethods: string[] };

export function PreferencesForm({ emailNotifications, signInMethods }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notify, setNotify] = useState(emailNotifications);
  const [pending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []); // theme is unknown during SSR

  const onNotifyChange = (checked: boolean) => {
    setNotify(checked); // optimistic
    startTransition(async () => {
      const res = await updatePreferences({ emailNotifications: checked });
      if (res.ok) toast.success(res.message);
      else {
        setNotify(!checked);
        toast.error(res.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Preferences</CardTitle>
        <CardDescription>Appearance and notifications.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Theme</legend>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const selected = mounted && theme === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    selected && "border-primary bg-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={selected}
                    onChange={() => setTheme(value)}
                    className="sr-only"
                  />
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="email-notifications">Email notifications</Label>
            <p id="email-notifications-desc" className="text-sm text-muted-foreground">
              Receive project reminders by email.
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={notify}
            onCheckedChange={onNotifyChange}
            disabled={pending}
            aria-describedby="email-notifications-desc"
          />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Sign-in methods</p>
          <p className="text-sm text-muted-foreground">{signInMethods.join(" · ") || "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
