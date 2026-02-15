'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, Database, Type } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBotState } from '../providers/bot-state-provider'
import type { BotVariable, VariableType } from '@/lib/bot-editor/types/bot.types'

interface VariableTypeOption {
  value: VariableType
  label: string
  color: string
  icon: string
}

const variableTypes: VariableTypeOption[] = [
  { value: 'string', label: 'String', color: 'text-blue-400', icon: 'ABC' },
  { value: 'number', label: 'Number', color: 'text-emerald-400', icon: '123' },
  { value: 'boolean', label: 'Boolean', color: 'text-amber-400', icon: 'TF' },
  { value: 'object', label: 'Object', color: 'text-purple-400', icon: '{} ' },
  { value: 'array', label: 'Array', color: 'text-pink-400', icon: '[] ' },
  { value: 'user', label: 'User', color: 'text-cyan-400', icon: '@ ' },
  { value: 'message', label: 'Message', color: 'text-orange-400', icon: '# ' },
]

interface EditingVariable {
  id: string
  name: string
  type: VariableType
  default_value: any
  description: string
}

export function VariablesTable() {
  const { config, addVariable, removeVariable, setIsDirty, setConfig } = useBotState()
  const variables = config.variables || []

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newVariable, setNewVariable] = useState<Omit<BotVariable, 'id'>>({
    name: '',
    type: 'string',
    default_value: '',
    description: '',
  })
  const [editingVariable, setEditingVariable] = useState<EditingVariable | null>(null)

  const handleAdd = () => {
    if (!newVariable.name.trim()) return

    addVariable({
      name: newVariable.name,
      type: newVariable.type,
      default_value: getDefaultValue(newVariable.type),
      description: newVariable.description,
    })

    setNewVariable({ name: '', type: 'string', default_value: '', description: '' })
    setIsAdding(false)
  }

  const handleEdit = (variable: BotVariable) => {
    setEditingVariable({
      id: variable.id,
      name: variable.name,
      type: variable.type,
      default_value: variable.default_value,
      description: variable.description || '',
    })
    setEditingId(variable.id)
  }

  const handleSaveEdit = () => {
    if (!editingVariable) return

    setConfig({
      ...config,
      variables: variables.map((v) =>
        v.id === editingVariable.id
          ? {
              id: v.id,
              name: editingVariable.name,
              type: editingVariable.type,
              default_value: editingVariable.default_value,
              description: editingVariable.description,
            }
          : v
      ),
    })

    setEditingId(null)
    setEditingVariable(null)
    setIsDirty(true)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingVariable(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this variable?')) {
      removeVariable(id)
    }
  }

  const getDefaultValue = (type: VariableType): any => {
    switch (type) {
      case 'string':
        return ''
      case 'number':
        return 0
      case 'boolean':
        return false
      case 'object':
        return {}
      case 'array':
        return []
      case 'user':
        return null
      case 'message':
        return null
      default:
        return ''
    }
  }

  const renderValueInput = (type: VariableType, value: any, onChange: (val: any) => void) => {
    switch (type) {
      case 'boolean':
        return (
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value === 'true')}
            className="px-2 py-1 rounded bg-zinc-900/50 border border-white/10 text-white text-sm focus:border-[#24A1DE] focus:outline-none"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        )
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="px-2 py-1 rounded bg-zinc-900/50 border border-white/10 text-white text-sm w-24 focus:border-[#24A1DE] focus:outline-none"
          />
        )
      case 'object':
      case 'array':
        return (
          <input
            type="text"
            value={JSON.stringify(value)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value))
              } catch {
                // Invalid JSON, don't update
              }
            }}
            className="px-2 py-1 rounded bg-zinc-900/50 border border-white/10 text-white text-sm w-32 focus:border-[#24A1DE] focus:outline-none font-mono"
          />
        )
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="px-2 py-1 rounded bg-zinc-900/50 border border-white/10 text-white text-sm w-32 focus:border-[#24A1DE] focus:outline-none"
          />
        )
    }
  }

  const getTypeInfo = (type: VariableType) => variableTypes.find(t => t.value === type)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Database className="w-4 h-4 text-[#24A1DE]" />
          </div>
          <h3 className="text-lg font-semibold text-white">Variables</h3>
          <span className="text-zinc-500 text-sm">({variables.length})</span>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
        >
          <Plus className="w-4 h-4" />
          Add Variable
        </Button>
      </div>

      {/* Add Variable Form */}
      {isAdding && (
        <div className="rounded-xl bg-gradient-to-br from-[#24A1DE]/10 to-[#8B5CF6]/10 border border-[#24A1DE]/30 p-4 space-y-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
              <Input
                placeholder="Variable name"
                value={newVariable.name}
                onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 text-sm h-9"
              />
            </div>

            <div className="col-span-2">
              <select
                value={newVariable.type}
                onChange={(e) => setNewVariable({ ...newVariable, type: e.target.value as VariableType })}
                className="w-full px-2 py-1.5 rounded bg-zinc-900/50 border border-white/10 text-white text-sm focus:border-[#24A1DE] focus:outline-none appearance-none cursor-pointer"
              >
                {variableTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-3">
              <Input
                placeholder="Default value"
                value={newVariable.default_value}
                onChange={(e) => setNewVariable({ ...newVariable, default_value: e.target.value })}
                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 text-sm h-9"
              />
            </div>

            <div className="col-span-3">
              <Input
                placeholder="Description (optional)"
                value={newVariable.description}
                onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 text-sm h-9"
              />
            </div>

            <div className="col-span-1 flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleAdd}
                className="h-9 w-9 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => { setIsAdding(false); setNewVariable({ name: '', type: 'string', default_value: '', description: '' }) }}
                className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Variables Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {variables.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-4 rounded-full bg-zinc-900/50 mb-4">
              <Database className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-400 mb-2">No variables yet</p>
            <p className="text-zinc-600 text-sm">Add your first variable to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-zinc-900/50 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Default Value
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {variables.map((variable) => {
                const typeInfo = getTypeInfo(variable.type)
                const isEditing = editingId === variable.id

                return (
                  <tr
                    key={variable.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    {isEditing && editingVariable ? (
                      <>
                        <td className="px-4 py-3">
                          <Input
                            value={editingVariable.name}
                            onChange={(e) => setEditingVariable({ ...editingVariable, name: e.target.value })}
                            className="bg-zinc-900/50 border-white/10 text-white text-sm h-8"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editingVariable.type}
                            onChange={(e) => setEditingVariable({ ...editingVariable, type: e.target.value as VariableType })}
                            className="px-2 py-1 rounded bg-zinc-900/50 border border-white/10 text-white text-sm focus:border-[#24A1DE] focus:outline-none"
                          >
                            {variableTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {renderValueInput(editingVariable.type, editingVariable.default_value, (val) =>
                            setEditingVariable({ ...editingVariable, default_value: val })
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={editingVariable.description}
                            onChange={(e) => setEditingVariable({ ...editingVariable, description: e.target.value })}
                            className="bg-zinc-900/50 border-white/10 text-white text-sm h-8"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <code className="text-sm text-[#24A1DE] font-mono">{variable.name}</code>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/50 border border-white/10 ${typeInfo?.color}`}>
                            <span className="text-xs font-mono">{typeInfo?.icon}</span>
                            <span className="text-xs font-medium">{typeInfo?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm text-zinc-400 font-mono">
                            {typeof variable.default_value === 'object'
                              ? JSON.stringify(variable.default_value)
                              : String(variable.default_value ?? '-')}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-400">{variable.description || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(variable)}
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(variable.id)}
                              className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
