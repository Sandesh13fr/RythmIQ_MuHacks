"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExplainabilityModal from "./ExplainabilityModal";

/**
 * WhyThisButton - Trigger explainability modal
 * 
 * Usage:
 * <WhyThisButton type="nudge" id={nudgeId} />
 * <WhyThisButton type="allowance" />
 * <WhyThisButton type="risk" />
 */

export default function WhyThisButton({ type, id, label = "Why this?", className = "" }) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(true)}
                className={`text-purple-600 hover:text-purple-700 hover:bg-purple-50 ${className}`}
            >
                <HelpCircle className="h-4 w-4 mr-1" />
                {label}
            </Button>

            <ExplainabilityModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                type={type}
                id={id}
            />
        </>
    );
}
