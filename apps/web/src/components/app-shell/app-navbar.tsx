"use client";

import { Divider, NavLink } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AppNavbarProps {
  slug: string;
}

export function AppNavbar({ slug }: AppNavbarProps) {
  const pathname = usePathname();

  if (!slug) {
    return null;
  }

  const base = `/w/${slug}`;
  const reportsHref = `${base}/reports`;
  const projectsHref = `${base}/projects`;
  const settingsHref = `${base}/settings/general`;

  return (
    <>
      <NavLink
        active={
          pathname === reportsHref || pathname.startsWith(`${reportsHref}/`)
        }
        component={Link}
        href={reportsHref}
        label="Reports"
      />
      <NavLink
        active={
          pathname === projectsHref || pathname.startsWith(`${projectsHref}/`)
        }
        component={Link}
        href={projectsHref}
        label="Projects"
      />
      <Divider my="sm" />
      <NavLink
        active={pathname.startsWith(`${base}/settings`)}
        component={Link}
        href={settingsHref}
        label="Settings"
      />
    </>
  );
}
