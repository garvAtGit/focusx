'use client'

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyableField({ label, value, isTextarea = false, hint }: { label: string, value: string, isTextarea?: boolean, hint?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-auto space-y-3">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex gap-2 items-start">
        {isTextarea ? (
          <textarea 
            readOnly
            rows={4}
            value={value}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none"
          />
        ) : (
          <input 
            readOnly
            value={value}
            className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none"
          />
        )}
        <button 
          onClick={handleCopy}
          className="p-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors flex-shrink-0"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        </button>
      </div>
      {hint && <p className="text-xs text-muted-foreground italic">{hint}</p>}
    </div>
  );
}
