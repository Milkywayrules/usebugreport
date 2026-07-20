"use client";

import { Avatar, Menu, UnstyledButton } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";

interface UserMenuProps {
  user?: {
    email?: string | null;
    image?: string | null;
    name?: string | null;
  } | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();

  const handleSignOut = useCallback(() => {
    authClient
      .signOut()
      .then(() => {
        router.push("/login");
        router.refresh();
      })
      .catch(() => undefined);
  }, [router]);

  const initials =
    user?.name?.slice(0, 2).toUpperCase() ??
    user?.email?.slice(0, 2).toUpperCase() ??
    "?";

  return (
    <Menu position="bottom-end" shadow="md" width={200}>
      <Menu.Target>
        <UnstyledButton aria-label="User menu">
          <Avatar radius="xl" size="sm" src={user?.image ?? undefined}>
            {initials}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component={Link} href="/settings/account">
          Account
        </Menu.Item>
        <Menu.Item component={Link} href="/settings/workspaces">
          Workspaces
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={handleSignOut}>Logout</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
