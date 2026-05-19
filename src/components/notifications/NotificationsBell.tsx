import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationsBell() {
  const { data, unreadCount, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const list = data ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-white/50 h-9 w-9 transition-corporate">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-primary text-[10px] font-semibold text-primary-foreground rounded-full flex items-center justify-center shadow-glow-primary">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-xl liquid-glass-tooltip border-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">{unreadCount} não lidas</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost" size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sem notificações por aqui.
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.04]">
              {list.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => n.link && navigate(n.link)}
                    className={`w-full text-left px-4 py-3 hover:bg-white/40 transition-colors ${!n.read_at ? "bg-primary/[0.04]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-1">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
