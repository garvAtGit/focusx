import React from 'react';

interface PlanCardProps {
  plan: {
    discount?: number | null;
    durationHours: number | null;
    price: number;
    validityDays: number;
  };
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PlanCard({ plan, isSelected = false, onClick, className = '' }: PlanCardProps) {
  const discount = plan.discount ?? 0;
  const finalPrice = discount ? plan.price - (plan.price * discount / 100) : plan.price;
  const isDaily = plan.validityDays < 30;
  const months = isDaily ? 0 : Math.max(1, Math.round(plan.validityDays / 30));
  const perMonth = isDaily ? finalPrice.toFixed(0) : (finalPrice / months).toFixed(0);
  const isFullDay = plan.durationHours === null;
  
  return (
    <div 
      onClick={onClick}
      className={`flex flex-row bg-white rounded-2xl border transition-all duration-200 overflow-hidden group relative active:scale-[0.99] active:bg-slate-50/50 ${onClick ? 'cursor-pointer' : ''} ${isSelected ? 'border-primary shadow-md ring-1 ring-primary' : 'border-slate-200 shadow-sm hover:shadow-md hover:border-primary/50 group-aria-[selected=true]:border-primary group-aria-[selected=true]:shadow-md group-aria-[selected=true]:ring-1 group-aria-[selected=true]:ring-primary'} ${className}`}
    >
      
      {/* Subtle thin color line on left */}
      <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${isSelected ? 'bg-primary' : 'bg-slate-300 group-aria-[selected=true]:bg-primary'}`}></div>

      {/* Left Side: Clean Typography */}
      <div className="flex-1 py-5 pr-3 pl-5 flex flex-col justify-center relative min-w-0">
        {/* Subtle hover gradient */}
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-50/[0.2] to-transparent transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-aria-[selected=true]:opacity-100'}`}></div>
        
        <div className="relative z-10">
          {/* Title & Subtitle */}
          <div className="mb-2">
            <h3 className={`text-[22px] md:text-[24px] font-black tracking-tight leading-none transition-colors truncate group-hover:text-primary ${isSelected ? 'text-primary' : 'text-slate-900 group-aria-[selected=true]:text-primary'}`}>
              {isDaily ? `${plan.validityDays} Day${plan.validityDays > 1 ? 's' : ''}` : `${months} Month${months > 1 ? 's' : ''}`}
            </h3>
            <div className="text-[13px] font-bold text-slate-700 mt-2 truncate bg-primary/10 inline-block px-2 py-0.5 rounded text-primary">
              {isFullDay ? 'Full Day Access' : `${plan.durationHours} Hrs Daily`}
            </div>
          </div>
          
          {/* Details list */}
          <ul className="flex flex-col gap-y-1.5 mt-3 pr-2">
            <li className="text-[12px] font-medium text-slate-500 flex items-start gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0 mt-1.5"></div>
              <span className="leading-tight">{plan.validityDays} Days Validity</span>
            </li>
            {discount > 0 && (
              <li className="text-[12px] font-medium text-slate-500 flex items-start gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0 mt-1.5"></div>
                <span className="leading-tight"><span className="text-success font-bold">{discount}% OFF</span> applied</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Divider (Ticket Style) */}
      <div className={`border-l-[1.5px] border-dashed my-3 transition-colors relative ${isSelected ? 'border-primary/30' : 'border-slate-200 group-hover:border-primary/20 group-aria-[selected=true]:border-primary/30'}`}>
        {/* Ticket notches */}
        <div className="absolute -top-3 -left-1.5 w-3 h-3 bg-background border-b-[1.5px] border-r-[1.5px] border-transparent rounded-full z-20"></div>
        <div className="absolute -bottom-3 -left-1.5 w-3 h-3 bg-background border-t-[1.5px] border-r-[1.5px] border-transparent rounded-full z-20"></div>
      </div>

      {/* Right Side: Price Block */}
      <div className={`py-5 pr-5 pl-4 w-[145px] flex flex-col justify-center items-end relative z-10 transition-colors flex-shrink-0 ${isSelected ? 'bg-primary/5' : 'bg-slate-50/50 group-active:bg-slate-100/50 group-aria-[selected=true]:bg-primary/5'}`}>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-0.5 mb-1.5 truncate w-full">
            <span className="text-[16px] font-bold text-slate-900">₹</span>
            <span className="text-[32px] font-black tracking-tighter text-slate-900">{perMonth}</span>
            {!isDaily && <span className="text-[12px] font-bold text-slate-500">/mo</span>}
          </div>
          <div className="text-[12px] font-semibold text-slate-500 leading-tight flex flex-col items-end gap-1 mt-1 truncate w-full">
            {!isDaily && <span className="truncate w-full text-right">Total ₹{finalPrice.toFixed(0)}</span>}
            {discount > 0 && (
              <span className="line-through opacity-60 text-muted-foreground truncate w-full text-right">₹{plan.price.toFixed(0)}</span>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
