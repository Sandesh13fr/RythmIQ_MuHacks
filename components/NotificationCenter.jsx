"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);

    const fetchNotifications = async () => {
        try {
            const response = await fetch("/api/notifications", { cache: "no-store" });
            const payload = await response.text();
            let data = null;
            if (payload) {
                try {
                    data = JSON.parse(payload);
                } catch (parseError) {
                    throw new Error(
                        response.ok
                            ? "Malformed notifications payload"
                            : payload.slice(0, 160) || "Failed to load notifications"
                    );
                }
            }

            if (response.ok && data?.success) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            } else if (!response.ok) {
                throw new Error(data?.error || "Unable to load notifications");
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="p-2 border-b">
                    <h3 className="font-semibold text-sm">AI Notifications</h3>
                </div>
                {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                        No notifications yet
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className="flex items-start gap-3 p-3 cursor-pointer"
                            >
                                <span className="text-xl flex-shrink-0">{notification.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                        {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(notification.timestamp).toLocaleDateString()}
                                    </p>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
