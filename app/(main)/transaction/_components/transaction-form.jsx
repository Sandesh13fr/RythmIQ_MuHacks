"use client";

import { createTransaction, updateTransaction } from '@/actions/transaction';
import { transactionSchema } from '@/app/lib/schema';
import CreateAccountDrawer from '@/components/create-account-drawer';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import useFetch from '@/hooks/use-fetch';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import ReciptScanner from './recipt-scanner';
import VoiceTransaction from './voice-transaction';

const AddTransactionForm = ({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
          type: initialData.type,
          amount: initialData.amount.toString(),
          description: initialData.description,
          accountId: initialData.accountId,
          category: initialData.category,
          date: new Date(initialData.date),
          isRecurring: initialData.isRecurring,
          ...(initialData.recurringInterval && {
            recurringInterval: initialData.recurringInterval,
          }),
        }
        : {
          type: searchParams.get("type") || "EXPENSE",
          amount: searchParams.get("amount") || "",
          description: searchParams.get("description") || "",
          accountId: accounts.find((ac) => ac.isDefault)?.id,
          date: new Date(),
          isRecurring: false,
        },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    if (editMode) {
      transactionFn(editId, formData);
    } else {
      transactionFn(formData);
    }
  };

  useEffect(() => {
    if (!transactionLoading) {
      if (transactionResult?.success) {
        toast.success(editMode ? "Transaction updated successfully"
          : "Transaction created successfully");
        reset();
        router.push(`/account/${transactionResult.data.accountId}`);
      } else if (transactionResult?.error) {
        toast.error(transactionResult.error || "Something went wrong!");
      }
    }
  }, [transactionResult, transactionLoading, editMode]);


  const filteredCategories = categories.filter(
    (category) => category.type === type
  );

  const handleScanComplete = (scannedData) => {
    if (scannedData) {
      setValue("amount", scannedData.amount.toString());
      setValue("date", new Date(scannedData.date));
      if (scannedData.description) {
        setValue("description", scannedData.description);
      }
      if (scannedData.category) {
        setValue("category", scannedData.category);
      }
      if (scannedData.type) {
        setValue("type", scannedData.type);
      }
      toast.success("Transaction details filled!");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6 sm:space-y-8'>
      {/* AI SCANNERS - Quick Actions */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 sm:p-6 border border-blue-200">
        <p className="text-sm font-semibold text-gray-900 mb-4">Quick Fill Options</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <ReciptScanner onScanComplete={handleScanComplete} />
          <VoiceTransaction onScanComplete={handleScanComplete} />
        </div>
      </div>

      {/* Main Form Sections */}
      <div className="space-y-6">
        {/* Type Selection */}
        <div className='space-y-3'>
          <label className="text-sm font-semibold text-gray-900">Transaction Type</label>
          <Select
            onValueChange={(value) => setValue("type", value)}
            defaultValue={type}
          >
            <SelectTrigger className="h-12 rounded-lg border-gray-300 bg-white">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">
                <span className="flex items-center gap-2">
                  <span className="text-red-500">•</span> Expense
                </span>
              </SelectItem>
              <SelectItem value="INCOME">
                <span className="flex items-center gap-2">
                  <span className="text-green-500">•</span> Income
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <span>⚠</span> {errors.type.message}
            </p>
          )}
        </div>

        {/* Amount and Account */}
        <div className='grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2'>
          <div className='space-y-3'>
            <label className="text-sm font-semibold text-gray-900">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="pl-8 h-12 rounded-lg border-gray-300 bg-white text-lg"
                {...register("amount")}
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠</span> {errors.amount.message}
              </p>
            )}
          </div>

          <div className='space-y-3'>
            <label className="text-sm font-semibold text-gray-900">Account</label>
            <Select
              onValueChange={(value) => setValue("accountId", value)}
              defaultValue={getValues("accountId")}
            >
              <SelectTrigger className="h-12 rounded-lg border-gray-300 bg-white">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} (₹{parseFloat(account.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </SelectItem>
                ))}
                <CreateAccountDrawer>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-2 text-blue-600 hover:bg-blue-50"
                  >
                    + Create New Account
                  </Button>
                </CreateAccountDrawer>
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠</span> {errors.accountId.message}
              </p>
            )}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-900">Category</label>
          <Select
            onValueChange={(value) => setValue("category", value)}
            defaultValue={getValues("category")}
          >
            <SelectTrigger className="h-12 rounded-lg border-gray-300 bg-white">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <span>⚠</span> {errors.category.message}
            </p>
          )}
        </div>

        {/* Date and Description */}
        <div className='grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2'>
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-900">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-12 justify-start rounded-lg border-gray-300 bg-white text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-5 w-5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(date) => setValue("date", date)}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.date && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠</span> {errors.date.message}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-900">Description</label>
            <Input
              placeholder="e.g., Grocery shopping"
              className="h-12 rounded-lg border-gray-300 bg-white"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠</span> {errors.description.message}
              </p>
            )}
          </div>
        </div>

        {/* Recurring Toggle */}
        <div className="flex flex-row items-center justify-between rounded-xl border border-gray-300 p-4 bg-white hover:bg-gray-50 transition-colors">
          <div className="space-y-1">
            <label className="text-base font-semibold text-gray-900 block">Recurring Transaction</label>
            <p className="text-sm text-gray-600">
              Set up a recurring schedule for this transaction
            </p>
          </div>
          <Switch
            checked={isRecurring}
            onCheckedChange={(checked) => setValue("isRecurring", checked)}
          />
        </div>

        {/* Recurring Interval */}
        {isRecurring && (
          <div className="space-y-3 bg-amber-50 p-4 sm:p-6 rounded-xl border border-amber-200">
            <label className="text-sm font-semibold text-gray-900">Recurring Interval</label>
            <Select
              onValueChange={(value) => setValue("recurringInterval", value)}
              defaultValue={getValues("recurringInterval")}
            >
              <SelectTrigger className="h-12 rounded-lg border-amber-300 bg-white">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
            {errors.recurringInterval && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span>⚠</span> {errors.recurringInterval.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-12 rounded-lg font-semibold"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 h-12 rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          disabled={transactionLoading}
        >
          {transactionLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {editMode ? "Updating..." : "Creating..."}
            </>
          ) : editMode ? (
            "Update Transaction"
          ) : (
            "Create Transaction"
          )}
        </Button>
      </div>
    </form>
  );
};

export default AddTransactionForm;