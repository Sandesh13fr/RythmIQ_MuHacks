"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FeedbackModal from "./FeedbackModal";

export default function NudgeFeedbackButton({ nudge, onFeedbackSubmit, className }) {
    const [showModal, setShowModal] = useState(false);
    const [quickFeedback, setQuickFeedback] = useState(null);

    const hasFeedback = nudge.feedbackRating || nudge.wasHelpful !== null;

    const handleQuickFeedback = async (helpful) => {
        setQuickFeedback(helpful);

        try {
            const response = await fetch(`/api/nudges/${nudge.id}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wasHelpful: helpful,
                }),
            });

            const data = await response.json();
            if (data.success) {
                onFeedbackSubmit?.(data.nudge);
            }
        } catch (error) {
            console.error("Error submitting quick feedback:", error);
            setQuickFeedback(null);
        }
    };

    if (hasFeedback) {
        return (
            <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
                {nudge.wasHelpful ? (
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                ) : nudge.wasHelpful === false ? (
                    <ThumbsDown className="h-4 w-4 text-red-600" />
                ) : null}
                {nudge.feedbackRating && (
                    <span>Rated {nudge.feedbackRating}/5</span>
                )}
                <span className="text-xs">Thanks for feedback!</span>
            </div>
        );
    }

    return (
        <>
            <div className={cn("flex items-center gap-2", className)}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickFeedback(true)}
                    disabled={quickFeedback !== null}
                    className={cn(
                        "h-8 px-2",
                        quickFeedback === true && "bg-green-100 text-green-700"
                    )}
                >
                    <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickFeedback(false)}
                    disabled={quickFeedback !== null}
                    className={cn(
                        "h-8 px-2",
                        quickFeedback === false && "bg-red-100 text-red-700"
                    )}
                >
                    <ThumbsDown className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowModal(true)}
                    className="h-8 px-2"
                >
                    <MessageSquare className="h-4 w-4" />
                    <span className="ml-1 text-xs">Feedback</span>
                </Button>
            </div>

            <FeedbackModal
                nudge={nudge}
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={onFeedbackSubmit}
            />
        </>
    );
}
