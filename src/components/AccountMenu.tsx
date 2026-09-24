"use client";

import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import {
  Archive, Bell, BellOff, ChefHat, ChevronDown, LogOut,
  Moon, Settings, Sun, Webhook,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { usePushSubscription } from "@/lib/use-push-subscription";
import { signOut } from "@/lib/auth-client";

/**
 * Everything in the home header except "add an item": the side pages, theme,
 * push and the account actions.
 *
 * These used to be five 44px circles on a row of their own, costing 58px of
 * the first screen for things used at most once a day. Collapsing them behind
 * the user name keeps the header to a single line.
 */
export function AccountMenu({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const { theme, toggle: toggleTheme } = useTheme();
  const {
    subscribed: pushSubscribed,
    loading: pushLoading,
    supported: pushSupported,
    iosNeedsPWA,
    toggle: togglePush,
  } = usePushSubscription(true);

  return (
    <Menu.Root>
      <Menu.Trigger className="lt-account-trigger" aria-label="账号与设置">
        <span className="lt-account-name">{userName}</span>
        <ChevronDown size={14} strokeWidth={2} className="lt-account-caret" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner className="lt-menu-positioner" side="bottom" align="end" sideOffset={8}>
          <Menu.Popup className="lt-menu">
            <Menu.LinkItem className="lt-menu-item" render={<Link href="/recipes" />}>
              <ChefHat size={16} strokeWidth={1.8} />
              菜单
            </Menu.LinkItem>
            <Menu.LinkItem className="lt-menu-item" render={<Link href="/archived" />}>
              <Archive size={16} strokeWidth={1.8} />
              已归档
            </Menu.LinkItem>

            <Menu.Separator className="lt-menu-sep" />

            {/* Stays open — the point of switching theme is watching it change */}
            <Menu.Item className="lt-menu-item" closeOnClick={false} onClick={toggleTheme}>
              {theme === "dark"
                ? <Sun size={16} strokeWidth={1.8} />
                : <Moon size={16} strokeWidth={1.8} />}
              {theme === "dark" ? "浅色模式" : "深色模式"}
            </Menu.Item>

            {/* Subscribing happens in place; only an active subscription links out */}
            {pushSupported && !pushSubscribed && !iosNeedsPWA && (
              <Menu.Item
                className="lt-menu-item"
                closeOnClick={false}
                disabled={pushLoading}
                onClick={togglePush}
              >
                <Bell size={16} strokeWidth={1.8} />
                {pushLoading ? "开启中…" : "开启推送通知"}
              </Menu.Item>
            )}
            {pushSupported && pushSubscribed && (
              <Menu.LinkItem className="lt-menu-item" render={<Link href="/webhook" />}>
                <Webhook size={16} strokeWidth={1.8} />
                通知与 Webhook
              </Menu.LinkItem>
            )}
            {iosNeedsPWA && (
              <p className="lt-menu-note">
                <BellOff size={16} strokeWidth={1.8} />
                <span>iOS 推送需先在 Safari 分享菜单里「添加到主屏幕」，再从主屏幕打开</span>
              </p>
            )}

            <Menu.Separator className="lt-menu-sep" />

            {isAdmin && (
              <Menu.LinkItem className="lt-menu-item" render={<Link href="/admin/users" />}>
                <Settings size={16} strokeWidth={1.8} />
                用户管理
              </Menu.LinkItem>
            )}
            <Menu.Item
              className="lt-menu-item lt-menu-item--danger"
              onClick={() => signOut().then(() => (window.location.href = "/auth/login"))}
            >
              <LogOut size={16} strokeWidth={1.8} />
              退出登录
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
