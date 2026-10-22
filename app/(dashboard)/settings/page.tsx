import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { AvatarForm } from "@/components/settings/avatar-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { LocationForm } from "@/components/settings/location-form";
import { getOrCreateJobProfile } from "@/lib/data/jobs";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      bio: true,
      emailNotifications: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) redirect("/login");
  const jobProfile = await getOrCreateJobProfile(session!.user.id);

  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" description="Manage your profile and preferences." />
      <div className="grid max-w-3xl gap-6">
        <AvatarForm name={user.name} email={user.email} image={user.image} />
        <ProfileForm defaultValues={{ name: user.name ?? "", bio: user.bio ?? "" }} email={user.email} />
        <PreferencesForm
          emailNotifications={user.emailNotifications}
          signInMethods={[
            ...(user.passwordHash ? ["Email & password"] : []),
            ...user.accounts.map((a) => (a.provider === "github" ? "GitHub" : a.provider === "google" ? "Google" : a.provider)),
          ]}
        />
        <LocationForm
          initial={{
            currentLocation: jobProfile.currentLocation,
            preferredLocations: jobProfile.preferredLocations,
            onlyPreferredLocations: jobProfile.onlyPreferredLocations,
            wantsRelocation: jobProfile.wantsRelocation,
          }}
        />
      </div>
    </>
  );
}
