## hero.description
This documentation is your operational guide. It explains where to click, how the system works internally, how to verify results, and how to spot errors. Text is the foundation, and short video tutorials will complement it over time.

## hero.notes
- Node names remain in English to perfectly match the editor UI.
- Always test your changes in **Test** mode first, and only then prepare them for **Deploy**.
- Each section explains where data lives: whether it's saved permanently in Supabase or only exists temporarily while the bot is running.

## tocHint
The sidebar on the left is your map for quick navigation. Use the right side for reading and scrolling through the main content.

## learningFlow.description
Every section follows the same clear pattern: **action → system behavior → validation → common mistakes**. It's a step-by-step working manual, not just a feature overview.

## learningFlow.steps
- Complete the **"Quick Start"** first. Don't try to learn every node at once.
- Once you succeed, review **"Editor Areas"** and **"UI Components"** to learn where everything is located.
- Treat **"Nodes and Presets"** as a reference guide. Come back to it when you need a specific node.
- Adding buttons? Make sure to read **"Keyboards and Triggers"** to avoid confusing Reply (standard) and Inline (message-attached) keyboards.
- If something breaks, go straight to **"Test, Logs, Deploy"** and **"Troubleshooting"** for a clear fix guide.

## learningFlow.videoNoteTitle
Video guides (coming soon)

## learningFlow.videoNoteDescription
Short video tutorials will appear here soon. Text will remain the main source for exact steps and validation rules.

## quickStart.description
The fastest way to your first working bot: create a bot, connect a **Trigger** to a **Message**, save it, run **Test**, and check the logs.

## serviceFlow.description
Here is how data moves through our service. This simple flow explains why some data is permanently visible in Supabase, while other data only exists for a brief moment while the bot is running.

## editorAreas.description
The interface is divided into functional zones: **Canvas** (workflow design), **AI**, **System**, and **Settings** (Telegram config). This keeps everything organized and prevents clutter.

## uiComponents.description
This section covers the main editor elements (excluding nodes): where to find them, why you need them, and how to use them effectively.

## nodes.description
A complete reference for all Canvas nodes and presets. It explains what each node does, how to set it up, and its limitations.

## keyboardsAndTriggers.description
The most common mistake when building Telegram bots is confusing standard Reply Keyboards (at the bottom) with Inline Keyboards (attached to messages). This section clears that up once and for all.

## keyboardsAndTriggers.note
**Core rule:**
- **Reply Keyboards** (replacing the user's mobile keyboard) just send plain text. To catch them, use a **Text Trigger**.
- **Callback Triggers** are ONLY for **Inline buttons** (the ones attached directly under a message bot sends).

## dataAndSecurity.description
Where and how your data is stored: what is permanent, what gets deleted after execution, how to find things in Supabase, and important security limits.

## testAndDeploy.description
The golden rule of building bots: **Save** → **Test** → **Logs** → Fix errors → **Save** → **Test**. This loop prevents random failures and saves you hours of debugging.

## troubleshooting.description
What to do when your bot stops working? First, check your button/trigger types. Next, check if changes were saved and read the runtime logs. Only as a last resort should you suspect Telegram or external API issues.

## videoPlan.description
Video tutorials will be released in the exact same order as this documentation. Text and video will follow the same scenario to make learning effortless.
