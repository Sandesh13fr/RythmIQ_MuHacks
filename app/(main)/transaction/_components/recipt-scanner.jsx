"use client";

import { scanReceipt } from '@/actions/transaction';
import { Button } from '@/components/ui/button';
import useFetch from '@/hooks/use-fetch';
import { Camera, Loader2 } from 'lucide-react';
import React, { useEffect, useRef } from 'react'
import { toast } from 'sonner';

export function ReciptScanner({ onScanComplete }) {
    const fileInputRef = useRef();
    
  const {
    loading: scanReceiptLoading,
    fn: scanReceiptFn,
    data: scannedData,
  } = useFetch(scanReceipt);

  const handleReceiptScan = async (file) => {
    if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should be less than 5MB");
        return;
      }
  
      await scanReceiptFn(file);
  };

  useEffect(() => {
    if (scannedData && !scanReceiptLoading) {
      onScanComplete(scannedData);
      toast.success("Receipt scanned successfully");
    }
  }, [scanReceiptLoading, scannedData]);

  return (
    <div>
        <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleReceiptScan(file);
        }}
        />
        <Button
        type="button"
        variant="outline"
        className="w-full h-24 sm:h-28 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-orange-200 bg-orange-50/50 hover:bg-orange-50 hover:border-orange-300 text-orange-700 hover:text-orange-700 rounded-lg transition-colors"
        onClick={() => fileInputRef.current?.click()}
        disabled={scanReceiptLoading}
      >
        {scanReceiptLoading ? (
          <>
            <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin" />
            <span className="text-sm sm:text-base font-medium">Scanning...</span>
          </>
        ) : (
          <>
            <Camera className="h-6 w-6 sm:h-7 sm:w-7" />
            <div className="text-center">
              <span className="text-sm sm:text-base font-medium block">AI Scanner</span>
              <span className="text-xs text-orange-600">Scan receipt</span>
            </div>
          </>
        )}
      </Button>
    </div>
  )
}

export default ReciptScanner;