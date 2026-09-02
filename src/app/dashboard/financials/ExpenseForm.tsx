"use client"

import { useState } from "react"
import { addExpense, deleteExpense } from "@/app/actions/expense-actions"
import toast from "react-hot-toast"
import { Trash2 } from "lucide-react"

export function ExpenseForm({ libraryId }: { libraryId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("libraryId", libraryId);

    const res = await addExpense(formData);
    if (res?.success) {
      toast.success("Expense added successfully");
      (e.target as HTMLFormElement).reset();
    } else {
      toast.error(res?.error || "Failed to add expense");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 mt-4 items-end">
      <div className="flex-1">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Expense Name</label>
        <input 
          required 
          name="name" 
          placeholder="e.g. Electricity Bill" 
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="w-32">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount (₹)</label>
        <input 
          required 
          name="amount" 
          type="number" 
          min="1" 
          placeholder="5000" 
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Adding..." : "Add"}
      </button>
    </form>
  )
}

export function DeleteExpenseButton({ expenseId, libraryId }: { expenseId: string, libraryId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setLoading(true);
    const res = await deleteExpense(expenseId, libraryId);
    if (res?.success) {
      toast.success("Expense deleted");
    } else {
      toast.error(res?.error || "Failed to delete");
    }
    setLoading(false);
  }

  return (
    <button 
      onClick={handleDelete} 
      disabled={loading}
      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
