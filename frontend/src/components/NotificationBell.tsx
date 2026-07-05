/** In-system alerts (Objective 18), delivered live over WebSocket with a
 * REST fallback for the unread count and history. */
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { notificationsApi, wsUrl } from "../api/services";
import type { Notification } from "../types";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationsApi.unreadCount().then((r) => setCount(r.data.count)).catch(() => {});

    // Live push: new notifications arrive instantly and raise a toast.
    const ws = new WebSocket(wsUrl("notifications"));
    ws.onmessage = (event) => {
      const n = JSON.parse(event.data) as Notification;
      setCount((c) => c + 1);
      setItems((prev) => [n, ...prev]);
      toast(n.title, { description: n.message });
    };

    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => {
      ws.close();
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const toggle = async () => {
    if (!open) {
      const { data } = await notificationsApi.list();
      setItems(data.results);
    }
    setOpen(!open);
  };

  const markAll = async () => {
    await notificationsApi.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={`Notifications, ${count} unread`}
        className="relative rounded-md p-2 text-ink/70 hover:bg-moss focus-visible:outline focus-visible:outline-2 focus-visible:outline-fern"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rust px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="font-display text-sm">Notifications</span>
            <button onClick={markAll} className="text-xs text-fern hover:underline">
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink/50">
                Nothing here yet. Updates about your thesis will appear here.
              </li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className={`border-b border-line px-4 py-3 last:border-0 ${n.is_read ? "" : "bg-fern/5"}`}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-xs text-ink/60">{n.message}</p>
                <p className="mt-1 text-[11px] text-ink/40">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
