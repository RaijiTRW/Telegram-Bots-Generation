"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  children: React.ReactNode
  placeholder?: string
}

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

interface SelectValueProps {
  placeholder?: string
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

interface SelectLabelProps {
  children: React.ReactNode
}

interface SelectGroupProps {
  children: React.ReactNode
}

const SelectContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
})

const Select = ({ value: controlledValue, onValueChange, defaultValue, children, placeholder }: SelectProps) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || '')
  const [open, setOpen] = React.useState(false)
  const currentValue = controlledValue !== undefined ? controlledValue : uncontrolledValue

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(newValue)
    setOpen(false)
  }

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, open, setOpen }}>
      {children}
    </SelectContext.Provider>
  )
}

const SelectTrigger = ({ children, className }: SelectTriggerProps) => {
  const { open, setOpen } = React.useContext(SelectContext)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#24A1DE] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    </div>
  )
}

const SelectValue = ({ placeholder }: SelectValueProps) => {
  const { value } = React.useContext(SelectContext)

  return (
    <span className={cn(!value && "text-zinc-500")}>
      {value || placeholder}
    </span>
  )
}

const SelectContent = ({ children, className }: SelectContentProps) => {
  const { open } = React.useContext(SelectContext)

  if (!open) return null

  return (
    <div className={cn(
      "absolute z-50 max-h-60 min-w-[8rem] overflow-auto rounded-md border border-white/10 bg-zinc-950 text-zinc-100 shadow-md",
      "mt-1",
      className
    )}>
      <div className="p-1">
        {children}
      </div>
    </div>
  )
}

const SelectItem = ({ value, children }: SelectItemProps) => {
  const { value: selectedValue, onValueChange } = React.useContext(SelectContext)
  const isSelected = value === selectedValue

  return (
    <div
      onClick={() => onValueChange(value)}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
        "hover:bg-white/10 hover:text-white",
        isSelected && "bg-white/10 text-white"
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <span className="h-2 w-2 rounded-full bg-[#24A1DE]" />}
      </span>
      {children}
    </div>
  )
}

const SelectLabel = ({ children }: SelectLabelProps) => (
  <div className="px-2 py-1.5 text-sm font-semibold text-zinc-400">
    {children}
  </div>
)

const SelectSeparator = () => (
  <div className="my-1 h-px bg-white/10" />
)

const SelectGroup = ({ children }: SelectGroupProps) => <>{children}</>

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
}
