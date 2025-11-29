"use client";

import { useState } from "react";
import { Star, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

const DISMISS_REASONS = [
    { value: "not_relevant", label: "Not relevant to me" },
    { value: "bad_timing", label: "Bad timing" },
    { value: "too_frequent", label: "Too many nudges" },
    { value: "dont_understand", label: "Didn't understand it" },
    { value: "other", label: "Other reason" },
];

export default function FeedbackModal({ nudge, isOpen, onClose, onSubmit }) {
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState("");
    const [dismissReason, setDismissReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const isRejected = nudge?.status === "rejected";

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const response = await fetch(`/api/nudges/${nudge.id}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rating: rating || null,
                    comment: comment || null,
                    wasHelpful: rating >= 4 ? true : rating <= 2 ? false : null,
                    dismissReason: isRejected ? dismissReason : null,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Thanks for your feedback! 🎉", {
                    description: "We're learning your preferences to serve you better.",
                });
                onSubmit?.(data.nudge);
                onClose();

                // Reset form
                setRating(0);
                setComment("");
                setDismissReason("");
            } else {
                toast.error("Failed to submit feedback");
            }
        } catch (error) {
            console.error("Error submitting feedback:", error);
            toast.error("Failed to submit feedback");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>How was this nudge?</DialogTitle>
                    <DialogDescription>
                        Your feedback helps us personalize your experience
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Star Rating */}
                    <div className="space-y-2">
                        <Label>Rate this nudge</Label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="transition-transform hover:scale-110"
                                >
                                    <Star
                                        className={`h-8 w-8 ${star <= (hoveredRating || rating)
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-gray-300"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        {rating > 0 && (
                            <p className="text-sm text-muted-foreground">
                                {rating === 1 && "Not helpful at all"}
                                {rating === 2 && "Somewhat unhelpful"}
                                {rating === 3 && "Neutral"}
                                {rating === 4 && "Helpful"}
                                {rating === 5 && "Very helpful!"}
                            </p>
                        )}
                    </div>

                    {/* Dismiss Reason (if rejected) */}
                    {isRejected && (
                        <div className="space-y-2">
                            <Label>Why did you dismiss this?</Label>
                            <RadioGroup value={dismissReason} onValueChange={setDismissReason}>
                                {DISMISS_REASONS.map((reason) => (
                                    <div key={reason.value} className="flex items-center space-x-2">
                                        <RadioGroupItem value={reason.value} id={reason.value} />
                                        <Label htmlFor={reason.value} className="font-normal cursor-pointer">
                                            {reason.label}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    )}

                    {/* Comment */}
                    <div className="space-y-2">
                        <Label htmlFor="comment">
                            Additional feedback <span className="text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                            id="comment"
                            placeholder="Tell us more about your experience..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            className="resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Skip
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || (isRejected && !dismissReason)}>
                        {submitting ? "Submitting..." : "Submit Feedback"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
