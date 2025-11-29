"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MessageCircle, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
    { value: "en", label: "English" },
    { value: "hi", label: "हिंदी" },
    { value: "hinglish", label: "Hinglish" },
];

const QUICK_QUESTIONS = [
    "How much can I spend today?",
    "Why am I running low this week?",
    "What should I save before payday?",
];

export default function MiniCoach() {
    const [language, setLanguage] = useState("en");
    const [question, setQuestion] = useState(QUICK_QUESTIONS[0]);
    const [answer, setAnswer] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [speaking, setSpeaking] = useState(false);

    const askCoach = useCallback(
        async (prompt) => {
            const query = prompt || question;
            if (!query.trim()) return;

            setLoading(true);
            try {
                const res = await fetch("/api/coach", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: query, locale: language }),
                });
                const data = await res.json();
                if (!data.success) {
                    throw new Error(data.error || "Coach unavailable");
                }

                setAnswer(data.answer);
                setHistory((prev) => [{ question: query, answer: data.answer }, ...prev].slice(0, 5));
            } catch (error) {
                console.error("Coach error", error);
            } finally {
                setLoading(false);
            }
        },
        [language, question]
    );

    const handleSpeak = useCallback(() => {
        if (!answer?.message || typeof window === "undefined" || !window.speechSynthesis) {
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(answer.message);
        utterance.lang = answer.speechLocale || "en-IN";
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
    }, [answer]);

    const stopSpeak = useCallback(() => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        setSpeaking(false);
    }, []);

    const contextLine = useMemo(() => {
        if (!answer?.context) return null;
        const parts = [];
        if (answer.context.dailyAllowance) {
            parts.push(`Daily allowance ₹${answer.context.dailyAllowance}`);
        }
        if (answer.context.riskLevel) {
            parts.push(`Risk ${answer.context.riskLevel}`);
        }
        if (answer.context.upcomingBills) {
            parts.push(`Bills ₹${answer.context.upcomingBills} due soon`);
        }
        return parts.join(" · ");
    }, [answer]);

    return (
        <Card className="border-primary/20">
            <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MessageCircle className="h-5 w-5 text-primary" />
                            Mini Coach
                        </CardTitle>
                        <CardDescription>
                            Ask RythmIQ anything about spending, savings, or why cash looks tight. Answers adapt to your data.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.value}
                                className={cn(
                                    "px-3 py-1 text-xs rounded-full border",
                                    language === lang.value
                                        ? "bg-primary text-white border-primary"
                                        : "text-muted-foreground border-muted"
                                )}
                                onClick={() => setLanguage(lang.value)}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {QUICK_QUESTIONS.map((prompt) => (
                        <Button
                            key={prompt}
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                setQuestion(prompt);
                                askCoach(prompt);
                            }}
                            disabled={loading}
                        >
                            {prompt}
                        </Button>
                    ))}
                </div>

                <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything about your budget, bills, or savings goals..."
                    className="min-h-[90px]"
                />

                <div className="flex gap-3">
                    <Button onClick={() => askCoach()} disabled={loading}>
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4 mr-1" />}
                        {loading ? "Thinking" : "Ask Coach"}
                    </Button>
                    <Button variant="outline" onClick={() => setQuestion(QUICK_QUESTIONS[0])} disabled={loading}>
                        Reset
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={speaking ? stopSpeak : handleSpeak}
                        disabled={!answer?.message}
                    >
                        {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                </div>

                {answer && (
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">
                            Response ({answer.language})
                        </p>
                        <p className="text-base">{answer.message}</p>
                        {contextLine && (
                            <p className="text-xs text-muted-foreground">{contextLine}</p>
                        )}
                    </div>
                )}

                {history.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent questions</p>
                        <ul className="space-y-1 text-sm">
                            {history.map((entry, idx) => (
                                <li key={`${entry.question}-${idx}`} className="border-l-2 border-primary/40 pl-2">
                                    <span className="font-medium">Q:</span> {entry.question}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
