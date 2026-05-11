"use client"

import * as React from "react"
import { createPortal } from "react-dom"
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
  triggerRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  labels: Record<string, React.ReactNode>
  registerItem: (value: string, label: React.ReactNode) => void
}>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
  contentRef: { current: null },
  labels: {},
  registerItem: () => {},
})

function extractSelectLabels(children: React.ReactNode): Record<string, React.ReactNode> {
  const nextLabels: Record<string, React.ReactNode> = {}

  const visit = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return

      const props = child.props as {
        value?: unknown
        children?: React.ReactNode
      }

      if (typeof props.value === 'string' && props.children !== undefined) {
        nextLabels[props.value] = props.children
      }

      if (props.children) {
        visit(props.children)
      }
    })
  }

  visit(children)
  return nextLabels
}

const Select = ({ value: controlledValue, onValueChange, defaultValue, children }: SelectProps) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || '')
  const [open, setOpen] = React.useState(false)
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({})
  const triggerRef = React.useRef<HTMLDivElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const currentValue = controlledValue !== undefined ? controlledValue : uncontrolledValue
  const staticLabels = React.useMemo(() => extractSelectLabels(children), [children])
  const resolvedLabels = React.useMemo(
    () => ({ ...staticLabels, ...labels }),
    [labels, staticLabels]
  )

  const registerItem = React.useCallback((itemValue: string, label: React.ReactNode) => {
    setLabels((current) => {
      if (current[itemValue] === label) return current
      return {
        ...current,
        [itemValue]: label,
      }
    })
  }, [])

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(newValue)
    setOpen(false)
  }

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (triggerRef.current?.contains(target)) return
      if (contentRef.current?.contains(target)) return

      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <SelectContext.Provider value={{
      value: currentValue,
      onValueChange: handleValueChange,
      open,
      setOpen,
      triggerRef,
      contentRef,
      labels: resolvedLabels,
      registerItem,
    }}>
      <div className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = ({ children, className }: SelectTriggerProps) => {
  const { open, setOpen, triggerRef } = React.useContext(SelectContext)

  return (
    <div ref={triggerRef} className="relative">
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
  const { value, labels } = React.useContext(SelectContext)
  const selectedLabel = value ? labels[value] : null

  return (
    <span className={cn(!value && "text-zinc-500")}>
      {selectedLabel || value || placeholder}
    </span>
  )
}

const SelectContent = ({ children, className }: SelectContentProps) => {
  const { open, triggerRef, contentRef } = React.useContext(SelectContext)
  const [mounted, setMounted] = React.useState(false)
  const [contentStyle, setContentStyle] = React.useState<React.CSSProperties>({
    left: 0,
    top: 0,
    width: 0,
    visibility: 'hidden',
  })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open || !mounted) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      const content = contentRef.current
      if (!trigger || !content) return

      const triggerRect = trigger.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const margin = 8
      const menuHeight = content.offsetHeight || 0
      const spaceBelow = viewportHeight - triggerRect.bottom - margin
      const shouldOpenAbove =
        menuHeight > 0
        && spaceBelow < Math.min(menuHeight, 240)
        && triggerRect.top > spaceBelow

      const top = shouldOpenAbove
        ? Math.max(margin, triggerRect.top - menuHeight - 4)
        : Math.min(viewportHeight - margin, triggerRect.bottom + 4)

      setContentStyle({
        left: triggerRect.left,
        top,
        width: triggerRect.width,
        visibility: 'visible',
      })
    }

    updatePosition()

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [contentRef, mounted, open, triggerRef])

  if (!open || !mounted) return null

  return createPortal(
    <div
      ref={contentRef}
      style={contentStyle}
      className={cn(
        "fixed z-[10050] max-h-60 min-w-[8rem] overflow-auto rounded-md border border-white/10 bg-zinc-950 text-zinc-100 shadow-md",
        className
      )}
    >
      <div className="p-1">
        {children}
      </div>
    </div>,
    document.body
  )
}

const SelectItem = ({ value, children }: SelectItemProps) => {
  const {
    value: selectedValue,
    onValueChange,
    registerItem,
  } = React.useContext(SelectContext)
  const isSelected = value === selectedValue

  React.useEffect(() => {
    registerItem(value, children)
  }, [children, registerItem, value])

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
