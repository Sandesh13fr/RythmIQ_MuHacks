"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const VoiceAgent = () => {
    const router = useRouter();
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const recognitionRef = useRef(null);

    useEffect(() => {
        if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = "en-US";

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                processVoiceCommand(transcript);
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Voice Agent Error:", event.error);
                setIsListening(false);
                toast.error("Could not hear you. Try again.");
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
            toast("🎙️ Listening...", { duration: 2000 });
        }
    };

    const processVoiceCommand = async (text) => {
        setIsProcessing(true);
        toast.info(`Heard: "${text}"`);

        // Simple Regex Parsing (Client-side for speed)
        // Matches: "Spent 500 on Food" or "Paid 200 for Taxi"
        const regex = /(?:paid|spent|sent|added)\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d{2})?)\s*(?:to|on|at|for)\s*(.+)/i;
        const match = text.match(regex);

        if (match) {
            const amount = match[1];
            const description = match[2].trim();

            toast.success("✅ Processed Command", {
                description: `Adding ₹${amount} for ${description}`,
            });

            // Redirect to transaction form with pre-filled data
            const params = new URLSearchParams({
                amount,
                description,
                type: "EXPENSE",
            });
            router.push(`/transaction/create?${params.toString()}`);
        } else if (/panic mode|activate panic|enable panic/i.test(text)) {
            toast.info("Activating Panic Mode...");
            try {
                const res = await fetch("/api/RythmIQ-ai/panic-mode", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                    toast.success("Panic mode activated");
                    router.refresh();
                } else {
                    toast.error(data.error || "Failed to activate");
                }
            } catch (err) {
                toast.error("Failed to activate panic mode");
            }
        } else if (/pause subscriptions|freeze subscriptions|pause non-essentials/i.test(text)) {
            toast.info("Pausing recurring subscriptions...");
            try {
                const res = await fetch("/api/transactions/recurrence/pause", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                    toast.success(`Paused ${data.updated} subscriptions`);
                } else {
                    toast.error(data.error || "Failed to pause");
                }
            } catch (err) {
                toast.error("Failed to pause subscriptions");
            }
        } else if (/convert\s+(.*?)\s+to\s+recurring/i.test(text)) {
            const m = text.match(/convert\s+(.*?)\s+to\s+recurring/i);
            const merchant = m && m[1] ? m[1].trim() : null;
            if (merchant) {
                const params = new URLSearchParams({ description: merchant, isRecurring: "true", type: "EXPENSE" });
                router.push(`/transaction/create?${params.toString()}`);
                toast.success(`Opening transaction creation for ${merchant}`);
            } else {
                toast.error("Couldn't find merchant to convert");
            }
        } else {
            toast.error("Could not understand command. Try: 'Spent 100 on Coffee'");
        }
        setIsProcessing(false);
    };

    // Support higher-level Jarvis commands
    useEffect(() => {
        // noop
    }, []);

    if (!recognitionRef.current) return null; // Hide if not supported

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Button
                variant={isListening ? "destructive" : "default"}
                size="icon"
                className={`h-14 w-14 rounded-full shadow-xl transition-all duration-300 ${isListening ? "animate-pulse scale-110" : "hover:scale-105"}`}
                onClick={toggleListening}
                disabled={isProcessing}
            >
                {isProcessing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : isListening ? (
                    <MicOff className="h-6 w-6" />
                ) : (
                    <Mic className="h-6 w-6" />
                )}
            </Button>
        </div>
    );
};

export default VoiceAgent;
