'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from '@/components/motion-wrapper';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  Settings,
  MessageSquare,
  MousePointer,
  ChevronRight,
  Layout,
  Layers,
  Sliders,
  Plus,
  Code2,
  Sparkles,
  Lightbulb,
  Wand2,
  Type,
  Image as ImageIcon,
  Box,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Settings,
  MessageSquare,
  MousePointer,
  Type,
  ImageIcon,
  Box,
};

export function VisualControl() {
  const t = useTranslations('visualControl');
  const features = t.raw('features') as Array<{
    icon: string;
    title: string;
    description: string;
  }>;

  const [activeTab, setActiveTab] = useState(t('tabs_design'));
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  // Panel structure for Framer-like editor
  const panelStructure = [
    { icon: Layout, label: t('tabs_design'), id: 'design' },
    { icon: Layers, label: t('tabs_layers'), id: 'layers' },
    { icon: MessageSquare, label: t('tabs_content'), id: 'content' },
    { icon: Settings, label: t('tabs_settings'), id: 'settings' },
  ];

  // Canvas elements
  const canvasElements = [
    { id: 'header', type: 'header', label: t('canvasElements_welcome') },
    { id: 'button1', type: 'button', label: t('canvasElements_catalog') },
    { id: 'button2', type: 'button', label: t('canvasElements_support') },
  ];

  // AI suggestions
  const aiSuggestions = [
    { id: 1, text: t('suggestions_payment'), icon: '💳' },
    { id: 2, text: t('suggestions_carousel'), icon: '🛒' },
    { id: 3, text: t('suggestions_auth'), icon: '🔐' },
  ];

  return (
    <section className="py-24 md:py-32 px-4 relative overflow-hidden cyber-grid cyber-noise">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, rgba(124, 77, 255, 0.08) 0%, transparent 70%)' }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Description */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-sm text-white/60 mb-6 font-mono"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Wand2 className="w-4 h-4 text-[#7C4DFF]" />
              <span>{t('badge')}</span>
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t('title')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                {t('titleHighlight1')}
              </span>
              {t('titleAnd')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C4DFF] to-[#1E88E5]">
                {t('titleHighlight2')}
              </span>
            </h2>

            <p className="text-lg text-white/60 mb-12 leading-relaxed">
              {t('subtitle')}
            </p>

            <div className="space-y-6">
              {features.map((feature, index) => {
                const Icon = iconMap[feature.icon];

                return (
                  <motion.div
                    key={feature.icon}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-start gap-4 group"
                  >
                    <motion.div
                      className="w-12 h-12 rounded-xl glass-panel flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E88E5]/20 transition-colors"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.2 }}
                    >
                      {Icon && <Icon className="w-6 h-6 text-[#1E88E5]" />}
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                      <p className="text-white/60">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Right Column - Framer-style Editor */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden">
              <BorderBeam duration={15} size={400} roundedClassName="rounded-2xl" />
            </div>

            {/* Editor Container */}
            <motion.div
              className="glass-cyber-strong rounded-2xl overflow-hidden shadow-2xl"
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              {/* Editor Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <motion.div
                      className="w-3 h-3 rounded-full bg-red-500/50"
                      whileHover={{ scale: 1.2 }}
                    />
                    <motion.div
                      className="w-3 h-3 rounded-full bg-yellow-500/50"
                      whileHover={{ scale: 1.2 }}
                    />
                    <motion.div
                      className="w-3 h-3 rounded-full bg-green-500/50"
                      whileHover={{ scale: 1.2 }}
                    />
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <span className="text-xs text-white/60 font-mono">{t('editor_title')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Sparkles className="w-4 h-4 text-[#7C4DFF]" />
                  </motion.button>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex h-96">
                {/* Left Sidebar */}
                <div className="w-56 border-r border-white/5 p-3 space-y-1 bg-black/10">
                  <div className="text-xs text-white/40 font-mono mb-2 px-3">{t('editor_tools')}</div>
                  {panelStructure.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.label;
                    return (
                      <motion.button
                        key={item.label}
                        onClick={() => setActiveTab(item.label)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative overflow-hidden ${
                          isActive
                            ? 'bg-[#1E88E5]/20 text-[#1E88E5]'
                            : 'text-white/60 hover:bg-white/5'
                        }`}
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {isActive && (
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#1E88E5]"
                            layoutId="activeTab"
                          />
                        )}
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </motion.button>
                    );
                  })}

                  <div className="h-px bg-white/5 my-3" />

                  <div className="text-xs text-white/40 font-mono mb-2 px-3">{t('editor_elements')}</div>
                  <motion.button
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 transition-colors"
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Type className="w-4 h-4" />
                    <span>{t('editor_elementLabels_text')}</span>
                  </motion.button>
                  <motion.button
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 transition-colors"
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('editor_elementLabels_button')}</span>
                  </motion.button>
                  <motion.button
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 transition-colors"
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>{t('editor_elementLabels_image')}</span>
                  </motion.button>
                </div>

                {/* Main Canvas */}
                <div className="flex-1 p-6 relative">
                  {/* Canvas Grid */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage:
                          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                      }}
                    />
                  </div>

                  {/* Canvas Elements */}
                  <div className="space-y-3 relative z-10">
                    {canvasElements.map((element, i) => (
                      <motion.div
                        key={element.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => {
                          setSelectedElement(element.id);
                          setShowAISuggestion(true);
                        }}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedElement === element.id
                            ? 'border-[#1E88E5] bg-[#1E88E5]/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded flex items-center justify-center ${
                                element.type === 'header'
                                  ? 'bg-[#7C4DFF]/20'
                                  : 'bg-[#1E88E5]/20'
                              }`}
                            >
                              {element.type === 'header' ? (
                                <Type className="w-4 h-4 text-[#7C4DFF]" />
                              ) : (
                                <MessageSquare className="w-4 h-4 text-[#1E88E5]" />
                              )}
                            </div>
                            <span className="text-sm font-medium">{element.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/40" />
                        </div>

                        {/* AI Suggestion Popup */}
                        <AnimatePresence>
                          {selectedElement === element.id && showAISuggestion && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2 }}
                              className="absolute -top-2 -right-2 z-20"
                            >
                              <motion.button
                                className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#7C4DFF] to-[#1E88E5] text-white text-xs font-medium shadow-lg"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                animate={{
                                  boxShadow: [
                                    '0 0 20px rgba(124, 77, 255, 0.3)',
                                    '0 0 30px rgba(124, 77, 255, 0.5)',
                                    '0 0 20px rgba(124, 77, 255, 0.3)',
                                  ],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <Lightbulb className="w-3.5 h-3.5" />
                                <span>{t('editor_aiSuggestion')}</span>
                                <Sparkles className="w-3 h-3.5" />
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>

                  {/* Floating AI Panel */}
                  <AnimatePresence>
                    {showAISuggestion && (
                      <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="absolute bottom-4 right-4 w-64 glass-panel rounded-xl p-4 border border-[#7C4DFF]/30 shadow-xl z-30"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ rotate: [0, 10, -10, 0] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <Sparkles className="w-4 h-4 text-[#7C4DFF]" />
                            </motion.div>
                            <span className="text-sm font-semibold">{t('editor_aiSuggestions')}</span>
                          </div>
                          <button
                            onClick={() => setShowAISuggestion(false)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            <ChevronRight className="w-4 h-4 text-white/40 rotate-90" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {aiSuggestions.map((suggestion) => (
                            <motion.button
                              key={suggestion.id}
                              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-left text-sm"
                              whileHover={{ x: 3 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <span>{suggestion.icon}</span>
                              <span className="text-white/80">{suggestion.text}</span>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right Properties Panel */}
                <div className="w-48 border-l border-white/5 p-3 bg-black/10">
                  <div className="text-xs text-white/40 font-mono mb-3">{t('editor_properties')}</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-white/60 mb-1 block">{t('editor_properties_text')}</label>
                      <div className="h-8 rounded bg-white/5 border border-white/10 px-2 flex items-center text-xs">
                        {selectedElement || t('editor_properties_selectElement')}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/60 mb-1 block">{t('editor_properties_style')}</label>
                      <div className="flex gap-2">
                        <div className="h-8 flex-1 rounded bg-white/5 border border-white/10" />
                        <div className="h-8 flex-1 rounded bg-white/5 border border-white/10" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Static Decorative Elements */}
            <div className="absolute -top-8 -right-8 w-16 h-16 border border-[#1E88E5]/30 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 border border-[#7C4DFF]/30 rounded-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
