"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { getProfile, setAutoNudgeEnabled } from "@/actions/profile";
import { fetchSafetyState, unlockAutopilot } from "@/actions/security";
import { toast } from "sonner";

export default function AutoNudgeToggle() {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [safetyState, setSafetyState] = useState(null);
    const [unlocking, setUnlocking] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            const [profileRes, safetyRes] = await Promise.all([getProfile(), fetchSafetyState()]);
            if (profileRes.success) {
                setEnabled(!!profileRes.profile?.autoNudgeEnabled);
            }
            if (safetyRes.success) {
                setSafetyState(safetyRes.state);
            }
            setLoading(false);
        };
        fetch();
    }, []);

    const toggle = async (val) => {
        if (safetyState?.autopilotLocked) {
            toast.error("Autopilot is temporarily locked", {
                description: "Unlock safety mode before enabling auto nudges.",
            });
            return;
        }
        setLoading(true);
        const res = await setAutoNudgeEnabled(val);
        if (res.success) {
            setEnabled(val);
            toast.success(val ? "Auto-nudge enabled" : "Auto-nudge disabled");
        } else {
            toast.error(res.error || "Failed to update setting");
        }
        setLoading(false);
    };

    const handleUnlock = async () => {
        setUnlocking(true);
        const res = await unlockAutopilot();
        if (res.success) {
            toast.success("Safety lock cleared");
            setSafetyState((prev) => (prev ? { ...prev, autopilotLocked: false, reason: null } : null));
        } else {
            toast.error(res.error || "Unable to clear safety lock");
        }
        setUnlocking(false);
    };

    const isLocked = safetyState?.autopilotLocked;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Auto-Execute Suggestions</label>
                <Switch checked={enabled} disabled={loading || isLocked} onCheckedChange={toggle} />
            </div>
            {isLocked && (
                <div className="text-xs text-amber-600 flex items-center gap-2">
                    <span>Guardrails paused automations ({safetyState?.reason || "manual review"}).</span>
                    <button
                        className="underline font-medium"
                        disabled={unlocking}
                        onClick={handleUnlock}
                    >
                        {unlocking ? "Clearing…" : "Unlock"}
                    </button>
                </div>
            )}
        </div>
    );
}
