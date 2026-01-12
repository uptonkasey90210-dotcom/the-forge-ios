from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ollama import Client # Import the specific Client class
from typing import Optional
import io

app = FastAPI()

# Allow Next.js (Port 3001) to talk to Python (Port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS ---
class StoryRequest(BaseModel):
    """Request model for text generation"""
    prompt: str
    context: str = ""
    model: str = "dolphin-mistral:7b"
    ollama_url: str = "http://127.0.0.1:11434"

@app.post("/scan-face")
async def scan_face(
    file: UploadFile = File(...),
    ollama_url: str = Form("http://127.0.0.1:11434"),
    vision_model: str = Form("llava")
):
    print(f"Received file: {file.filename}")
    
    # Read the image bytes
    image_data = await file.read()
    
    try:
        print(f"Connecting to Ollama at {ollama_url}...")
        
        # Use dynamic URL from frontend settings
        client = Client(host=ollama_url)
        
        response = client.chat(
            model=vision_model, 
            messages=[{
                'role': 'user',
                'content': 'Describe this character in a comma-separated list of visual keywords optimized for Stable Diffusion. Focus on: hair style/color, eye color, facial features, scars, and expression.',
                'images': [image_data]
            }]
        )
        
        description = response['message']['content']
        print(f"Analysis complete: {description}")
        
        return {
            "status": "success",
            "suggested_keywords": description
        }
        
    except Exception as e:
        print(f"Error: {e}")
        return {
            "status": "error", 
            "suggested_keywords": f"Connection Error: {str(e)}. Ensure Ollama is running."
        }

@app.post("/generate-story")
async def generate_story(request: StoryRequest):
    """
    Generate text using the Story Engine (Ollama).
    
    Request body:
    {
        "prompt": str,
        "context": str (optional, default ""),
        "model": str (optional, default "dolphin-mistral:7b")
    }
    """
    try:
        print(f"Generating text with model: {request.model} at {request.ollama_url}")
        
        client = Client(host=request.ollama_url)
        
        # Build the complete message with context if provided
        if request.context.strip():
            full_message = f"Context:\n{request.context}\n\nInstruction:\n{request.prompt}"
        else:
            full_message = request.prompt
        
        response = client.chat(
            model=request.model,
            messages=[
                {
                    'role': 'user',
                    'content': full_message
                }
            ]
        )
        
        generated_text = response['message']['content'].strip()
        print(f"Text generation complete")
        
        return {
            "status": "success",
            "text": generated_text
        }
        
    except Exception as e:
        print(f"Error generating text: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Text generation failed: {str(e)}. Ensure Ollama is running and the model '{request.model}' is available."
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)