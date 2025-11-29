"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function VoiceTransaction({ onScanComplete }) {
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
                handleVoiceInput(transcript);
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
                toast.error("Could not hear you. Please try again.");
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }, []);

    const startListening = () => {
        if (!recognitionRef.current) {
            toast.error("Voice input not supported in this browser");
            return;
        }
        setIsListening(true);
        recognitionRef.current.start();
        toast.info("Listening... Speak now");
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    const handleVoiceInput = async (text) => {
        setIsProcessing(true);
        toast.info(`Heard: "${text}". Processing...`);

        try {
            const response = await fetch("/api/RythmIQ-ai/parse-transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });

            const data = await response.json();

            if (data.success) {
                onScanComplete(data.data);
                toast.success("Transaction details filled!");
            } else {
                toast.error("Could not understand transaction details");
            }
        } catch (error) {
            console.error("Error parsing voice input:", error);
            toast.error("Failed to process voice input");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            variant="outline"
            className="w-full h-24 sm:h-28 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-purple-200 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-300 text-purple-700 hover:text-purple-700 rounded-lg transition-colors"
        >
            {isProcessing ? (
                <>
                    <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin" />
                    <span className="text-sm sm:text-base font-medium">Processing...</span>
                </>
            ) : isListening ? (
                <>
                    <MicOff className="h-6 w-6 sm:h-7 sm:w-7 text-red-500 animate-pulse" />
                    <div className="text-center">
                        <span className="text-sm sm:text-base font-medium block">Listening...</span>
                        <span className="text-xs text-purple-600">Stop speaking</span>
                    </div>
                </>
            ) : (
                <>
                    <Mic className="h-6 w-6 sm:h-7 sm:w-7" />
                    <div className="text-center">
                        <span className="text-sm sm:text-base font-medium block">Voice Entry</span>
                        <span className="text-xs text-purple-600">Speak now</span>
                    </div>
                </>
            )}
        </Button>
    );
}
