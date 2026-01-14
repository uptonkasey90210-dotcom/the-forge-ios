"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ConnectionGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConnectionGuide({ open, onOpenChange }: ConnectionGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Connect Your Engine</DialogTitle>
          <DialogDescription>
            Follow these steps to connect your local AI models to The Forge.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <Tabs defaultValue="image" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="image">Image (Stable Diffusion)</TabsTrigger>
              <TabsTrigger value="chat">Chat (Llama/Ollama)</TabsTrigger>
            </TabsList>

            {/* --- IMAGE GENERATION TAB --- */}
            <TabsContent value="image" className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">1. Install Stability Matrix</h3>
                <p className="text-sm text-muted-foreground">
                  Download <strong>Stability Matrix</strong> on your PC. It is the easiest way to manage packages like Automatic1111 or ComfyUI.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2. Add Launch Arguments</h3>
                <p className="text-sm text-muted-foreground">
                  Click the <strong>Gear Icon (⚙️)</strong> next to your package, scroll to "Launch Arguments", and paste this exactly:
                </p>
                <div className="bg-muted p-2 rounded-md font-mono text-xs select-all">
                  --listen --cors-allow-origins=*
                </div>
              </div>
            </TabsContent>

            {/* --- CHAT / LLAMA TAB --- */}
            <TabsContent value="chat" className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">1. Install Ollama or LM Studio</h3>
                <p className="text-sm text-muted-foreground">
                  Ensure your backend is running.
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                  <li><strong>Ollama:</strong> Run <code>OLLAMA_HOST=0.0.0.0 ollama serve</code></li>
                  <li><strong>LM Studio:</strong> Start Server and enable "Serve on Local Network".</li>
                </ul>
              </div>
            </TabsContent>

            {/* --- COMMON STEPS (IP ADDRESS) --- */}
            <div className="mt-6 pt-6 border-t space-y-2">
              <h3 className="font-medium text-foreground">Final Step: Find Your IP</h3>
              <p className="text-sm text-muted-foreground">
                On Windows, open Command Prompt and type <code>ipconfig</code>. Look for <strong>IPv4 Address</strong> (e.g., 192.168.1.5).
              </p>
              <p className="text-sm text-muted-foreground">
                Enter that IP in the settings menu.
              </p>
            </div>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}