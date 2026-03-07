"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

type TabsContextValue = {
  value: string
  onValueChange: (value: string) => void
}

const defaultValue: TabsContextValue = {
  value: '',
  onValueChange: () => {},
}

const TabsContext = React.createContext<TabsContextValue>(defaultValue)

const Tabs = ({ defaultValue, value: controlledValue, onValueChange, children, className }: TabsProps) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || '')
  const currentValue = controlledValue !== undefined ? controlledValue : uncontrolledValue

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(newValue)
  }

  const contextValue: TabsContextValue = {
    value: currentValue,
    onValueChange: handleValueChange,
  }

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

const TabsList = ({ children, className }: TabsListProps) => (
  <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-zinc-900/50 p-1 text-zinc-400", className)}>
    {children}
  </div>
)

const TabsTrigger = ({ value, children, className }: TabsTriggerProps) => {
  const { value: selectedValue, onValueChange } = React.useContext(TabsContext)
  const isSelected = value === selectedValue

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]",
        isSelected ? "bg-white/10 text-white shadow-sm" : "hover:text-white",
        className
      )}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ value, children, className }: TabsContentProps) => {
  const { value: selectedValue } = React.useContext(TabsContext)

  if (value !== selectedValue) return null

  return (
    <div className={cn("mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]", className)}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
