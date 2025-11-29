import { getUserAccounts } from "@/actions/dashboard";
import React from "react";
import AddTransactionForm from "../_components/transaction-form";
import { defaultCategories } from "@/data/categories";
import { getTransaction } from "@/actions/transaction";

const AddTransactionPage = async ({ searchParams }) => {
  const accounts = await getUserAccounts();
  const { edit: editId } = await searchParams;

  let initialData = null;
  if (editId) {
    const transaction = await getTransaction(editId);
    initialData = transaction;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          {editId ? "Edit" : "Add"} Transaction
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {editId ? "Update your transaction details" : "Create a new transaction record"}
        </p>
      </div>

      <AddTransactionForm
        accounts={accounts}
        categories={defaultCategories}
        editMode={!!editId}
        initialData={initialData}
      />
    </div>
  );
};

export default AddTransactionPage;
