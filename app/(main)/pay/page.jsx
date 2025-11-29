"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, Loader2, QrCode, ScanLine, Smartphone, Wallet, Lock, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createTransaction } from "@/actions/transaction";
import { sendMoney } from "@/actions/p2p";
import { toast } from "sonner";
import Link from "next/link";
import { getUserAccounts } from "@/actions/dashboard";
import CommandBar from "@/components/command-bar";

export default function PayPage() {
    const router = useRouter();
    const [step, setStep] = useState("SCAN"); // SCAN, PAYEE, AMOUNT, PIN, PROCESSING, SUCCESS
    const [mode, setMode] = useState("PAY"); // PAY (Expense), RECEIVE (Income)
    const [transferMode, setTransferMode] = useState("MERCHANT"); // MERCHANT or FRIEND
    const [amount, setAmount] = useState("");
    const [payee, setPayee] = useState("");
    const [pin, setPin] = useState("");
    const [accountId, setAccountId] = useState("");
    const [accounts, setAccounts] = useState([]);
    const videoRef = useRef(null);

    // Load accounts on mount
    useEffect(() => {
        async function loadAccounts() {
            const userAccounts = await getUserAccounts();
            setAccounts(userAccounts || []);
            const defaultAcc = userAccounts?.find(a => a.isDefault) || userAccounts?.[0];
            if (defaultAcc) setAccountId(defaultAcc.id);
        }
        loadAccounts();
    }, []);

    // Check for voice command on mount
    useEffect(() => {
        const voiceCommandStr = sessionStorage.getItem("voiceCommand");
        if (voiceCommandStr) {
            try {
                const voiceCommand = JSON.parse(voiceCommandStr);
                // Check if command is recent (within 5 seconds)
                if (Date.now() - voiceCommand.timestamp < 5000) {
                    // Auto-fill form
                    setTransferMode("FRIEND");
                    setPayee(voiceCommand.recipient);
                    setAmount(voiceCommand.amount);
                    setStep("PIN"); // Skip to PIN step
                    toast.success("Voice command loaded!");
                }
                // Clear command
                sessionStorage.removeItem("voiceCommand");
            } catch (e) {
                console.error("Failed to parse voice command", e);
            }
        }
    }, []);

    // Simulate Camera
    useEffect(() => {
        if (step === "SCAN") {
            navigator.mediaDevices
                .getUserMedia({ video: { facingMode: "environment" } })
                .then((stream) => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                })
                .catch((err) => console.error("Camera error:", err));
        }
        return () => {
            // Cleanup stream
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
            }
        };
    }, [step]);

    const handleScan = () => {
        // Simulate finding a QR code
        setTimeout(() => {
            setStep("PAYEE");
        }, 1000); // Faster scan (1s)
    };

    const handlePayeeSubmit = () => {
        if (!payee.trim()) {
            toast.error("Please enter a name or UPI ID");
            return;
        }
        setStep("AMOUNT");
    };

    const handleAmountSubmit = () => {
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        setStep("PIN");
    };

    const handlePinSubmit = async (enteredPin) => {
        if (enteredPin.length === 4) {
            if (enteredPin === "1234") {
                handlePayment(enteredPin); // Pass PIN directly
            } else {
                toast.error("Incorrect PIN");
                setPin("");
            }
        } else {
            setPin(enteredPin);
        }
    };

    const handlePayment = async (validatedPin = "1234") => {
        setStep("PROCESSING");

        try {
            // 1. Simulate Network Delay
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 2. Check if P2P or Merchant Payment
            if (transferMode === "FRIEND") {
                const sendWithOtp = async () => {
                    let otpInput;
                    while (true) {
                        const response = await sendMoney(payee, parseFloat(amount), validatedPin, accountId, otpInput);

                        if (!response) {
                            throw new Error("Transfer failed - no response from server");
                        }

                        if (response.requiresOtp) {
                            if (response.devOtp) {
                                toast.message("Dev OTP", {
                                    description: `Use ${response.devOtp} to verify this transfer (dev only).`,
                                });
                            }

                            const promptMessage = response.message || "Enter the verification code we just sent you";
                            const userOtp = window.prompt(`${promptMessage} (${amount} to ${payee})`);
                            if (!userOtp) {
                                toast.info("Transfer cancelled before verification");
                                return null;
                            }
                            otpInput = userOtp;
                            continue;
                        }

                        return response;
                    }
                };

                const result = await sendWithOtp();

                if (result?.success) {
                    // 3. Play Sound
                    const audio = new Audio("/success.mp3");
                    audio.play().catch(e => console.log("Audio play failed", e));

                    toast.success(result.message);
                    setStep("SUCCESS");

                    // 4. Redirect after delay
                    setTimeout(() => {
                        router.push("/dashboard");
                    }, 3000);
                } else if (result === null) {
                    setStep("AMOUNT");
                    return;
                } else {
                    throw new Error(result?.error || "Transfer failed");
                }
            } else {
                // Merchant Payment (Original Logic)
                const transactionData = {
                    amount: parseFloat(amount),
                    description: mode === "PAY" ? `Paid to ${payee}` : `Received from ${payee}`,
                    date: new Date(),
                    category: "General",
                    type: mode === "PAY" ? "EXPENSE" : "INCOME",
                    accountId: accountId,
                    isRecurring: false,
                };

                const result = await createTransaction(transactionData);

                if (result.success) {
                    // 3. Play Sound
                    const audio = new Audio("/success.mp3");
                    audio.play().catch(e => console.log("Audio play failed", e));

                    setStep("SUCCESS");

                    // 4. Redirect after delay
                    setTimeout(() => {
                        router.push("/dashboard");
                    }, 3000);
                } else {
                    throw new Error(result.error);
                }
            }
        } catch (error) {
            console.error("Payment failed:", error);
            toast.error(error.message || "Payment failed. Please try again.");
            setStep("AMOUNT");
        }
    };

    const getStepNumber = () => {
        const steps = { SCAN: 1, PAYEE: 2, AMOUNT: 3, PIN: 4, PROCESSING: 5, SUCCESS: 6 };
        return steps[step] || 1;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white flex flex-col">
            {/* Command Bar */}
            <CommandBar />

            {/* Header with Step Indicator */}
            <div className="sticky top-0 z-20 bg-black/50 backdrop-blur-md border-b border-white/10">
                <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                            <ArrowLeft className="h-5 sm:h-6 w-5 sm:w-6" />
                        </Button>
                    </Link>
                    <div className="text-center">
                        <h1 className="text-lg sm:text-xl font-bold">RythmIQ Pay</h1>
                        {step !== "SCAN" && step !== "PROCESSING" && step !== "SUCCESS" && (
                            <p className="text-xs text-gray-400 mt-0.5">Step {getStepNumber()} of 4</p>
                        )}
                    </div>
                    <div className="w-10" /> {/* Spacer */}
                </div>
                
                {/* Progress Bar */}
                {step !== "SCAN" && step !== "PROCESSING" && step !== "SUCCESS" && (
                    <div className="px-4 sm:px-6 pb-3 sm:pb-4">
                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                style={{ width: `${(getStepNumber() / 4) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Content based on Step */}
            <div className="flex-1 flex flex-col relative">

                {/* STEP 1: SCANNER */}
                {step === "SCAN" && (
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        {/* Camera View */}
                        <div className="absolute inset-0 bg-gray-900">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover opacity-80"
                            />
                        </div>

                        {/* Overlay */}
                        <div className="z-10 flex flex-col items-center w-full max-w-xs sm:max-w-md px-4 space-y-6 sm:space-y-8">
                            {/* Toggle Mode */}
                            <div className="bg-black/50 backdrop-blur-md p-1 rounded-full flex gap-1">
                                <button
                                    onClick={() => setMode("PAY")}
                                    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-medium transition-all ${mode === "PAY" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-300 hover:text-white"
                                        }`}
                                >
                                    Pay
                                </button>
                                <button
                                    onClick={() => setMode("RECEIVE")}
                                    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-medium transition-all ${mode === "RECEIVE" ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "text-gray-300 hover:text-white"
                                        }`}
                                >
                                    Receive
                                </button>
                            </div>

                            {/* Scanner Frame */}
                            <div className="relative w-64 sm:w-72 md:w-96 h-64 sm:h-72 md:h-96 border-2 border-white/30 rounded-3xl flex items-center justify-center overflow-hidden shadow-xl shadow-cyan-500/10">
                                <div className="absolute inset-0 border-2 border-cyan-400 rounded-3xl animate-pulse" />
                                <ScanLine className="h-full w-full text-cyan-400/20 animate-ping" />
                                <button
                                    onClick={handleScan}
                                    className="absolute inset-0 w-full h-full cursor-pointer z-20"
                                />
                                <p className="absolute bottom-4 text-xs text-cyan-400 font-mono tracking-widest">
                                    SCANNING...
                                </p>
                            </div>

                            {/* Description */}
                            <p className="text-gray-400 text-xs sm:text-sm text-center px-4">
                                Point at any QR code to {mode === "PAY" ? "pay" : "receive"}
                            </p>
                        </div>
                    </div>
                )}

                {/* STEP 2: PAYEE INPUT (NEW) */}
                {step === "PAYEE" && (
                    <div className="flex-1 bg-black flex flex-col p-4 sm:p-6 animate-in slide-in-from-bottom-full duration-300 overflow-y-auto">
                        <div className="mt-6 sm:mt-8 mb-6 sm:mb-8">
                            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
                                {mode === "PAY" ? "Who are you paying?" : "Requesting from?"}
                            </h2>
                            <p className="text-sm sm:text-base text-gray-400">
                                {transferMode === "FRIEND" ? "Enter their email address" : "Enter Name, UPI ID or Number"}
                            </p>
                        </div>

                        {/* Transfer Mode Tabs */}
                        <div className="mb-6 bg-gray-900 p-1 rounded-lg flex gap-1">
                            <button
                                onClick={() => setTransferMode("MERCHANT")}
                                className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${transferMode === "MERCHANT" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-gray-400 hover:text-gray-200"
                                    }`}
                            >
                                <QrCode className="h-4 w-4" />
                                <span>Merchant</span>
                            </button>
                            <button
                                onClick={() => setTransferMode("FRIEND")}
                                className={`flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 ${transferMode === "FRIEND" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-gray-400 hover:text-gray-200"
                                    }`}
                            >
                                <Users className="h-4 w-4" />
                                <span>Friend</span>
                            </button>
                        </div>

                        <div className="flex-1">
                            <div className="relative mb-6">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 h-5 w-5" />
                                <Input
                                    value={payee}
                                    onChange={(e) => setPayee(e.target.value)}
                                    placeholder={
                                        transferMode === "FRIEND"
                                            ? "friend@example.com"
                                            : "e.g. Starbucks, Rahul, 98765..."
                                    }
                                    type={transferMode === "FRIEND" ? "email" : "text"}
                                    className="pl-12 h-12 sm:h-14 bg-gray-900 border-gray-800 text-white text-base sm:text-lg rounded-xl focus:ring-cyan-500"
                                    autoFocus
                                />
                            </div>

                            {/* Quick Suggestions (Optional) */}
                            <div className="mb-6">
                                <p className="text-xs sm:text-sm text-gray-500 mb-3 uppercase tracking-wider font-semibold">Recents</p>
                                <div className="space-y-2">
                                    {["Starbucks", "Uber", "Zomato", "JioMart"].map((name) => (
                                        <button
                                            key={name}
                                            onClick={() => { setPayee(name); setStep("AMOUNT"); }}
                                            className="w-full p-3 sm:p-4 bg-gray-900/50 hover:bg-gray-900 rounded-lg sm:rounded-xl flex items-center gap-3 transition-colors text-left"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center font-bold text-gray-300 text-sm">
                                                {name[0]}
                                            </div>
                                            <span className="text-white text-sm sm:text-base">{name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Button
                            size="lg"
                            className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white mt-4 font-semibold"
                            onClick={handlePayeeSubmit}
                        >
                            Continue
                        </Button>
                    </div>
                )}

                {/* STEP 3: AMOUNT */}
                {step === "AMOUNT" && (
                    <div className="flex-1 bg-black flex flex-col p-4 sm:p-6 animate-in slide-in-from-bottom-full duration-300">
                        {/* Transaction Summary Card */}
                        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
                            <div className="flex items-center gap-4 mb-4 sm:mb-6">
                                <div className="h-12 sm:h-14 w-12 sm:w-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl sm:text-2xl font-bold">
                                    {payee.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs sm:text-sm text-gray-400">{mode === "PAY" ? "Paying to" : "Requesting from"}</p>
                                    <h2 className="text-lg sm:text-xl font-bold text-white">{payee}</h2>
                                    <p className="text-xs text-gray-500 mt-1">{transferMode === "FRIEND" ? "P2P Transfer" : "Merchant Payment"}</p>
                                </div>
                            </div>
                            <div className="border-t border-gray-800 pt-4 sm:pt-6">
                                <div className="flex justify-between items-center mb-3 sm:mb-4">
                                    <span className="text-xs sm:text-sm text-gray-400">Account</span>
                                    <span className="text-sm sm:text-base font-semibold text-white">{accounts.find(a => a.id === accountId)?.name || "Account"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-gray-400">Available Balance</span>
                                    <span className="text-sm sm:text-base font-semibold text-green-400">₹{parseFloat(accounts.find(a => a.id === accountId)?.balance || 0).toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div className="flex-1 flex flex-col justify-center items-center mb-6 sm:mb-8">
                            <p className="text-gray-500 mb-4 text-sm sm:text-base">Enter Amount</p>
                            <div className="relative">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-5xl sm:text-7xl font-bold text-gray-600">₹</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0"
                                    autoFocus
                                    className="bg-transparent text-5xl sm:text-7xl font-bold text-white w-full text-center focus:outline-none pl-8 sm:pl-12"
                                />
                            </div>
                        </div>

                        {/* Account Selector */}
                        {accounts.length > 1 && (
                            <div className="mb-4">
                                <p className="text-xs sm:text-sm text-gray-400 mb-3 uppercase tracking-wider font-semibold">Select Account</p>
                                <div className="space-y-2">
                                    {accounts.map(acc => (
                                        <button
                                            key={acc.id}
                                            onClick={() => setAccountId(acc.id)}
                                            className={`w-full p-3 sm:p-4 rounded-lg transition-all text-left ${accountId === acc.id 
                                                ? "bg-cyan-500/20 border border-cyan-500 " 
                                                : "bg-gray-900 hover:bg-gray-900/70 border border-gray-800"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm sm:text-base font-semibold text-white">{acc.name}</p>
                                                    <p className="text-xs text-gray-400 mt-1">Balance: ₹{parseFloat(acc.balance).toLocaleString('en-IN')}</p>
                                                </div>
                                                {accountId === acc.id && <Check className="h-5 w-5 text-cyan-500" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button
                            size="lg"
                            className={`w-full h-12 sm:h-14 text-base sm:text-lg rounded-full font-semibold ${mode === "PAY"
                                ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                                : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                }`}
                            onClick={handleAmountSubmit}
                        >
                            {mode === "PAY" ? "Proceed to Pay" : "Request Money"}
                        </Button>
                    </div>
                )}

                {/* STEP 4: PIN ENTRY */}
                {step === "PIN" && (
                    <div className="flex-1 bg-black flex flex-col p-4 sm:p-6 items-center animate-in slide-in-from-bottom-full duration-300 justify-center">
                        <Lock className="h-12 sm:h-16 w-12 sm:w-16 text-cyan-500 mb-4 sm:mb-6" />
                        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Enter UPI PIN</h2>
                        <p className="text-gray-400 text-center text-sm sm:text-base mb-8 sm:mb-12">
                            Paying <span className="font-semibold text-white">₹{amount}</span> to <span className="font-semibold text-white">{payee}</span>
                        </p>

                        {/* PIN Dots */}
                        <div className="flex gap-3 sm:gap-4 mb-12 sm:mb-16">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={`h-4 w-4 sm:h-5 sm:w-5 rounded-full border-2 transition-all ${pin.length > i
                                        ? "bg-cyan-500 border-cyan-500 scale-110"
                                        : "border-gray-600 bg-transparent"
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Number Pad */}
                        <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-xs mx-auto">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => handlePinSubmit(pin + num)}
                                    className="text-2xl sm:text-3xl font-medium text-white hover:bg-white/10 active:bg-white/20 rounded-xl w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center transition-colors border border-gray-800"
                                >
                                    {num}
                                </button>
                            ))}
                            <div /> {/* Empty slot */}
                            <button
                                onClick={() => handlePinSubmit(pin + "0")}
                                className="text-2xl sm:text-3xl font-medium text-white hover:bg-white/10 active:bg-white/20 rounded-xl w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center transition-colors border border-gray-800"
                            >
                                0
                            </button>
                            <button
                                onClick={() => setPin(pin.slice(0, -1))}
                                className="text-white hover:bg-white/10 active:bg-white/20 rounded-xl w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center transition-colors border border-gray-800"
                            >
                                <ArrowLeft className="h-6 sm:h-7 w-6 sm:w-7" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 5: PROCESSING */}
                {step === "PROCESSING" && (
                    <div className="flex-1 bg-black flex flex-col items-center justify-center space-y-6 sm:space-y-8">
                        <div className="relative">
                            <div className="h-24 sm:h-32 w-24 sm:w-32 rounded-full border-4 border-gray-800" />
                            <div className="absolute inset-0 h-24 sm:h-32 w-24 sm:w-32 rounded-full border-4 border-transparent border-t-cyan-500 border-r-cyan-500 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Smartphone className="h-10 sm:h-12 w-10 sm:w-12 text-gray-500 animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Processing Payment...</h3>
                            <p className="text-gray-500 text-sm sm:text-base">Please don't close this window</p>
                        </div>
                    </div>
                )}

                {/* STEP 6: SUCCESS */}
                {step === "SUCCESS" && (
                    <div className="flex-1 bg-gradient-to-b from-green-600 to-emerald-700 flex flex-col items-center justify-center p-4 sm:p-6 animate-in zoom-in duration-300">
                        {/* Success Checkmark */}
                        <div className="h-20 sm:h-24 w-20 sm:w-24 bg-white rounded-full flex items-center justify-center shadow-2xl mb-6 sm:mb-8">
                            <Check className="h-12 sm:h-14 w-12 sm:w-14 text-green-600 stroke-[3]" />
                        </div>

                        {/* Amount */}
                        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-2 text-center">₹{parseFloat(amount).toLocaleString('en-IN')}</h2>

                        {/* Status */}
                        <p className="text-lg sm:text-2xl font-semibold text-white/90 mb-6 sm:mb-8 text-center">
                            {mode === "PAY" ? "Paid Successfully" : "Received Successfully"}
                        </p>

                        {/* Transaction Details Card */}
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-6 w-full max-w-xs mb-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-white/10">
                                    <span className="text-sm text-white/70">To/From</span>
                                    <span className="text-sm sm:text-base font-semibold text-white">{payee}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-white/10">
                                    <span className="text-sm text-white/70">Type</span>
                                    <span className="text-sm sm:text-base font-semibold text-white">{transferMode === "FRIEND" ? "P2P Transfer" : "Merchant Payment"}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-white/10">
                                    <span className="text-sm text-white/70">Account</span>
                                    <span className="text-sm sm:text-base font-semibold text-white">{accounts.find(a => a.id === accountId)?.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-white/70">Time</span>
                                    <span className="text-sm sm:text-base font-semibold text-white">{new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Redirect Message */}
                        <p className="text-white/70 text-xs sm:text-sm">Redirecting to Dashboard in 3 seconds...</p>
                    </div>
                )}

            </div>
        </div >
    );
}
