'use client'

import { useState } from "react"
import { Plus, Edit2, Trash2, Tag, CalendarClock, CheckSquare, Square, Clock, Filter } from "lucide-react"
import { deletePlan, editPlan, batchAddPlans } from "@/app/actions/plan-actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type PlanType = "FIXED" | "FLEXIBLE"

type Plan = {
  id: string;
  name: string;
  type: PlanType;
  durationHours: number | null;
  validityDays: number;
  price: number;
  discount: number | null;
}

type Row = {
  id: string;
  months: number;
  days: number;
  hours: number | null; // null = Full Day
  included: boolean;
  basePriceOverride: string;
  discountPercent: string;
}

type RowConfiguration = {
  planType: PlanType;
  hour6: boolean;
  hour8: boolean;
  hour12: boolean;
  customHourEnabled: boolean;
  customHourValue: string;
}

type EditableRowFields = Pick<Row, "included" | "basePriceOverride" | "discountPercent">

const DURATIONS = [
  { months: 0, days: 1 },
  { months: 1, days: 30 },
  { months: 3, days: 90 },
  { months: 6, days: 180 },
  { months: 12, days: 365 }
]

const DEFAULT_ROW_CONFIGURATION: RowConfiguration = {
  planType: "FIXED",
  hour6: false,
  hour8: false,
  hour12: false,
  customHourEnabled: false,
  customHourValue: ""
}

function buildRows(configuration: RowConfiguration, existingRows: Row[]): Row[] {
  const activeHours: Array<number | null> = []

  if (configuration.planType === "FIXED") {
    activeHours.push(null)
  } else {
    if (configuration.hour6) activeHours.push(6)
    if (configuration.hour8) activeHours.push(8)
    if (configuration.hour12) activeHours.push(12)
    if (configuration.customHourEnabled && configuration.customHourValue) {
      const value = parseInt(configuration.customHourValue)
      if (!isNaN(value) && value > 0 && value <= 24) {
        activeHours.push(value)
      }
    }
    if (activeHours.length === 0) activeHours.push(null)
  }

  return activeHours.flatMap(hours =>
    DURATIONS.map(duration => {
      const id = `${duration.months}m_${hours}`
      const existing = existingRows.find(row => row.id === id)

      return {
        id,
        months: duration.months,
        days: duration.days,
        hours,
        included: existing?.included ?? true,
        basePriceOverride: existing?.basePriceOverride ?? "",
        discountPercent: existing?.discountPercent ?? ""
      }
    })
  )
}

function isPlanType(value: unknown): value is PlanType {
  return value === "FIXED" || value === "FLEXIBLE"
}

export function PlansClient({ initialPlans }: { initialPlans: Plan[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  
  // Bulk Add State
  const [basePlanName, setBasePlanName] = useState("")
  const [monthlyPrice, setMonthlyPrice] = useState("")
  const [planType, setPlanType] = useState<PlanType>("FIXED")
  
  const [hour6, setHour6] = useState(false)
  const [hour8, setHour8] = useState(false)
  const [hour12, setHour12] = useState(false)
  
  const [customHourEnabled, setCustomHourEnabled] = useState(false)
  const [customHourValue, setCustomHourValue] = useState("")

  const [rows, setRows] = useState<Row[]>(() => buildRows(DEFAULT_ROW_CONFIGURATION, []))

  const rebuildRows = (overrides: Partial<RowConfiguration>) => {
    const configuration: RowConfiguration = {
      planType,
      hour6,
      hour8,
      hour12,
      customHourEnabled,
      customHourValue,
      ...overrides
    }
    setRows(currentRows => buildRows(configuration, currentRows))
  }

  const handleRowChange = <Field extends keyof EditableRowFields>(
    index: number,
    field: Field,
    value: EditableRowFields[Field]
  ) => {
    setRows(currentRows =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    )
  }

  // Edit State
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState<PlanType>("FIXED")
  const [editPrice, setEditPrice] = useState("")
  const [editDiscount, setEditDiscount] = useState("")
  const [editValidity, setEditValidity] = useState("")
  const [editHours, setEditHours] = useState("FULL")

  // Filter State
  const [filterType, setFilterType] = useState<string>("ALL")
  const [filterValidity, setFilterValidity] = useState<string>("ALL")
  const [filterDuration, setFilterDuration] = useState<string>("ALL")

  const uniqueTypes = Array.from(new Set(initialPlans.map(p => p.type)));
  const uniqueValidities = Array.from(new Set(initialPlans.map(p => p.validityDays))).sort((a,b) => a - b);
  const uniqueDurations = Array.from(new Set(initialPlans.map(p => p.durationHours))).sort((a, b) => (a || 24) - (b || 24));

  const filteredPlans = initialPlans.filter(plan => {
    if (filterType !== "ALL" && plan.type !== filterType) return false;
    if (filterValidity !== "ALL" && plan.validityDays.toString() !== filterValidity) return false;
    const planDurationStr = plan.durationHours === null ? "FULL" : plan.durationHours.toString();
    if (filterDuration !== "ALL" && planDurationStr !== filterDuration) return false;
    return true;
  });

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this plan?")) {
      await deletePlan(id)
    }
  }

  async function handleBatchSubmit() {
    if (!basePlanName.trim()) {
      alert("Please enter a valid base plan name.");
      return;
    }

    const base = parseFloat(monthlyPrice);

    const plansToCreate = rows.filter(r => r.included).map(r => {
      const autoCalculated = (!isNaN(base) && base > 0) ? base * r.months : 0;
      const customBase = parseFloat(r.basePriceOverride);
      const calculatedTotal = (!isNaN(customBase) && customBase > 0) ? customBase : autoCalculated;
      
      const pct = parseFloat(r.discountPercent);
      const discountPercent = (!isNaN(pct) && pct > 0 && pct <= 100) ? pct : 0;
      
      const hourLabel = r.hours ? ` - ${r.hours}hr` : " - Full Day";

      return {
        name: `${basePlanName} - ${r.months > 0 ? r.months + ' Month' + (r.months > 1 ? 's' : '') : r.days + ' Day'}${hourLabel}`,
        type: planType,
        validityDays: r.days,
        durationHours: r.hours,
        price: calculatedTotal,
        discount: discountPercent || null,
      };
    }).filter(p => p.price > 0);

    if (plansToCreate.length === 0) {
      alert("Please include at least one plan with a valid base price > 0.");
      return;
    }

    await batchAddPlans(JSON.stringify(plansToCreate));
    setIsOpen(false);
  }

  async function handleEditSubmit(formData: FormData) {
    if (!editingPlan) return

    formData.append("id", editingPlan.id);
    if (editHours === "FULL") {
      formData.delete("durationHours"); // Set to null effectively
    }
    await editPlan(formData);
    setIsOpen(false);
  }

  const openAdd = () => {
    setEditingPlan(null);
    setBasePlanName("");
    setMonthlyPrice("");
    setPlanType("FIXED");
    setHour6(false);
    setHour8(false);
    setHour12(false);
    setCustomHourEnabled(false);
    setCustomHourValue("");
    setRows(currentRows => buildRows(DEFAULT_ROW_CONFIGURATION, currentRows));
    setIsOpen(true);
  }

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setEditName(plan.name);
    setEditType(plan.type);
    setEditPrice(plan.price.toString());
    setEditDiscount(plan.discount?.toString() || "");
    setEditValidity(plan.validityDays.toString());
    setEditHours(plan.durationHours ? plan.durationHours.toString() : "FULL");
    setIsOpen(true);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Manage Plans</h1>
          <p className="text-muted-foreground mt-1">Configure bulk pricing and access rules.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger onClick={openAdd} className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add Plans (Bulk)
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Specific Plan' : 'Bulk Create Plans'}</DialogTitle>
            </DialogHeader>
            
            {editingPlan ? (
              // EDIT SINGLE PLAN MODE
              <form action={handleEditSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name</Label>
                  <Input id="name" name="name" value={editName} onChange={e => setEditName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Seat Type</Label>
                    <Select
                      name="type"
                      value={editType}
                      onValueChange={value => {
                        if (isPlanType(value)) setEditType(value)
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">Fixed Seat</SelectItem>
                        <SelectItem value="FLEXIBLE">Flexible Seat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Daily Duration</Label>
                    <Select
                      name="durationHours"
                      value={editHours}
                      onValueChange={value => setEditHours(typeof value === "string" ? value : "FULL")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL">Full Day</SelectItem>
                        {editType === "FLEXIBLE" && (
                          <>
                            <SelectItem value="6">6 Hours</SelectItem>
                            <SelectItem value="8">8 Hours</SelectItem>
                            <SelectItem value="12">12 Hours</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Base Price (₹)</Label>
                    <Input id="price" name="price" value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discount">Discount %</Label>
                    <Input id="discount" name="discount" value={editDiscount} onChange={e => setEditDiscount(e.target.value)} type="number" step="0.1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validityDays">Validity (Days)</Label>
                    <Input id="validityDays" name="validityDays" value={editValidity} onChange={e => setEditValidity(e.target.value)} type="number" required />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full">Save Changes</Button>
                </DialogFooter>
              </form>
            ) : (
              // BULK CREATE MODE
              <div className="space-y-6 pt-4">
                <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Seat Type</Label>
                      <Select
                        value={planType}
                        onValueChange={value => {
                          if (!isPlanType(value)) return
                          setPlanType(value)
                          rebuildRows({ planType: value })
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIXED">Fixed Seat</SelectItem>
                          <SelectItem value="FLEXIBLE">Flexible Seat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {planType === "FLEXIBLE" && (
                      <div className="space-y-2">
                        <Label>Allowed Hours</Label>
                        <div className="flex flex-wrap gap-4 items-center">
                          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={hour6} onChange={e => {
                            setHour6(e.target.checked)
                            rebuildRows({ hour6: e.target.checked })
                          }} className="rounded" /> 6hr</label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={hour8} onChange={e => {
                            setHour8(e.target.checked)
                            rebuildRows({ hour8: e.target.checked })
                          }} className="rounded" /> 8hr</label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={hour12} onChange={e => {
                            setHour12(e.target.checked)
                            rebuildRows({ hour12: e.target.checked })
                          }} className="rounded" /> 12hr</label>
                          
                          <div className="flex items-center gap-2 ml-2 border-l border-border pl-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="checkbox" checked={customHourEnabled} onChange={e => {
                                setCustomHourEnabled(e.target.checked)
                                rebuildRows({ customHourEnabled: e.target.checked })
                              }} className="rounded" /> Custom
                            </label>
                            {customHourEnabled && (
                              <Input 
                                type="number" 
                                min="1" 
                                max="24" 
                                value={customHourValue} 
                                onChange={e => {
                                  setCustomHourValue(e.target.value)
                                  rebuildRows({ customHourValue: e.target.value })
                                }}
                                placeholder="Max 24" 
                                className="w-20 h-8 text-sm"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base Plan Name</Label>
                      <Input value={basePlanName} onChange={e => setBasePlanName(e.target.value)} placeholder="e.g. Standard" />
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Price Template</Label>
                      <Input value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} type="number" placeholder="e.g. 1500" />
                      <p className="text-[10px] text-muted-foreground">Used to auto-generate prices below.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Auto-Generated Permutations</Label>
                  <div className="space-y-3">
                    {rows.map((row, index) => {
                      const base = parseFloat(monthlyPrice);
                      const autoCalculated = (!isNaN(base) && base > 0) ? base * row.months : 0;
                      
                      const customBase = parseFloat(row.basePriceOverride);
                      const calculatedTotal = (!isNaN(customBase) && customBase > 0) ? customBase : autoCalculated;

                      const dPct = parseFloat(row.discountPercent);
                      const discountPercent = (!isNaN(dPct) && dPct >= 0 && dPct <= 100) ? dPct : 0;
                      
                      const finalPrice = calculatedTotal - (calculatedTotal * discountPercent / 100);

                      return (
                        <div key={row.id} className={`grid grid-cols-12 gap-3 items-center p-3 rounded-lg border ${row.included ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/50 opacity-60'}`}>
                          <div className="col-span-1 flex justify-center">
                            <button onClick={() => handleRowChange(index, "included", !row.included)} className="text-primary hover:text-primary/80">
                              {row.included ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                            </button>
                          </div>
                          
                          <div className="col-span-2 space-y-1">
                            <div className="font-bold text-sm">
                              {row.months > 0 ? `${row.months} Month${row.months > 1 ? 's' : ''}` : `${row.days} Day`}
                            </div>
                            <div className="text-xs text-muted-foreground bg-background border border-border px-1.5 py-0.5 w-max rounded">
                              {row.hours ? `${row.hours}hr` : "Full Day"}
                            </div>
                          </div>
                          
                          <div className="col-span-3 space-y-1">
                            <div className="text-xs text-muted-foreground flex justify-between">
                              <span>Base Price</span>
                            </div>
                            <Input 
                              value={row.basePriceOverride} 
                              onChange={e => handleRowChange(index, "basePriceOverride", e.target.value)} 
                              placeholder={autoCalculated > 0 ? autoCalculated.toString() : "0"}
                              className="h-8 text-sm bg-background"
                              disabled={!row.included}
                              type="number"
                            />
                          </div>

                          <div className="col-span-4 space-y-1">
                            <div className="text-xs text-muted-foreground">Discount %</div>
                            <Input 
                              value={row.discountPercent} 
                              onChange={e => handleRowChange(index, "discountPercent", e.target.value)} 
                              placeholder="0"
                              className="h-8 text-sm bg-background"
                              disabled={!row.included || calculatedTotal === 0}
                              type="number"
                              step="0.1"
                            />
                          </div>
                          
                          <div className="col-span-2 space-y-1 text-right">
                            <div className="text-xs text-muted-foreground">Final Price</div>
                            <div className="font-bold text-success">₹{finalPrice > 0 ? finalPrice.toFixed(0) : 0}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t border-border mt-4">
                  <Button onClick={handleBatchSubmit} className="w-full">Create All Included Plans</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8 bg-card p-2 rounded-xl border border-border shadow-sm w-fit">
        <div className="flex items-center gap-2 px-2 text-muted-foreground border-r border-border/50 pr-4">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filter</span>
        </div>

        {uniqueTypes.length > 1 && (
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
            <button 
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'ALL' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All Types
            </button>
            {uniqueTypes.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'FIXED' ? 'Fixed' : 'Flexible'}
              </button>
            ))}
          </div>
        )}
        
        {uniqueValidities.length > 1 && (
          <Select value={filterValidity} onValueChange={(val) => setFilterValidity(val || "ALL")}>
            <SelectTrigger className="h-8 border-border/50 bg-muted/20 hover:bg-muted/50 transition-colors text-xs font-medium w-fit min-w-[140px] rounded-lg">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="Validity" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Validities</SelectItem>
              {uniqueValidities.map(v => (
                <SelectItem key={v} value={v.toString()} className="text-xs">{v} Day{v > 1 ? 's' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {uniqueDurations.length > 1 && (
          <Select value={filterDuration} onValueChange={(val) => setFilterDuration(val || "ALL")}>
            <SelectTrigger className="h-8 border-border/50 bg-muted/20 hover:bg-muted/50 transition-colors text-xs font-medium w-fit min-w-[140px] rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="Access Hours" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Access Hours</SelectItem>
              {uniqueDurations.map(d => {
                const val = d === null ? "FULL" : d.toString();
                const label = d === null ? "Full Day" : `${d} Hours`;
                return <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlans.length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground bg-card border border-border rounded-xl">
            {initialPlans.length === 0 ? "No plans found in the database." : "No plans match the selected filters."}
          </div>
        )}
        
        {filteredPlans.map(plan => (
          <div key={plan.id} className="bg-card rounded-2xl border border-border shadow-sm flex flex-col relative overflow-hidden group">
            <div className={`absolute top-0 w-full h-1 ${plan.type === 'FIXED' ? 'bg-primary' : 'bg-warning'}`} />
            
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded mb-2 inline-block ${plan.type === 'FIXED' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                    {plan.type}
                  </span>
                  <h3 className="text-xl font-bold text-foreground line-clamp-2">{plan.name}</h3>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-foreground">
                      ₹{plan.validityDays < 30 ? Math.round(plan.price * (1 - (plan.discount || 0) / 100)) : Math.round((plan.price * (1 - (plan.discount || 0) / 100)) / Math.max(1, Math.round(plan.validityDays / 30)))}
                    </span>
                    {plan.validityDays >= 30 && <span className="text-sm font-bold text-muted-foreground">/mo</span>}
                  </div>
                  {plan.validityDays >= 30 && (
                    <div className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <span>Total ₹{Math.round(plan.price * (1 - (plan.discount || 0) / 100))}</span>
                      {(plan.discount || 0) > 0 && (
                        <span className="line-through opacity-60">₹{plan.price}</span>
                      )}
                    </div>
                  )}
                  {plan.validityDays < 30 && (plan.discount || 0) > 0 && (
                    <div className="text-xs font-semibold text-muted-foreground line-through opacity-60">
                      ₹{plan.price}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 mb-6 mt-auto">
                <div className="flex items-center text-sm text-foreground">
                  <CalendarClock className="w-4 h-4 text-muted-foreground mr-2" />
                  <span className="font-medium text-muted-foreground mr-1">Validity:</span> {plan.validityDays} Day(s)
                </div>
                <div className="flex items-center text-sm text-foreground">
                  <Clock className="w-4 h-4 text-muted-foreground mr-2" />
                  <span className="font-medium text-muted-foreground mr-1">Access:</span> {plan.durationHours ? `${plan.durationHours} Hours / Day` : 'Full Day'}
                </div>
                <div className="flex items-center text-sm text-foreground">
                  <Tag className="w-4 h-4 text-muted-foreground mr-2" />
                  <span className="font-medium text-muted-foreground mr-1">Discounts:</span> {plan.discount ? `${plan.discount}%` : 'None'}
                </div>
              </div>
            </div>
            
            <div className="border-t border-border grid grid-cols-2 divide-x divide-border">
              <button onClick={() => openEdit(plan)} className="flex items-center justify-center gap-2 p-3 text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => handleDelete(plan.id)} className="flex items-center justify-center gap-2 p-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
