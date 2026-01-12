"use client"
import { useState, useRef, useEffect } from "react"
import jsPDF from "jspdf"
import {
  Clock,
  Users,
  Download,
  Settings,
  RefreshCw,
  Check,
  AlertTriangle,
  Scan,
  FileText,
  X,
  ChevronDown,
  UploadCloud,
  FileJson,
  Database,
  Trash2,
  Plus,
  Pencil
} from "lucide-react"

// --- TYPE DEFINITIONS ---
interface Scene {
  id: number
  text: string
  characters: string[]
  mood: string
  approved: boolean
  imageUrl?: string
}

interface Character {
  id: number
  name: string
  role: string
  locked: boolean
  systemPrompt?: string
  avatarUrl?: string
  loraModelName?: string
  loraStrength?: number
  loraTriggerWord?: string
  keywords?: string
}

interface Settings {
  directorStyle: string
  ollamaUrl: string
  storyModel: string
  visionModel: string
}

interface ProjectData {
  title: string
  scenes: Scene[]
  cast: Character[]
  settings: Settings
}

// --- DEFAULT PROJECT DATA ---
const defaultProjectData: ProjectData = {
  title: "The Forge Script",
  scenes: [
    {
      id: 1,
      text: `The neon lights flickered off the wet pavement as Commander Vex leaned across the cold metal table. Her cybernetic eye pulsed a deep crimson. "You know what happens to people who lie to the Syndicate, don't you?" The prisoner's breath caught in his throat. The air recycling unit hummed in the background, a low drone that did little to mask the sound of dripping water echoing through the interrogation chamber. Vex tapped her metal fingers against the steel surface—clink, clink, clink.`,
      characters: ["Cmdr. Vex", "Unknown Prisoner"],
      mood: "Tension",
      approved: false,
    },
    {
      id: 2,
      text: `"I told you everything I know!" Marcus slammed his fists against the restraints. The holographic replay of the station breach flickered between them—damning evidence floating in electric blue. Vex's smile was cold, calculating. She reached out and manipulated the hologram, zooming in on a shadowed figure slipping through the airlock. "Then explain this, Marcus. Explain why your biometric signature was authorized three seconds before the explosion."`,
      characters: ["Cmdr. Vex", "Marcus Cole"],
      mood: "Desperation",
      approved: true,
    },
    {
      id: 3,
      text: `The door hissed open. Admiral Kira stepped through, her white uniform pristine against the grimy walls. "Stand down, Commander. This one belongs to Division Nine now." The temperature dropped ten degrees. Vex stiffened, her hand hovering near her sidearm before she slowly straightened up. The power dynamic in the room shifted instantly, heavy with unspoken history and rank.`,
      characters: ["Admiral Kira", "Cmdr. Vex"],
      mood: "Power Shift",
      approved: true,
    },
  ],
  cast: [
    { 
      id: 1, 
      name: "Elena Vex", 
      role: "Protagonist", 
      locked: false,
      keywords: "cybernetic eye glowing red, silver hair, stern expression, military uniform, scar across left eye"
    },
    { 
      id: 2, 
      name: "Marcus Cole", 
      role: "Prisoner", 
      locked: false,
      keywords: "disheveled appearance, restraints, desperate expression, worn clothing, anxious demeanor"
    },
    { 
      id: 3, 
      name: "Admiral Kira", 
      role: "Antagonist", 
      locked: false,
      keywords: "pristine white uniform, authority stance, cold demeanor, military insignia, commanding presence"
    },
  ],
  settings: {
    directorStyle: "You are a cinematic director. Write scenes in a noir style, focusing on lighting, atmosphere, and sensory details. Avoid flowery language.",
    ollamaUrl: "http://localhost:11434",
    storyModel: "dolphin-mistral:7b",
    visionModel: "llava:latest",
  },
}

export default function TheForge() {
  // --- 2. STATE MANAGEMENT ---
  const [projectData, setProjectData] = useState<ProjectData>(defaultProjectData)
  const [activeNav, setActiveNav] = useState("timeline")
  const [activeSceneIndex, setActiveSceneIndex] = useState(0)
  const [contextInput, setContextInput] = useState("")
  const [sdUrl, setSdUrl] = useState("http://127.0.0.1:7860")
  const [sdStatus, setSdStatus] = useState("Disconnected")
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  
  // Character Engine
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [characterForm, setCharacterForm] = useState({
    name: "Commander Vex",
    role: "Protagonist",
    keywords: "scar across left eye, cybernetic implant, silver hair, stern expression, military uniform",
  })

  // LoRA/Weights Editor
  const [editingMember, setEditingMember] = useState<number | null>(null)
  const [loraForm, setLoraForm] = useState({
    modelName: "",
    strength: 0.7,
    triggerWord: "",
  })

  // Character Details Modal
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)
  const [characterDetailsForm, setCharacterDetailsForm] = useState({
    name: "",
    role: "",
    keywords: "",
    avatarUrl: "",
  })

  // Logic / Backend Bridge
  const [isScanning, setIsScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatLogInputRef = useRef<HTMLInputElement>(null)
  const characterImportRef = useRef<HTMLInputElement>(null)
  const projectLoadRef = useRef<HTMLInputElement>(null)
  const loraFileInputRef = useRef<HTMLInputElement>(null)

  // --- LOCALSTORAGE PERSISTENCE ---
  useEffect(() => {
    const savedData = localStorage.getItem("forgeProjectData")
    if (savedData) {
      try {
        setProjectData(JSON.parse(savedData))
      } catch (error) {
        console.error("Failed to load project data:", error)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("forgeProjectData", JSON.stringify(projectData))
  }, [projectData])

  // Load scene image when scene changes
  useEffect(() => {
    const activeScene = projectData.scenes[activeSceneIndex]
    if (activeScene?.imageUrl) {
      setCurrentImage(activeScene.imageUrl)
    } else {
      setCurrentImage(null)
    }
  }, [activeSceneIndex, projectData.scenes])

  // --- CHAT LOG PARSER ---
  const parseChatLog = (fileContent: string): Scene[] => {
    try {
      const data = JSON.parse(fileContent)
      
      // Step 1: Detect and extract messages array
      let messagesArray: any[] = []
      
      // Handle Open WebUI bulk export (array of chat objects)
      if (Array.isArray(data) && data.length > 0) {
        const firstChat = data[0]
        if (firstChat?.chat?.history?.messages) {
          const messagesObj = firstChat.chat.history.messages
          if (Array.isArray(messagesObj)) {
            messagesArray = messagesObj
          } else if (typeof messagesObj === 'object') {
            // Convert object with message IDs as keys to array
            messagesArray = Object.values(messagesObj).filter(msg => msg && typeof msg === 'object')
          }
        }
      } else if (Array.isArray(data.messages)) {
        messagesArray = data.messages
      } else if (data.history && Array.isArray(data.history.messages)) {
        messagesArray = data.history.messages
      } else if (data.history && typeof data.history === 'object') {
        // Handle history.messages as object or history as messages object
        if (data.history.messages && typeof data.history.messages === 'object' && !Array.isArray(data.history.messages)) {
          messagesArray = Object.values(data.history.messages).filter(msg => msg && typeof msg === 'object')
        } else {
          // Convert dictionary/map to array
          messagesArray = Object.values(data.history).filter(msg => msg && typeof msg === 'object')
        }
      } else if (data.chat && data.chat.history) {
        // Direct chat.history access for Open WebUI single export
        const historyMessages = data.chat.history.messages
        if (Array.isArray(historyMessages)) {
          messagesArray = historyMessages
        } else if (typeof historyMessages === 'object') {
          messagesArray = Object.values(historyMessages).filter(msg => msg && typeof msg === 'object')
        }
      }
      
      if (!messagesArray.length) {
        throw new Error('No messages found in chat log')
      }
      
      // Step 2: Normalize messages - extract role, content, timestamp
      const normalizedMessages = messagesArray
        .map((msg: any, index: number) => {
          // Extract timestamp
          let timestamp = Date.now() // fallback
          if (msg.timestamp) {
            timestamp = typeof msg.timestamp === 'string' 
              ? new Date(msg.timestamp).getTime() 
              : msg.timestamp * 1000 // handle unix timestamp in seconds
          } else if (msg.created_at) {
            timestamp = typeof msg.created_at === 'string' 
              ? new Date(msg.created_at).getTime() 
              : msg.created_at * 1000
          } else if (msg.date) {
            timestamp = typeof msg.date === 'string' 
              ? new Date(msg.date).getTime() 
              : msg.date * 1000
          } else {
            // Fallback: use index as ordering hint
            timestamp = Date.now() - (messagesArray.length - index) * 60000
          }
          
          return {
            role: msg.role || msg.author || 'user',
            content: msg.content || msg.message || msg.text || '',
            timestamp: timestamp,
            originalIndex: index
          }
        })
        .filter(msg => msg.content && msg.content.trim())
        .sort((a, b) => a.timestamp - b.timestamp)
      
      if (!normalizedMessages.length) {
        throw new Error('No valid messages after normalization')
      }
      
      // Step 3: Scene Chunking - split by 2-hour gaps
      const scenes: Scene[] = []
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000
      
      let currentSceneMessages: typeof normalizedMessages = []
      let currentSceneStartTime = normalizedMessages[0].timestamp
      
      for (let i = 0; i < normalizedMessages.length; i++) {
        const msg = normalizedMessages[i]
        const timeSinceSceneStart = msg.timestamp - currentSceneStartTime
        
        // If time gap > 2 hours, start new scene
        if (timeSinceSceneStart > TWO_HOURS_MS && currentSceneMessages.length > 0) {
          // Create scene from accumulated messages
          const sceneText = currentSceneMessages
            .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n\n')
          
          scenes.push({
            id: scenes.length + 1,
            text: sceneText,
            characters: [],
            mood: 'Neutral',
            approved: false,
          })
          
          // Start new scene
          currentSceneMessages = [msg]
          currentSceneStartTime = msg.timestamp
        } else {
          currentSceneMessages.push(msg)
        }
      }
      
      // Add final scene
      if (currentSceneMessages.length > 0) {
        const sceneText = currentSceneMessages
          .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
          .join('\n\n')
        
        scenes.push({
          id: scenes.length + 1,
          text: sceneText,
          characters: [],
          mood: 'Neutral',
          approved: false,
        })
      }
      
      console.log(`[Chat Log Parser] Parsed ${scenes.length} scenes from Open WebUI log`)
      return scenes
    } catch (error) {
      console.error('[Chat Log Parser Error]', error)
      throw error
    }
  }

  const handlePdfExport = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Set up document properties
      doc.setFont('courier')
      const pageHeight = doc.internal.pageSize.getHeight()
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15
      const maxWidth = pageWidth - 2 * margin
      let currentY = margin

      // Add title
      doc.setFontSize(24)
      doc.setFont('courier', 'bold')
      doc.text(projectData.title, pageWidth / 2, currentY, { align: 'center' })
      currentY += 15

      // Add separator line
      doc.setDrawColor(100, 100, 100)
      doc.line(margin, currentY, pageWidth - margin, currentY)
      currentY += 10

      // Iterate through scenes
      projectData.scenes.forEach((scene, index) => {
        // Check if we need a new page
        if (currentY > pageHeight - 30) {
          doc.addPage()
          currentY = margin
        }

        // Scene header
        doc.setFontSize(14)
        doc.setFont('courier', 'bold')
        doc.text(`SCENE ${scene.id}`, margin, currentY)
        currentY += 8

        // Scene metadata
        doc.setFontSize(10)
        doc.setFont('courier', 'normal')
        
        // Characters line
        const charactersText = `CHARACTERS: ${scene.characters.length > 0 ? scene.characters.join(', ') : 'None'}`
        const characterLines = doc.splitTextToSize(charactersText, maxWidth)
        doc.text(characterLines, margin, currentY)
        currentY += characterLines.length * 5 + 2

        // Mood line
        const moodText = `MOOD: ${scene.mood}`
        const moodLines = doc.splitTextToSize(moodText, maxWidth)
        doc.text(moodLines, margin, currentY)
        currentY += moodLines.length * 5 + 5

        // Scene text
        doc.setFontSize(11)
        doc.setFont('times', 'normal')
        const sceneLines = doc.splitTextToSize(scene.text, maxWidth)
        doc.text(sceneLines, margin, currentY)
        currentY += sceneLines.length * 5 + 8

        // Add separator between scenes
        doc.setDrawColor(150, 150, 150)
        doc.line(margin, currentY, pageWidth - margin, currentY)
        currentY += 10
      })

      // Save the PDF
      doc.save('Director_Script.pdf')
      alert('✓ Director Script exported as PDF!')
    } catch (error) {
      console.error('PDF Export Error:', error)
      alert(`Error generating PDF: ${error}`)
    }
  }

  const handleChatLogUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
          // Use parseChatLog for JSON files (Open WebUI format)
          const parsedScenes = parseChatLog(content)
          
          // Replace project scenes with parsed scenes
          setProjectData({
            ...projectData,
            scenes: parsedScenes,
            title: `${projectData.title} - Imported from ${file.name}`
          })
          
          alert(`✓ Chat log parsed successfully!\n\nImported ${parsedScenes.length} scenes from Open WebUI log.\nCheck console for details.`)
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          // For plain text, just log content
          console.log('Chat Log Content:', content)
          alert(`Chat log loaded: ${file.name}\nCheck console for content.`)
        }
      } catch (error) {
        console.error('Error parsing chat log:', error)
        alert(`Error parsing chat log: ${error}`)
      }
    }
    reader.readAsText(file)
    
    // Reset input
    if (chatLogInputRef.current) {
      chatLogInputRef.current.value = ''
    }
  }

  const handleCharacterImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        let characterData = JSON.parse(content)
        
        // Handle Open WebUI bulk export (array of characters)
        if (Array.isArray(characterData) && characterData.length > 0) {
          characterData = characterData[0]
        }
        
        // Extract fields from character definition with Open WebUI support
        const characterName = characterData.name || 'Unknown Character'
        const characterRole = characterData.role || 'Imported Model'
        const systemPrompt = characterData.params?.system || characterData.system_prompt || ''
        const description = characterData.description || characterData.personality || ''
        const avatarUrl = characterData.meta?.profile_image_url || characterData.avatar || ''
        
        // Auto-generate visual keywords from avatar if available
        let visualKeywords = ''
        if (avatarUrl && avatarUrl.startsWith('data:image')) {
          try {
            console.log('[Character Import] Scanning avatar for visual keywords...')
            
            // Convert Base64 to Blob
            const base64Data = avatarUrl.split(',')[1]
            const mimeType = avatarUrl.match(/data:(.*?);/)?.[1] || 'image/png'
            const byteCharacters = atob(base64Data)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: mimeType })
            
            // Create File object from Blob
            const imageFile = new File([blob], `${characterName}_avatar.png`, { type: mimeType })
            
            // Call Python vision endpoint
            const formData = new FormData()
            formData.append("file", imageFile)
            
            const response = await fetch("http://localhost:8000/scan-face", {
              method: "POST",
              body: formData,
            })
            
            const data = await response.json()
            
            if (data.status === "success") {
              visualKeywords = data.suggested_keywords
              console.log('[Character Import] Visual keywords generated:', visualKeywords)
            } else {
              console.warn('[Character Import] Scan failed, using default keywords')
            }
          } catch (scanError) {
            console.error('[Character Import] Avatar scan error:', scanError)
            console.log('[Character Import] Proceeding without auto-generated keywords')
          }
        }
        
        const newCharacter: Character = {
          id: projectData.cast.length + 1,
          name: characterName,
          role: characterRole,
          locked: false,
          systemPrompt: systemPrompt,
          avatarUrl: avatarUrl,
          keywords: visualKeywords || `${characterName} appearance, character design, distinctive features`,
        }
        
        // Add to cast members
        setProjectData({
          ...projectData,
          cast: [...projectData.cast, newCharacter]
        })
        
        console.log('Character Imported:', {
          name: characterName,
          role: characterRole,
          description: description,
          systemPrompt: systemPrompt,
          avatarUrl: avatarUrl ? 'Base64 image loaded' : 'No avatar',
          keywords: visualKeywords ? 'Auto-generated from avatar' : 'Default keywords',
        })
        
        const keywordsMsg = visualKeywords 
          ? ' and auto-generated visual keywords!' 
          : '!'
        alert(`✓ Successfully imported ${characterName}${keywordsMsg}`)
      } catch (error) {
        console.error('Character Import Error:', error)
        alert(`Error importing character: ${error}`)
      }
    }
    reader.readAsText(file)
    
    // Reset input
    if (characterImportRef.current) {
      characterImportRef.current.value = ''
    }
  }

  const handleApprove = () => {
    if (activeSceneIndex < projectData.scenes.length - 1) {
      setActiveSceneIndex((prev) => prev + 1)
    }
  }

  const roles = ["Protagonist", "Antagonist", "Support", "Background"]

  // --- LORA/WEIGHTS EDITOR ---
  const openLoraEditor = (memberId: number) => {
    const member = projectData.cast.find(m => m.id === memberId)
    if (member) {
      setLoraForm({
        modelName: member.loraModelName || "",
        strength: member.loraStrength || 0.7,
        triggerWord: member.loraTriggerWord || "",
      })
      setEditingMember(memberId)
    }
  }

  const saveLoraWeights = () => {
    if (editingMember === null) return

    const updatedCast = projectData.cast.map(member =>
      member.id === editingMember
        ? {
            ...member,
            loraModelName: loraForm.modelName,
            loraStrength: loraForm.strength,
            loraTriggerWord: loraForm.triggerWord,
          }
        : member
    )

    setProjectData({ ...projectData, cast: updatedCast })
    setEditingMember(null)
    alert("✓ LoRA weights saved!")
  }

  const handleLoraFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Extract filename without extension
    const fileName = file.name
    const cleanName = fileName.replace(/\.(safetensors|pt)$/i, '')

    // Update form with clean filename and auto-suggest trigger word
    setLoraForm({
      ...loraForm,
      modelName: cleanName,
      triggerWord: loraForm.triggerWord || cleanName, // Only set trigger word if empty
    })

    // Reset input
    if (loraFileInputRef.current) {
      loraFileInputRef.current.value = ''
    }
  }

  // --- 3. PROMPT BUILDER FOR STABLE DIFFUSION ---
  const constructSdPrompt = (scene: Scene, castMembers: Character[]): string => {
    // Extract visual keywords from tagged characters (smart matching for nicknames)
    const characterKeywords = castMembers
      .filter(char => scene.characters.some(sceneChar => 
        char.name.toLowerCase().includes(sceneChar.toLowerCase()) || 
        sceneChar.toLowerCase().includes(char.name.toLowerCase())
      ))
      .map(char => char.keywords || `${char.name} (${char.role})`)
      .join(" | ")

    // Extract key visual sentences from scene text (first 2-3 sentences)
    const sentences = scene.text.split(/[.!?]+/).filter(s => s.trim())
    const visualSummary = sentences.slice(0, 2).join(". ").trim()

    // Combine components for rich, visual prompt
    const components = [
      projectData.settings.directorStyle,
      `Scene composition: ${visualSummary}`,
      `Mood: ${scene.mood}`,
      `Characters present: ${scene.characters.join(", ")}`,
      characterKeywords && `Visual details: ${characterKeywords}`
    ]
      .filter(Boolean)
      .join(" | ")

    return components
  }

  // --- 4. THE PYTHON BRIDGE ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsScanning(true) 

    const formData = new FormData()
    formData.append("file", file)
    formData.append("ollama_url", projectData.settings.ollamaUrl)
    formData.append("vision_model", projectData.settings.visionModel)

    try {
      const response = await fetch("http://localhost:8000/scan-face", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (data.status === "success") {
        setCharacterForm(prev => ({
          ...prev,
          keywords: data.suggested_keywords
        }))
        setIsCharacterModalOpen(true)
      } else {
        alert("Scan failed: " + data.suggested_keywords)
      }
    } catch (error) {
      console.error("Error talking to Python:", error)
      alert("Could not connect to the Backend (Port 8000). Is python server.py running?")
    } finally {
      setIsScanning(false)
    }
  }

  const checkSdConnection = async () => {
    setSdStatus("Pinging...")
    try {
      // Try fetching the A1111/Forge API Options
      const res = await fetch(`${sdUrl}/sdapi/v1/options`)
      if (res.ok) {
        setSdStatus("Connected (Forge/A1111)")
      } else {
         throw new Error("Not Forge")
      }
    } catch (e) {
      // Fallback: Just check if the URL exists (for ComfyUI)
      try {
          const res = await fetch(sdUrl, { mode: 'no-cors' })
          setSdStatus("Connected (Comfy/Generic)")
      } catch (err) {
          setSdStatus("Connection Failed (Check CORS)")
      }
    }
  }

  const generateSceneImage = async () => {
    try {
      const currentScene = projectData.scenes[activeSceneIndex]
      
      // Use the Prompt Builder to construct the SD prompt
      const fullPrompt = constructSdPrompt(currentScene, projectData.cast)
      
      console.log("[SD Prompt Builder] Generated prompt:", fullPrompt)
      
      // Call Stable Diffusion API with complete payload
      const response = await fetch(`${sdUrl}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullPrompt,
          negative_prompt: "blurry, low quality, distorted, ugly, deformed, nsfw",
          steps: 30,
          cfg_scale: 7,
          width: 768,
          height: 512,
          sampler_name: "Euler a",
          seed: -1,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`SD API Error: ${response.status} - ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Process response and save image to scene
      if (data.images && data.images.length > 0) {
        const base64Image = `data:image/png;base64,${data.images[0]}`
        
        // Update current display
        setCurrentImage(base64Image)
        
        // Persist imageUrl to scene data
        const updatedScenes = [...projectData.scenes]
        updatedScenes[activeSceneIndex].imageUrl = base64Image
        setProjectData({ ...projectData, scenes: updatedScenes })
        
        console.log("[SD Image Gen] Scene image updated successfully")
        alert("Scene image generated and saved!")
      } else {
        throw new Error("No images returned from Stable Diffusion")
      }
    } catch (error) {
      console.error("[SD Error]", error)
      alert(`Image generation failed: ${error}`)
    }
  }

  const injectContext = () => {
    if (!contextInput.trim()) return
    
    // Append context to current scene
    const updatedScenes = [...projectData.scenes]
    updatedScenes[activeSceneIndex].text += `\n\n[Context Injected]: ${contextInput}`
    setProjectData({ ...projectData, scenes: updatedScenes })
    setContextInput("")
    alert("Context injected into scene!")
  }

  const handleDeleteScene = (sceneId: number) => {
    if (projectData.scenes.length <= 1) {
      alert("Cannot delete the last scene!")
      return
    }
    const updatedScenes = projectData.scenes.filter(s => s.id !== sceneId)
    setProjectData({ ...projectData, scenes: updatedScenes })
    if (activeSceneIndex >= updatedScenes.length) {
      setActiveSceneIndex(updatedScenes.length - 1)
    }
  }

  const handleAddScene = () => {
    const newScene: Scene = {
      id: Math.max(...projectData.scenes.map(s => s.id), 0) + 1,
      text: "Enter scene description here...",
      characters: [],
      mood: "Neutral",
      approved: false,
    }
    setProjectData({ ...projectData, scenes: [...projectData.scenes, newScene] })
  }

  const updateSceneText = (text: string) => {
    const updatedScenes = [...projectData.scenes]
    updatedScenes[activeSceneIndex].text = text
    setProjectData({ ...projectData, scenes: updatedScenes })
  }

  const updateSceneMood = (mood: string) => {
    const updatedScenes = [...projectData.scenes]
    updatedScenes[activeSceneIndex].mood = mood
    setProjectData({ ...projectData, scenes: updatedScenes })
  }

  const updateSceneCharacters = (charactersStr: string) => {
    const updatedScenes = [...projectData.scenes]
    updatedScenes[activeSceneIndex].characters = charactersStr.split(",").map(c => c.trim()).filter(c => c)
    setProjectData({ ...projectData, scenes: updatedScenes })
  }

  const handleTextRegeneration = async () => {
    try {
      // Grab the last 2 scenes as context
      const previousScenes = projectData.scenes
        .slice(Math.max(0, activeSceneIndex - 2), activeSceneIndex)
        .map(scene => `Scene ${scene.id}: ${scene.text}`)
        .join("\n\n---\n\n")
      
      const currentScene = projectData.scenes[activeSceneIndex]
      
      // Construct the instruction prompt combining style and scene text
      const instructionPrompt = `Style: ${projectData.settings.directorStyle}. Rewrite this scene: ${currentScene.text}`
      
      // Call the /generate-story endpoint with correct schema
      const response = await fetch("http://localhost:8000/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: instructionPrompt,
          context: previousScenes || "No previous scenes.",
          model: projectData.settings.storyModel || "dolphin-mistral:7b",
          ollama_url: projectData.settings.ollamaUrl || "http://127.0.0.1:11434",
        }),
      })
      
      const data = await response.json()
      
      if (data.status === "success" && data.text) {
        updateSceneText(data.text)
        alert("Scene text regenerated successfully!")
      } else {
        alert(`Regeneration failed: ${data.detail || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error regenerating text:", error)
      alert(`Error connecting to Story Engine: ${error}`)
    }
  }

  // --- PROJECT SAVE/LOAD SYSTEM ---
  const exportProjectJson = () => {
    try {
      const projectJson = {
        title: projectData.title,
        scenes: projectData.scenes,
        cast: projectData.cast,
        settings: projectData.settings,
        exportedAt: new Date().toISOString(),
      }

      const jsonString = JSON.stringify(projectJson, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = 'project.forge'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      alert('✓ Project saved as project.forge!')
    } catch (error) {
      console.error('Project Export Error:', error)
      alert(`Error saving project: ${error}`)
    }
  }

  const importProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const loadedProject = JSON.parse(content)

        // Validate the loaded data has required fields
        if (!loadedProject.scenes || !loadedProject.cast || !loadedProject.settings) {
          throw new Error('Invalid project format. Missing required fields.')
        }

        // Update project state with loaded data
        setProjectData({
          title: loadedProject.title || 'Loaded Project',
          scenes: loadedProject.scenes,
          cast: loadedProject.cast,
          settings: loadedProject.settings,
        })

        // Reset to first scene
        setActiveSceneIndex(0)

        alert(`✓ Project loaded successfully!\n\nLoaded: ${loadedProject.title}\nScenes: ${loadedProject.scenes.length}\nCast: ${loadedProject.cast.length}`)
      } catch (error) {
        console.error('Project Import Error:', error)
        alert(`Error loading project: ${error}`)
      }
    }
    reader.readAsText(file)

    // Reset input
    if (projectLoadRef.current) {
      projectLoadRef.current.value = ''
    }
  }

  // --- 4. SUB-COMPONENTS (VIEWS) ---
  // NOTE: These are render functions, NOT components. Call as {renderTimelineView()}
  // to avoid focus-loss bugs caused by component recreation on every render.

  const renderTimelineView = () => (
    <div className="flex-1 flex flex-col p-6 lg:p-8 bg-black/20 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
            <h2 className="font-serif text-3xl text-amber-500 mb-2">Storyboard Navigator</h2>
            <p className="text-zinc-400 font-mono text-sm">Select a scene to edit, or upload new chat logs.</p>
        </div>
        
        {/* Upload Box */}
        <div className="border-2 border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl p-8 flex flex-col items-center justify-center hover:border-amber-500/50 hover:bg-zinc-900/50 transition-all cursor-pointer group mb-8">
            <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                </div>
                <div className="text-left">
                    <h3 className="font-serif text-lg text-white mb-1">Import Chat Logs</h3>
                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Supports .JSON, .TXT, .CHAT</p>
                </div>
                <button onClick={() => chatLogInputRef.current?.click()} className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-mono uppercase tracking-wider text-sm rounded transition-colors shadow-lg shadow-amber-900/20">
                    Select Files
                </button>
            </div>
        </div>

        {/* Scene Grid */}
        <div className="mb-4">
            <h4 className="text-xs font-mono uppercase text-zinc-500 tracking-wider mb-4">
                {projectData.scenes.length} Scene{projectData.scenes.length !== 1 ? 's' : ''} in Project
            </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectData.scenes.map((scene, index) => (
                <div
                    key={scene.id}
                    onClick={() => {
                        setActiveSceneIndex(index)
                        setActiveNav('exports')
                    }}
                    className={`relative bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 ${
                        activeSceneIndex === index ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-white/10'
                    }`}
                >
                    {/* Image Thumbnail or Placeholder */}
                    <div className="h-24 bg-zinc-950 relative overflow-hidden">
                        {scene.imageUrl ? (
                            <img 
                                src={scene.imageUrl} 
                                alt={`Scene ${scene.id}`} 
                                className="w-full h-full object-cover opacity-60"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                                <Scan className="w-8 h-8 text-zinc-700" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
                        {/* Scene Number Badge */}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm border border-amber-500/30 rounded">
                            <span className="font-mono text-xs text-amber-500 font-bold">SCENE {scene.id}</span>
                        </div>
                        {/* Approved Badge */}
                        {scene.approved && (
                            <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 rounded">
                                <Check className="w-3 h-3 text-emerald-400" />
                            </div>
                        )}
                    </div>
                    
                    {/* Card Content */}
                    <div className="p-4">
                        {/* Text Preview */}
                        <p className="text-zinc-300 text-sm leading-relaxed mb-3 line-clamp-2">
                            {scene.text.length > 100 ? scene.text.substring(0, 100) + '...' : scene.text}
                        </p>
                        
                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] font-mono border border-cyan-500/30 rounded">
                                {scene.mood}
                            </span>
                            {scene.characters.slice(0, 2).map((char, i) => (
                                <span key={i} className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-mono border border-amber-500/30 rounded truncate max-w-[100px]">
                                    {char}
                                </span>
                            ))}
                            {scene.characters.length > 2 && (
                                <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-mono border border-zinc-700 rounded">
                                    +{scene.characters.length - 2}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  )

  const renderCastView = () => (
    <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
            <div>
                <h2 className="font-serif text-3xl text-white mb-2">Cast Registry</h2>
                <p className="text-zinc-400 font-mono text-sm">Manage character consistency, Loras, and embeddings.</p>
            </div>
            <button onClick={() => characterImportRef.current?.click()} className="px-5 py-2 border border-zinc-600 hover:border-cyan-500 text-zinc-300 hover:text-cyan-400 font-mono text-xs uppercase transition-colors flex items-center gap-2">
                <Users className="w-4 h-4" /> Import Card
            </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projectData.cast.map(member => (
                <div key={member.id} className="group relative bg-zinc-900 border border-white/10 hover:border-cyan-500/50 transition-all duration-300">
                    <div className="h-48 bg-zinc-950 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent z-10" />
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                               <Users className="w-16 h-16 text-zinc-500" />
                          </div>
                        )}
                        {/* Edit/Delete Buttons */}
                        <div className="absolute top-3 left-3 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => {
                                    setCharacterDetailsForm({
                                        name: member.name,
                                        role: member.role,
                                        keywords: member.keywords || "",
                                        avatarUrl: member.avatarUrl || "",
                                    })
                                    setEditingCharacter(member)
                                }}
                                className="p-1.5 bg-blue-600/80 hover:bg-blue-500 border border-blue-500/50 backdrop-blur-md transition-colors"
                                title="Edit"
                            >
                                <Pencil className="w-3 h-3 text-white" />
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm(`Delete ${member.name} from cast?`)) {
                                        setProjectData({
                                            ...projectData,
                                            cast: projectData.cast.filter(c => c.id !== member.id)
                                        })
                                    }
                                }}
                                className="p-1.5 bg-red-600/80 hover:bg-red-500 border border-red-500/50 backdrop-blur-md transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-3 h-3 text-white" />
                            </button>
                        </div>
                        {member.locked && (
                            <div className="absolute top-3 right-3 z-20 px-2 py-1 bg-cyan-950/80 border border-cyan-500/30 backdrop-blur-md">
                                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" /> Locked
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="p-5 relative z-20 -mt-10">
                        <div className="bg-zinc-900 border border-white/10 p-4 shadow-xl">
                            <h3 className="font-serif text-lg text-amber-500 mb-1">{member.name}</h3>
                            <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-4">{member.role}</p>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                                        <span>Consistency</span>
                                        <span className="text-cyan-400">98%</span>
                                    </div>
                                    <div className="h-1 w-full bg-zinc-800 overflow-hidden">
                                        <div className="h-full bg-cyan-500 w-[98%]" />
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => openLoraEditor(member.id)} className="w-full mt-4 py-2 border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-mono uppercase transition-colors">
                                Edit Weights
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  )

  const renderProductionView = () => (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-wider text-amber-500">
                Active Stage — Scene {activeSceneIndex + 1} of {projectData.scenes.length}
                </span>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handleAddScene}
                    className="px-3 py-1 bg-blue-600/80 hover:bg-blue-500 text-white font-mono text-xs uppercase flex items-center gap-1 transition-colors border border-blue-500/50"
                >
                    <Plus className="w-3 h-3" /> Add Scene
                </button>
                <button 
                    onClick={() => handleDeleteScene(projectData.scenes[activeSceneIndex].id)}
                    className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white font-mono text-xs uppercase flex items-center gap-1 transition-colors border border-red-700/50"
                >
                    <Trash2 className="w-3 h-3" /> Delete
                </button>
            </div>
        </div>
        <article className="border-2 border-amber-500/60 bg-black/40 backdrop-blur-xl overflow-hidden">
            <div className="flex flex-col lg:flex-row">
            <div className="lg:w-96 aspect-video lg:aspect-auto lg:h-auto bg-zinc-900 border-b lg:border-b-0 lg:border-r border-white/10 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-amber-500/5" />
                {currentImage ? (
                  <img src={currentImage} alt="Generated Scene" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-6 relative">
                    <div className="w-16 h-16 mx-auto mb-3 border border-cyan-500/50 flex items-center justify-center">
                      <Scan className="w-8 h-8 text-cyan-400 animate-pulse" />
                    </div>
                    <span className="font-mono text-xs text-cyan-400 uppercase tracking-wider">Rendering SDXL...</span>
                  </div>
                )}
            </div>
            <div className="flex-1 p-4 lg:p-6 flex flex-col">
                <textarea
                  value={projectData.scenes[activeSceneIndex].text}
                  onChange={(e) => updateSceneText(e.target.value)}
                  className="font-serif text-base lg:text-lg leading-relaxed text-zinc-100 mb-4 flex-1 bg-black/40 border border-white/20 p-3 focus:border-amber-500 focus:outline-none resize-none"
                />
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex gap-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase w-16">Characters:</label>
                    <input
                      type="text"
                      value={projectData.scenes[activeSceneIndex].characters.join(", ")}
                      onChange={(e) => updateSceneCharacters(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/20 px-2 py-1 text-zinc-300 font-mono text-xs focus:border-amber-500 focus:outline-none"
                      placeholder="Cmdr. Vex, Unknown Prisoner"
                    />
                  </div>
                  <div className="flex gap-2">
                    <label className="text-xs font-mono text-zinc-500 uppercase w-16">Mood:</label>
                    <input
                      type="text"
                      value={projectData.scenes[activeSceneIndex].mood}
                      onChange={(e) => updateSceneMood(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/20 px-2 py-1 text-zinc-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                      placeholder="Tension"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-mono border border-amber-500/30">
                    {projectData.scenes[activeSceneIndex].characters.join(" • ")}
                </span>
                <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-mono border border-cyan-500/30">
                    Mood: {projectData.scenes[activeSceneIndex].mood}
                </span>
                </div>
                <div className="flex gap-3">
                <button onClick={handleTextRegeneration} className="flex-1 py-3 px-4 bg-purple-600/80 hover:bg-purple-500 text-white font-mono uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] border border-purple-500/50">
                    <RefreshCw className="w-4 h-4" />
                    Rewrite (Story Engine)
                </button>
                <button onClick={generateSceneImage} className="flex-1 py-3 px-4 bg-red-600/80 hover:bg-red-500 text-white font-mono uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] border border-red-500/50">
                    <RefreshCw className="w-4 h-4" />
                    Regenerate (Variant B)
                </button>
                <button
                    onClick={handleApprove}
                    className="flex-1 py-3 px-4 bg-emerald-600/80 hover:bg-emerald-500 text-white font-mono uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] border border-emerald-500/50"
                >
                    <Check className="w-4 h-4" />
                    Approve & Next
                </button>
                </div>
            </div>
            </div>
        </article>
        </div>
        <article className="mb-4 border-2 border-amber-400 bg-amber-500/10 backdrop-blur-xl p-4">
        <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex-shrink-0 bg-amber-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1">
            <h4 className="font-mono uppercase tracking-wide text-amber-400 text-sm mb-2">Model Confusion</h4>
            <p className="text-amber-200/80 text-sm mb-4">
                Where is this scene located? The interrogation room or Commander&apos;s office?
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                type="text"
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                placeholder="Clarify the location..."
                className="flex-1 px-4 py-2 bg-black/60 border border-amber-500/50 text-white placeholder:text-amber-500/40 focus:outline-none focus:border-amber-400 font-mono text-sm min-h-[44px]"
                />
                <button onClick={injectContext} className="px-6 py-2 bg-amber-500 text-black font-mono uppercase tracking-wide text-sm hover:bg-amber-400 transition-colors min-h-[44px]">
                Inject
                </button>
            </div>
            </div>
        </div>
        </article>
    </div>
  )

  const renderSettingsView = () => (
    <div className="flex-1 p-6 lg:p-10 overflow-y-auto bg-black/20">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-3xl text-white mb-2">System Configuration</h2>
        <p className="text-zinc-400 font-mono text-sm mb-8">Manage local API endpoints and model parameters.</p>
        <div className="space-y-6">
          {/* Project Management */}
          <div className="bg-zinc-900 border border-white/10 p-6 rounded-lg">
             <h3 className="font-serif text-emerald-500 text-lg mb-4">Project Management</h3>
             <div className="space-y-3">
                <button 
                  onClick={exportProjectJson}
                  className="w-full px-4 py-3 bg-emerald-600/80 hover:bg-emerald-500 text-white font-mono uppercase tracking-wider text-sm transition-colors border border-emerald-500/50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Save Project (.forge)
                </button>
                <button 
                  onClick={() => projectLoadRef.current?.click()}
                  className="w-full px-4 py-3 bg-blue-600/80 hover:bg-blue-500 text-white font-mono uppercase tracking-wider text-sm transition-colors border border-blue-500/50 flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  Load Project
                </button>
             </div>
          </div>
          {/* Connection Status Card */}
          <div className="bg-zinc-900 border border-white/10 p-6 rounded-lg">
             <h3 className="font-serif text-amber-500 text-lg mb-4">Neural Bridges</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-xs font-mono uppercase text-zinc-500">Ollama Endpoint (LLM & Vision)</label>
                   <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={projectData.settings.ollamaUrl}
                        onChange={(e) => setProjectData({ ...projectData, settings: { ...projectData.settings, ollamaUrl: e.target.value } })}
                        className="flex-1 bg-black/40 border border-white/20 px-4 py-2 text-zinc-300 font-mono text-sm focus:border-cyan-500 focus:outline-none" 
                      />
                      <button className="px-3 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded hover:bg-emerald-500/30"><Check className="w-4 h-4" /></button>
                   </div>
                   <p className="text-[10px] text-zinc-600 font-mono">Status: <span className="text-emerald-500">Connected (Llava detected)</span></p>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-mono uppercase text-zinc-500">Stable Diffusion (A1111/ComfyUI)</label>
                   <div className="flex gap-2">
                      <input 
                          type="text" 
                          value={sdUrl}
                          onChange={(e) => setSdUrl(e.target.value)}
                          className="flex-1 bg-black/40 border border-white/20 px-4 py-2 text-zinc-300 font-mono text-sm focus:border-cyan-500 focus:outline-none" 
                      />
                      <button 
                          onClick={checkSdConnection}
                          className="px-3 bg-zinc-800 border border-zinc-700 text-zinc-500 rounded hover:bg-zinc-700 hover:text-white transition-colors"
                      >
                          <RefreshCw className={`w-4 h-4 ${sdStatus === 'Pinging...' ? 'animate-spin' : ''}`} />
                      </button>
                   </div>
                   <p className="text-[10px] text-zinc-600 font-mono">
                      Status: <span className={sdStatus.includes("Connected") ? "text-emerald-500" : "text-red-500"}>{sdStatus}</span>
                   </p>
                </div>
             </div>
          </div>
          {/* Model Selection */}
          <div className="bg-zinc-900 border border-white/10 p-6 rounded-lg">
             <h3 className="font-serif text-cyan-500 text-lg mb-4">Model Orchestration</h3>
             <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-white/5 bg-black/20">
                   <div>
                      <p className="text-white font-mono text-sm">Story Engine (Chat)</p>
                      <p className="text-xs text-zinc-500">Responsible for narrative generation and dialogue.</p>
                   </div>
                   <select 
                      value={projectData.settings.storyModel}
                      onChange={(e) => setProjectData({ ...projectData, settings: { ...projectData.settings, storyModel: e.target.value } })}
                      className="bg-black border border-white/20 text-zinc-300 px-3 py-2 font-mono text-sm rounded focus:border-cyan-500 outline-none"
                   >
                      <option value="dolphin-mistral:7b">dolphin-mistral:7b (Chatbot)</option>
                      <option value="L3.2-Rogue-Creative-Instruct">L3.2-Rogue-Creative-Instruct (Chatbot)</option>
                      <option value="Aletheia:latest">Aletheia:latest (Reasoning)</option>
                      <option value="qwen2.5-coder:7b">qwen2.5-coder:7b (Logic)</option>
                   </select>
                </div>
                <div className="flex items-center justify-between p-4 border border-white/5 bg-black/20">
                   <div>
                      <p className="text-white font-mono text-sm">Vision Engine (Multimodal)</p>
                      <p className="text-xs text-zinc-500">Used for scanning character avatars.</p>
                   </div>
                   <select 
                      value={projectData.settings.visionModel}
                      onChange={(e) => setProjectData({ ...projectData, settings: { ...projectData.settings, visionModel: e.target.value } })}
                      className="bg-black border border-white/20 text-zinc-300 px-3 py-2 font-mono text-sm rounded focus:border-cyan-500 outline-none"
                   >
                      <option value="llava:latest">llava:latest</option>
                      <option value="llava:13b">llava:13b</option>
                      <option value="bakllava:latest">bakllava:latest</option>
                   </select>
                </div>
             </div>
          </div>
          
           {/* System Prompt */}
          <div className="bg-zinc-900 border border-white/10 p-6 rounded-lg">
             <h3 className="font-serif text-purple-500 text-lg mb-4">Director's Directive</h3>
             <p className="text-xs text-zinc-500 mb-2">This prompt is injected into every scene generation.</p>
             <textarea 
                value={projectData.settings.directorStyle}
                onChange={(e) => setProjectData({ ...projectData, settings: { ...projectData.settings, directorStyle: e.target.value } })}
                className="w-full bg-black/40 border border-white/20 p-4 text-zinc-300 font-mono text-sm h-32 focus:border-purple-500 focus:outline-none resize-none"
             />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* HIDDEN INPUTS */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="image/*"
      />
      <input 
        type="file" 
        ref={chatLogInputRef} 
        onChange={handleChatLogUpload} 
        className="hidden" 
        accept=".json,.txt"
      />
      <input 
        type="file" 
        ref={characterImportRef} 
        onChange={handleCharacterImport} 
        className="hidden" 
        accept=".json"
      />
      <input 
        type="file" 
        ref={projectLoadRef} 
        onChange={importProjectJson} 
        className="hidden" 
        accept=".forge,.json"
      />
      <input 
        type="file" 
        ref={loraFileInputRef} 
        onChange={handleLoraFileSelection} 
        className="hidden" 
        accept=".safetensors,.pt"
      />

      {/* Sidebar */}
      <aside className="w-16 lg:w-20 flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-center">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <span className="font-serif font-bold text-black text-sm">F</span>
          </div>
        </div>

        <nav className="flex-1 py-4">
          <ul className="flex flex-col items-center gap-2">
            {[
              { id: "timeline", icon: Clock, label: "Timeline" },
              { id: "cast", icon: Users, label: "Cast" },
              { id: "exports", icon: Download, label: "Exports" },
              { id: "settings", icon: Settings, label: "Settings" },
            ].map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveNav(item.id)}
                  className={`w-11 h-11 flex items-center justify-center transition-all ${
                    activeNav === item.id
                      ? "bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                      : "text-zinc-500 hover:text-white hover:bg-white/5"
                  }`}
                  aria-label={item.label}
                >
                  <item.icon className="w-5 h-5" />
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 border-t border-white/10">
          <button onClick={handlePdfExport} className="w-full py-2 border border-white/20 text-zinc-400 hover:text-white hover:border-white/40 transition-colors text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1">
            <FileText className="w-3 h-3" />
            <span className="hidden lg:inline">PDF</span>
          </button>
        </div>
      </aside>

      {/* Column B: Identity Engine */}
      <aside className="w-72 lg:w-80 flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-serif text-lg text-amber-500">Cast & Consistency</h2>
        </div>

        <div className="p-4">
          <div 
            onClick={() => fileInputRef.current?.click()} // TRIGGER PYTHON SCAN
            className="relative bg-cyan-950/20 border border-cyan-500/30 p-6 overflow-hidden cursor-pointer hover:bg-cyan-900/10 transition-colors group"
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            />

            <div className="relative flex flex-col items-center gap-4">
              <div className="relative">
                <div className={`w-20 h-20 rounded-full border-2 border-cyan-500/50 flex items-center justify-center ${isScanning ? 'animate-spin' : 'animate-pulse'}`}>
                  <Scan className="w-8 h-8 text-cyan-400" />
                </div>
                {isScanning && <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping" />}
              </div>

              <div className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/40">
                <span className="font-mono text-xs text-cyan-400 tracking-wider">
                    {isScanning ? "UPLOADING TO OLLAMA..." : "IDENTITY LOCK: 98.4%"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 pt-0 overflow-y-auto">
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Active Cast</h3>
          <div className="flex flex-col gap-2">
            {projectData.cast.map((member) => (
              <div
                key={member.id}
                onClick={() => {
                  setCharacterDetailsForm({
                    name: member.name,
                    role: member.role,
                    keywords: member.keywords || "",
                    avatarUrl: member.avatarUrl || "",
                  })
                  setEditingCharacter(member)
                }}
                className={`p-3 border bg-black/40 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors ${
                  member.locked ? "border-amber-500/40" : "border-white/10"
                }`}
              >
                <div className="w-10 h-10 bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-zinc-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-amber-500 text-sm truncate">{member.name}</p>
                  <p className="text-xs text-zinc-500 font-mono">{member.role}</p>
                </div>
                {member.locked && <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Column C: Main Stage */}
      <main className="flex-1 flex flex-col min-w-0 bg-black/20">
        <header className="px-4 py-2 border-b border-white/10 bg-black/60 backdrop-blur-xl flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className={`px-2 py-1 border whitespace-nowrap ${
              sdStatus.includes("Connected") 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                : "bg-red-500/20 text-red-400 border-red-500/30"
            }`}>
              SD: {sdStatus}
            </span>
            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 whitespace-nowrap">
              Model: {projectData.settings.visionModel}
            </span>
          </div>
        </header>

        {/* Dynamic Content Switching */}
        {activeNav === 'timeline' && renderTimelineView()}
        {activeNav === 'cast' && renderCastView()}
        {activeNav === 'exports' && renderProductionView()}
        {activeNav === 'settings' && renderSettingsView()}
      </main>

      {/* Modal */}
      {isCharacterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setIsCharacterModalOpen(false)}
          />

          <div className="relative w-full max-w-3xl bg-zinc-950 border-2 border-cyan-500/50 shadow-[0_0_60px_rgba(34,211,238,0.2)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
                  <Scan className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-serif text-lg text-amber-500">Character Neural Link</h2>
                  <p className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                    Identity Detected: New Actor
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCharacterModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row">
              <div className="lg:w-80 p-6 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col items-center justify-center bg-black/40">
                <div className="relative w-48 h-48 bg-zinc-900 border-2 border-cyan-500/40 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-500/10 to-amber-500/10">
                    <Users className="w-16 h-16 text-zinc-700" />
                  </div>
                  <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {[20, 35, 50, 65, 80].map((y) => (
                        <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(34,211,238,0.3)" strokeWidth="0.5" />
                      ))}
                      {[20, 35, 50, 65, 80].map((x) => (
                        <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="100" stroke="rgba(34,211,238,0.3)" strokeWidth="0.5" />
                      ))}
                      <ellipse cx="50" cy="45" rx="25" ry="32" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1" strokeDasharray="3,2" />
                    </svg>
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" style={{ top: "30%" }} />
                  </div>
                  <div className="mt-4 text-center">
                    <div className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/40 inline-block mb-2">
                      <span className="font-mono text-xs text-cyan-400 uppercase tracking-wider">
                        Mesh Analysis: Complete
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    Character Name
                  </label>
                  <input
                    type="text"
                    value={characterForm.name}
                    onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 font-serif text-lg min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    Narrative Role
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                      className="w-full px-4 py-3 bg-black/60 border border-white/20 text-left flex items-center justify-between focus:outline-none focus:border-amber-500/60 min-h-[44px]"
                    >
                      <span className="font-mono text-amber-400">{characterForm.role}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-500 transition-transform ${roleDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {roleDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/20 z-10">
                        {roles.map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => {
                              setCharacterForm({ ...characterForm, role })
                              setRoleDropdownOpen(false)
                            }}
                            className={`w-full px-4 py-3 text-left font-mono hover:bg-white/10 transition-colors min-h-[44px] ${
                              characterForm.role === role ? "text-amber-400 bg-amber-500/10" : "text-zinc-300"
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    Stable Diffusion Keywords
                  </label>
                  <textarea
                    value={characterForm.keywords}
                    onChange={(e) => setCharacterForm({ ...characterForm, keywords: e.target.value })}
                    rows={4}
                    className="flex-1 w-full px-4 py-3 bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/60 font-mono text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-black/60">
              <button
                onClick={() => setIsCharacterModalOpen(false)}
                className="px-6 py-3 border border-white/20 text-zinc-400 hover:text-white hover:border-white/40 font-mono uppercase tracking-wider text-sm transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const newCharacter: Character = {
                    id: projectData.cast.length > 0 ? Math.max(...projectData.cast.map(c => c.id)) + 1 : 1,
                    name: characterForm.name,
                    role: characterForm.role,
                    locked: true,
                    keywords: characterForm.keywords,
                  }
                  setProjectData({
                    ...projectData,
                    cast: [...projectData.cast, newCharacter]
                  })
                  setIsCharacterModalOpen(false)
                  alert('Character Saved')
                }}
                className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-mono uppercase tracking-wider text-sm transition-colors min-h-[44px] shadow-[0_0_20px_rgba(34,211,238,0.4)] flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Lock Identity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LoRA Weights Editor Modal */}
      {editingMember !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setEditingMember(null)}
          />

          <div className="relative w-full max-w-md bg-zinc-950 border-2 border-violet-500/50 shadow-[0_0_60px_rgba(139,92,246,0.2)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-violet-500/20 border border-violet-500/50 flex items-center justify-center">
                  <Database className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h2 className="font-serif text-lg text-violet-500">LoRA Weights Editor</h2>
                  <p className="text-xs font-mono text-violet-400 uppercase tracking-wider">
                    {projectData.cast.find(m => m.id === editingMember)?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                  LoRA Model Filename
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={loraForm.modelName}
                    onChange={(e) => setLoraForm({ ...loraForm, modelName: e.target.value })}
                    placeholder="e.g., lando_v1, character_style_v2"
                    className="flex-1 px-4 py-2 bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 font-mono text-sm min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => loraFileInputRef.current?.click()}
                    className="px-4 py-2 bg-violet-600/80 hover:bg-violet-500 border border-violet-500/50 text-white font-mono uppercase tracking-wider text-xs transition-colors min-h-[44px] whitespace-nowrap"
                  >
                    Browse
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-1">Accepts .safetensors and .pt files</p>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">
                  Strength: {loraForm.strength.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={loraForm.strength}
                  onChange={(e) => setLoraForm({ ...loraForm, strength: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-2">
                  <span>0.0</span>
                  <span>0.5</span>
                  <span>1.0</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                  Trigger Word
                </label>
                <input
                  type="text"
                  value={loraForm.triggerWord}
                  onChange={(e) => setLoraForm({ ...loraForm, triggerWord: e.target.value })}
                  placeholder="e.g., landostyle, character_style"
                  className="w-full px-4 py-2 bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 font-mono text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-black/60">
              <button
                onClick={() => setEditingMember(null)}
                className="px-6 py-3 border border-white/20 text-zinc-400 hover:text-white hover:border-white/40 font-mono uppercase tracking-wider text-sm transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={saveLoraWeights}
                className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-mono uppercase tracking-wider text-sm transition-colors min-h-[44px] shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Weights
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character Details Modal */}
      {editingCharacter !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setEditingCharacter(null)}
          />

          <div className="relative w-full max-w-2xl bg-zinc-950 border-2 border-amber-500/50 shadow-[0_0_60px_rgba(245,158,11,0.2)] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-serif text-lg text-amber-500">Character Details</h2>
                  <p className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    Editing: {editingCharacter.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCharacter(null)}
                className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Avatar Preview */}
              <div className="lg:w-64 p-6 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col items-center justify-center bg-black/40">
                <div className="relative w-40 h-40 bg-zinc-900 border-2 border-amber-500/40 overflow-hidden">
                  {characterDetailsForm.avatarUrl ? (
                    <img 
                      src={characterDetailsForm.avatarUrl} 
                      alt={characterDetailsForm.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-cyan-500/10">
                      <Users className="w-16 h-16 text-zinc-700" />
                    </div>
                  )}
                </div>
                <p className="mt-4 text-xs font-mono text-zinc-500 uppercase tracking-wider">
                  {characterDetailsForm.role}
                </p>
              </div>

              {/* Form Fields */}
              <div className="flex-1 p-6 flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    Character Name
                  </label>
                  <input
                    type="text"
                    value={characterDetailsForm.name}
                    onChange={(e) => setCharacterDetailsForm({ ...characterDetailsForm, name: e.target.value })}
                    className="w-full px-4 py-3 bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 font-serif text-lg min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    value={characterDetailsForm.role}
                    onChange={(e) => setCharacterDetailsForm({ ...characterDetailsForm, role: e.target.value })}
                    className="w-full px-4 py-3 bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono text-sm min-h-[44px]"
                    disabled
                  />
                  <p className="text-[10px] text-zinc-600 font-mono mt-1">Role cannot be changed after creation.</p>
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                    Stable Diffusion Keywords
                  </label>
                  <textarea
                    value={characterDetailsForm.keywords}
                    onChange={(e) => setCharacterDetailsForm({ ...characterDetailsForm, keywords: e.target.value })}
                    rows={4}
                    className="flex-1 w-full px-4 py-3 bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-black/60">
              <button
                onClick={() => setEditingCharacter(null)}
                className="px-6 py-3 border border-white/20 text-zinc-400 hover:text-white hover:border-white/40 font-mono uppercase tracking-wider text-sm transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const updatedCast = projectData.cast.map(member =>
                    member.id === editingCharacter.id
                      ? {
                          ...member,
                          name: characterDetailsForm.name,
                          keywords: characterDetailsForm.keywords,
                        }
                      : member
                  )
                  setProjectData({ ...projectData, cast: updatedCast })
                  setEditingCharacter(null)
                  alert('✓ Character updated!')
                }}
                className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-mono uppercase tracking-wider text-sm transition-colors min-h-[44px] shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}