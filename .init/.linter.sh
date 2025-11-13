#!/bin/bash
cd /home/kavia/workspace/code-generation/real-time-ai-chat-platform-224064-224085/frontend_react
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

