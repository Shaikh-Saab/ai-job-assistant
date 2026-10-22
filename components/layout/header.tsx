import { MobileNav } from "@/components/layout/mobile-nav";
import { TextSizeToggle } from "@/components/a11y/text-size-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserNav } from "@/components/layout/user-nav";
import { LogoMark } from "@/components/brand/logo";

type HeaderProps = { user: { name?: string | null; email?: string | null; image?: string | null } };

export function Header({ user }: HeaderProps) {
  const today = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date());

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/75 px-4 backdrop-blur-md sm:px-6">
      <MobileNav />
      <LogoMark className="h-5 w-5 lg:hidden" />
      <p className="eyebrow hidden sm:block lg:ml-4" suppressHydrationWarning>
        {today}
      </p>
      <div className="flex-1" />
      <TextSizeToggle className="hidden sm:inline-flex" />
      <ThemeToggle />
      <UserNav {...user} />
    </header>
  );
}
