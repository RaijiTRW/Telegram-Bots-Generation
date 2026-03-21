'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import ReactFlow, {
  Background as BackgroundComponent,
  BackgroundVariant,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nodeTypes } from '@/components/bot-editor/canvas/node-types';

const noop = () => {};

export function EditorCanvasPreview() {
  const locale = useLocale();
  const isRu = locale === 'ru';

  const nodes = useMemo<Node[]>(
    () => [
      {
        id: 'preview-trigger',
        type: 'trigger',
        position: { x: 320, y: 40 },
        data: {
          trigger: 'command',
          pattern: '/start',
          __label: isRu ? 'Command Trigger' : 'Command Trigger',
          __description: isRu ? 'Запуск по команде' : 'Starts on command',
          onDelete: noop,
        },
      },
      {
        id: 'preview-message-1',
        type: 'message',
        position: { x: 290, y: 180 },
        data: {
          __label: isRu ? 'Приветствие' : 'Welcome Message',
          __description: isRu ? 'Первое сообщение' : 'First reply',
          text: isRu ? 'Добро пожаловать в бот' : 'Welcome to the bot',
          onDelete: noop,
        },
      },
      {
        id: 'preview-condition',
        type: 'condition',
        position: { x: 286, y: 330 },
        data: {
          __label: 'Condition',
          __description: isRu ? 'Проверка условия' : 'Condition check',
          variable: 'user.languageCode',
          operator: 'equals',
          value: isRu ? 'ru' : 'en',
          onDelete: noop,
        },
      },
      {
        id: 'preview-message-2',
        type: 'message',
        position: { x: 95, y: 500 },
        data: {
          __label: isRu ? 'Каталог' : 'Catalog',
          __description: isRu ? 'Основной сценарий' : 'Main flow',
          text: isRu ? 'Показать каталог' : 'Show catalog',
          onDelete: noop,
        },
      },
      {
        id: 'preview-message-3',
        type: 'message',
        position: { x: 470, y: 500 },
        data: {
          __label: isRu ? 'Поддержка' : 'Support',
          __description: isRu ? 'Альтернативная ветка' : 'Fallback branch',
          text: isRu ? 'Связаться с поддержкой' : 'Contact support',
          onDelete: noop,
        },
      },
    ],
    [isRu]
  );

  const edges = useMemo<Edge[]>(
    () => [
      {
        id: 'edge-trigger-message',
        source: 'preview-trigger',
        target: 'preview-message-1',
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#24A1DE', strokeWidth: 2 },
      },
      {
        id: 'edge-message-condition',
        source: 'preview-message-1',
        target: 'preview-condition',
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#24A1DE', strokeWidth: 2 },
      },
      {
        id: 'edge-condition-true',
        source: 'preview-condition',
        target: 'preview-message-2',
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#24A1DE', strokeWidth: 2 },
      },
      {
        id: 'edge-condition-false',
        source: 'preview-condition',
        sourceHandle: 'false',
        target: 'preview-message-3',
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#24A1DE', strokeWidth: 2 },
      },
    ],
    []
  );

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#05070A]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.06),transparent_35%)]" />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        className="pointer-events-none bg-transparent"
        proOptions={{ hideAttribution: true }}
      >
        <BackgroundComponent
          variant={BackgroundVariant.Lines}
          gap={24}
          size={1}
          color="rgba(255, 255, 255, 0.06)"
        />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#05070A] to-transparent" />
    </div>
  );
}
