"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ClipboardCopy } from "lucide-react";

const SmartPasteListener = () => {
    const router = useRouter();
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        const checkClipboard = async () => {
            if (hasChecked) return;

            try {
                // Only check if document is focused to avoid annoying prompts
                if (!document.hasFocus()) return;

                const text = await navigator.clipboard.readText();
                if (!text) return;

                // Simple Regex for "Paid 500 to Uber" or "Spent 200 on Coffee"
                // Matches: (Paid/Spent/Sent) (Currency Symbol?)(Amount) (to/on/at) (Merchant/Description)
                const regex = /(?:paid|spent|sent)\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d{2})?)\s*(?:to|on|at|for)\s*(.+)/i;
                const match = text.match(regex);

                if (match) {
                    const amount = match[1];
                    const description = match[2].trim();

                    // Avoid re-triggering for the same text if we stored it (optional, skipping for MVP)

                    toast("📋 Smart Paste Detected", {
                        description: `Found: ₹${amount} for "${description}"`,
                        action: {
                            label: "Add Transaction",
                            onClick: () => {
                                const params = new URLSearchParams({
                                    amount,
                                    description,
                                    type: "EXPENSE", // Default to expense for this pattern
                                });
                                router.push(`/transaction/create?${params.toString()}`);
                            },
                        },
                        duration: 8000, // Give user time to react
                        icon: <ClipboardCopy className="h-4 w-4 text-blue-500" />,
                    });
                }
            } catch (err) {
                // Clipboard access denied or empty
                console.log("Smart Paste: Clipboard access denied or empty");
            } finally {
                setHasChecked(true);
            }
        };

        // Check on mount
        checkClipboard();

        // Also check when window regains focus (e.g. user copied from another app and switched back)
        window.addEventListener("focus", checkClipboard);
        return () => window.removeEventListener("focus", checkClipboard);
    }, [hasChecked, router]);

    return null; // Invisible component
};

export default SmartPasteListener;
