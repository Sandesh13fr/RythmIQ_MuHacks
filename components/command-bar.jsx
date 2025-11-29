"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CommandBar = () => {
    const router = useRouter();
    const [command, setCommand] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCommand = async (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        setIsProcessing(true);

        // Parse command: "send 500 to john@example.com"
        const sendMatch = command.toLowerCase().match(/send\s+(?:rs\.?|₹)?\s*(\d+)\s+to\s+(.+)/i);

        if (sendMatch) {
            const amount = sendMatch[1];
            const recipient = sendMatch[2].trim();

            toast.success(`Command Detected`, {
                description: `Sending ₹${amount} to ${recipient}`,
            });

            // Store command in sessionStorage for Pay page to pick up
            sessionStorage.setItem("voiceCommand", JSON.stringify({
                action: "send",
                amount,
                recipient,
                timestamp: Date.now(),
            }));

            // Navigate to Pay page
            router.push("/pay?voice=true");
        } else {
            toast.error("Invalid command. Try: 'send 500 to friend@example.com'");
        }

        setCommand("");
        setIsProcessing(false);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
            <form onSubmit={handleCommand} className="relative">
                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl border border-purple-500/20 rounded-full p-2 shadow-2xl">
                    <Zap className="h-5 w-5 text-purple-500 ml-3" />
                    <Input
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Type: send 500 to friend@example.com"
                        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-gray-400"
                        disabled={isProcessing}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={isProcessing || !command.trim()}
                        className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CommandBar;
