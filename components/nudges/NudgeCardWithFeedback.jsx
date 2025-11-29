"use client";

import { useState } from "react";
import NudgeFeedbackButton from "@/components/nudges/NudgeFeedbackButton";

/**
 * Example component showing how to integrate feedback into nudge displays
 * 
 * Usage:
 * 1. Import this component or NudgeFeedbackButton directly
 * 2. Pass the nudge object (must have id, status, and other nudge fields)
 * 3. Optionally handle the feedback submission callback
 */

export default function NudgeCardWithFeedback({ nudge, onUpdate }) {
    const [currentNudge, setCurrentNudge] = useState(nudge);

    const handleFeedbackSubmit = (updatedNudge) => {
        setCurrentNudge(updatedNudge);
        onUpdate?.(updatedNudge);
    };

    return (
        <div className="border border-gray-800 rounded-lg p-4 hover:bg-gray-900/50 transition-colors">
            <div className="flex items-start gap-4">
                {/* Nudge Content */}
                <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                        {currentNudge.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {currentNudge.reason}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>
                            {new Date(currentNudge.createdAt).toLocaleDateString()}
                        </span>
                        {currentNudge.amount && (
                            <span className="text-white font-medium">
                                ₹{parseFloat(currentNudge.amount).toFixed(0)}
                            </span>
                        )}
                    </div>

                    {/* Feedback Button - Add this to any nudge display */}
                    <div className="mt-4 pt-3 border-t border-gray-800">
                        <NudgeFeedbackButton
                            nudge={currentNudge}
                            onFeedbackSubmit={handleFeedbackSubmit}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Integration Instructions:
 * 
 * 1. For existing nudge displays (like in nudges/page.jsx):
 *    Add the NudgeFeedbackButton component inside each nudge card:
 * 
 *    ```jsx
 *    import NudgeFeedbackButton from "@/components/nudges/NudgeFeedbackButton";
 * 
 *    // Inside your nudge map:
 *    <div className="mt-4 pt-3 border-t border-gray-800">
 *      <NudgeFeedbackButton
 *        nudge={nudge}
 *        onFeedbackSubmit={(updated) => {
 *          // Optional: refresh nudge list or update state
 *        }}
 *      />
 *    </div>
 *    ```
 * 
 * 2. The feedback button will automatically:
 *    - Show thumbs up/down for quick feedback
 *    - Open detailed modal for ratings and comments
 *    - Display feedback status if already submitted
 *    - Update the nudge record in the database
 *    - Trigger personalization updates
 * 
 * 3. To view analytics:
 *    - Navigate to /analytics page
 *    - View acceptance rates, effectiveness by type
 *    - See personalization insights and recommendations
 */
